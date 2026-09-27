import { afterEach, describe, expect, test } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createMemoryDb } from "@/lib/db";
import { seedDatabase } from "@/lib/seed";
import { FixtureSemanticProvider } from "@/lib/semantic";
import { UpdateChecker } from "@/lib/update-checker";

const tempDirs: string[] = [];
afterEach(() => { for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

describe("update checking", () => {
  test("unchanged snapshots create check records and skip semantics", async () => {
    const db = createMemoryDb(); seedDatabase(db);
    const provider = new FixtureSemanticProvider();
    const results = await new UpdateChecker(db, provider).checkConsultation("con-field-street");
    expect(results.every((result) => result.status === "unchanged")).toBe(true);
    expect(provider.calls).toBe(0);
    expect((db.prepare("SELECT COUNT(*) total FROM check_runs").get() as { total: number }).total).toBe(2);
  });

  test("a meaningful change creates exactly one event and repeated processing is idempotent", async () => {
    const db = createMemoryDb(); seedDatabase(db);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "civicloop-test-")); tempDirs.push(dir);
    const changedPath = path.join(dir, "changed.html");
    fs.writeFileSync(changedPath, "<main><h1>Field Street Sidewalk</h1><p>New official construction update.</p></main>");
    db.prepare("UPDATE source_documents SET fixture_path = ? WHERE id = 'src-field-page'").run(changedPath);
    const provider = new FixtureSemanticProvider();
    const checker = new UpdateChecker(db, provider, () => new Date("2026-09-27T12:00:00Z"));
    const first = await checker.checkConsultation("con-field-street");
    expect(first.find((result) => result.sourceId === "src-field-page")).toMatchObject({ status: "changed", newEvents: 1, semanticCalled: true });
    expect(provider.calls).toBe(1);
    const second = await checker.checkConsultation("con-field-street");
    expect(second.find((result) => result.sourceId === "src-field-page")).toMatchObject({ status: "unchanged", newEvents: 0, semanticCalled: false });
    expect(provider.calls).toBe(1);
    expect((db.prepare("SELECT COUNT(*) total FROM timeline_events WHERE event_type = 'source_update_detected'").get() as { total: number }).total).toBe(1);
    expect((db.prepare("SELECT COUNT(*) total FROM notifications WHERE kind = 'source_changed'").get() as { total: number }).total).toBe(1);
  });

  test("retrieval failure is recorded as failure, not no update", async () => {
    const db = createMemoryDb(); seedDatabase(db);
    db.prepare("UPDATE source_documents SET fixture_path = ? WHERE id = 'src-field-page'").run("/definitely/missing/civicloop.html");
    const results = await new UpdateChecker(db).checkConsultation("con-field-street");
    expect(results.find((result) => result.sourceId === "src-field-page")?.status).toBe("failed");
    const run = db.prepare("SELECT status, change_found FROM check_runs WHERE source_id = 'src-field-page'").get() as { status: string; change_found: number };
    expect(run).toEqual({ status: "failed", change_found: 0 });
  });
});
