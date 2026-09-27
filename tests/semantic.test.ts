import { describe, expect, test } from "vitest";
import { createMemoryDb } from "@/lib/db";
import { seedDatabase } from "@/lib/seed";
import { extractWithCache, FallbackSemanticProvider, FixtureSemanticProvider, SemanticResultSchema, validateGrounding, type SemanticProvider, type SemanticResult } from "@/lib/semantic";

describe("semantic extraction boundary", () => {
  test("rejects invalid structured model output", async () => {
    const invalid: SemanticProvider = {
      id: "invalid",
      async extract() { return { documentType: "invented" } as unknown as SemanticResult; },
    };
    const db = createMemoryDb(); seedDatabase(db);
    await expect(extractWithCache(db, invalid, { sourceDocumentId: "src-field-page", contentHash: "new", text: "bounded" })).rejects.toThrow();
  });

  test("caches by content, schema, and provider", async () => {
    const db = createMemoryDb(); seedDatabase(db);
    const provider = new FixtureSemanticProvider();
    const input = { sourceDocumentId: "src-field-page", contentHash: "hash-1", text: "bounded source" };
    expect((await extractWithCache(db, provider, input)).cached).toBe(false);
    expect((await extractWithCache(db, provider, input)).cached).toBe(true);
    expect(provider.calls).toBe(1);
  });

  test("concurrent analysis of the same content resolves to one cache record", async () => {
    const db = createMemoryDb(); seedDatabase(db);
    const provider = new FixtureSemanticProvider();
    const input = { sourceDocumentId: "src-field-page", contentHash: "concurrent-hash", text: "bounded concurrent source text" };
    const results = await Promise.all([extractWithCache(db, provider, input), extractWithCache(db, provider, input)]);
    expect(results).toHaveLength(2);
    expect((db.prepare("SELECT COUNT(*) total FROM semantic_cache WHERE source_id = 'src-field-page'").get() as { total: number }).total).toBe(1);
  });

  test("rejects invented evidence spans even when the JSON schema is valid", () => {
    const result = SemanticResultSchema.parse({
      documentType: "decision", projectAliases: [],
      relationship: { type: "unknown", confidenceLabel: "needs_review", rationale: "", evidence: [] },
      summary: { points: [{ text: "A decision was made.", evidence: { sourceDocumentId: "source-1", excerpt: "Council unanimously approved the invented proposal" } }] },
      feedbackThemes: [], commitments: [],
    });
    expect(() => validateGrounding(result, { sourceDocumentId: "source-1", contentHash: "x", text: "Council received the report without a vote." })).toThrow(/not found/);
  });

  test("repairs a near-verbatim long quote only to its grounded prefix", () => {
    const source = "The design concept has been slightly revised in response to public concerns about existing trees and storm drainage.";
    const result = SemanticResultSchema.parse({
      documentType: "implementation_update", projectAliases: [],
      relationship: { type: "unknown", confidenceLabel: "needs_review", rationale: "", evidence: [] },
      summary: { points: [{ text: "The design changed.", evidence: { sourceDocumentId: "source-1", excerpt: `${source} This extra sentence was invented.` } }] },
      feedbackThemes: [], commitments: [],
    });
    const grounded = validateGrounding(result, { sourceDocumentId: "source-1", contentHash: "x", text: source });
    expect(grounded.summary.points[0].evidence.excerpt).toBe(source.replace(/\.$/, ""));
  });

  test("applies deterministic meeting terminology to a carried result", () => {
    const result = SemanticResultSchema.parse({
      documentType: "decision", projectAliases: [],
      relationship: { type: "unknown", confidenceLabel: "needs_review", rationale: "", evidence: [] },
      summary: { points: [{ text: "The program was carried out.", evidence: { sourceDocumentId: "source-1", excerpt: "Carried." } }] },
      feedbackThemes: [], commitments: [],
    });
    const grounded = validateGrounding(result, { sourceDocumentId: "source-1", contentHash: "x", text: "Motion Result Carried" });
    expect(grounded.summary.points[0].text).toBe("The meeting record states that the motion or recommendation was carried.");
  });

  test("uses the fallback provider when the primary model fails", async () => {
    const primary: SemanticProvider = { id: "unavailable-primary", async extract() { throw new Error("quota exhausted"); } };
    const fallback = new FixtureSemanticProvider();
    const provider = new FallbackSemanticProvider(primary, fallback);
    const result = await provider.extract({ sourceDocumentId: "source-1", contentHash: "x", text: "Official consultation update." });
    expect(fallback.calls).toBe(1);
    expect(result.summary.points[0].evidence.excerpt).toBe("Official consultation update.");
  });
});
