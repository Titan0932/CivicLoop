import { describe, expect, test } from "vitest";
import { createMemoryDb } from "@/lib/db";
import { runMonitoringCycle } from "@/lib/monitoring";
import { seedDatabase } from "@/lib/seed";
import { FixtureSemanticProvider } from "@/lib/semantic";

describe("scheduled monitoring", () => {
  test("checks only due consultations and advances their source schedules", async () => {
    const db = createMemoryDb(); seedDatabase(db);
    db.prepare("UPDATE source_documents SET next_check_at = '2026-09-01T00:00:00.000Z' WHERE consultation_id = 'con-field-street'").run();
    db.prepare("UPDATE source_documents SET next_check_at = '2027-01-01T00:00:00.000Z' WHERE consultation_id = 'con-community-gardens'").run();
    const now = new Date("2026-09-26T12:00:00.000Z");
    const result = await runMonitoringCycle(db, new FixtureSemanticProvider(), { now, live: false });
    expect(result).toMatchObject({ checkedConsultations: 1, checkedSources: 2, changedSources: 0, failedSources: 0 });
    const stillDue = db.prepare("SELECT COUNT(*) total FROM source_documents WHERE consultation_id = 'con-field-street' AND next_check_at <= ?").get(now.toISOString()) as { total: number };
    expect(stillDue.total).toBe(0);
  });
});
