import { describe, expect, test } from "vitest";
import { createMemoryDb } from "@/lib/db";
import { importOfficialConsultation } from "@/lib/importer";
import type { DiscoveryReport } from "@/lib/discovery";

const seedUrl = "https://engage.ottawa.ca/example-community-project";

function report(): DiscoveryReport {
  return {
    mode: "live_discovery",
    seedUrl,
    checkedAt: "2026-09-26T12:00:00.000Z",
    discoveredLinks: ["https://engage.ottawa.ca/321/widgets/22/documents/44"],
    coverageNote: "Direct official links only.",
    records: [
      {
        url: seedUrl, title: "Example Community Project", sourceSystem: "Engage Ottawa",
        identifiers: [{ type: "engage_page_id", value: "321" }], attachments: [], motionResult: null,
        contentHash: "hash-seed", extractedText: "Example Community Project consultation details and public input.",
        textPreview: "Example Community Project consultation details and public input.", retrievalStatus: "success",
      },
      {
        url: "https://engage.ottawa.ca/321/widgets/22/documents/44", title: "What We Heard", sourceSystem: "Engage Ottawa",
        identifiers: [{ type: "engage_document_id", value: "44" }], attachments: [], motionResult: null,
        contentHash: "hash-report", extractedText: "What We Heard report with community feedback.",
        textPreview: "What We Heard report with community feedback.", retrievalStatus: "success",
      },
    ],
  };
}

describe("community consultation import", () => {
  test("creates a shared case once and resolves repeated requests to it", async () => {
    const db = createMemoryDb();
    const first = await importOfficialConsultation(db, `${seedUrl}#overview`, {
      discover: async () => report(), semanticProvider: null, now: () => new Date("2026-09-26T12:00:00.000Z"),
    });
    expect(first).toMatchObject({ existing: false, sourceCount: 2, analysisCount: 0 });
    expect((db.prepare("SELECT COUNT(*) total FROM source_documents WHERE consultation_id = ?").get(first.consultationId) as { total: number }).total).toBe(2);
    expect((db.prepare("SELECT COUNT(*) total FROM relationships WHERE target_id IN (SELECT id FROM source_documents WHERE consultation_id = ?)").get(first.consultationId) as { total: number }).total).toBe(1);
    expect((db.prepare("SELECT COUNT(*) total FROM notifications WHERE consultation_id = ?").get(first.consultationId) as { total: number }).total).toBe(1);

    const second = await importOfficialConsultation(db, seedUrl, { discover: async () => { throw new Error("should not rediscover"); }, semanticProvider: null });
    expect(second).toMatchObject({ existing: true, consultationId: first.consultationId, slug: first.slug });
    expect((db.prepare("SELECT COUNT(*) total FROM discovery_requests").get() as { total: number }).total).toBe(2);
  });
});
