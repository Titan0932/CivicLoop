import { describe, expect, test } from "vitest";
import { createMemoryDb } from "@/lib/db";
import { getConsultationBySlug, getConsultations, getSemanticAnalyses } from "@/lib/queries";
import { seedDatabase } from "@/lib/seed";
import { extractWithCache, FixtureSemanticProvider } from "@/lib/semantic";

describe("consultation queries", () => {
  test("seed is idempotent and assembles the complete detail view", () => {
    const db = createMemoryDb();
    seedDatabase(db); seedDatabase(db);
    expect(getConsultations(db)).toHaveLength(2);
    const garden = getConsultationBySlug("community-led-green-initiatives", db);
    expect(garden?.aliases).toContain("Community Garden Action Plan Review");
    expect(garden?.events.length).toBeGreaterThanOrEqual(4);
    expect(garden?.sources.length).toBe(3);
    expect(garden?.relationships.some((relationship) => relationship.signals.some((signal) => signal.type === "official_attachment_relationship"))).toBe(true);
    expect(garden?.feedback.length).toBeGreaterThan(0);
    expect(garden?.commitments.length).toBeGreaterThan(0);
    expect(garden?.sources[0]).toHaveProperty("lastLiveCheckedAt", null);
  });

  test("assembles cached grounded semantic analysis for the detail UI", async () => {
    const db = createMemoryDb(); seedDatabase(db);
    await extractWithCache(db, new FixtureSemanticProvider(), {
      sourceDocumentId: "src-field-page", contentHash: "analysis-hash", text: "The official project page describes the proposed sidewalk and consultation.",
    });
    const analyses = getSemanticAnalyses("con-field-street", db);
    expect(analyses).toHaveLength(1);
    expect(analyses[0]).toMatchObject({ sourceId: "src-field-page", provider: "fixture-v2" });
    expect(analyses[0].result.summary.points[0].evidence.excerpt).toContain("official project page");
  });
});
