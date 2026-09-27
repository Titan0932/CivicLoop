import type { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { contentHash, normalizeContent } from "./hash";
import { fetchOfficialSource } from "./fetcher";
import { enrichConsultation } from "./importer";
import { materializeProjectHistory } from "./project-history";
import { extractWithCache, FixtureSemanticProvider, type SemanticProvider } from "./semantic";

type SourceRow = {
  id: string; consultation_id: string; url: string; title: string; content_hash: string;
  fixture_path: string | null; consecutive_errors: number; live_content_hash: string | null;
  cadence: string; canonical_title: string;
};

export interface SourceCheckResult {
  sourceId: string;
  status: "unchanged" | "changed" | "live_baseline" | "failed";
  newEvents: number;
  semanticCalled: boolean;
  semanticError?: string;
  error?: string;
}

export class UpdateChecker {
  constructor(
    private db: DatabaseSync,
    private semanticProvider: SemanticProvider = new FixtureSemanticProvider(),
    private now: () => Date = () => new Date(),
  ) {}

  async checkConsultation(consultationId: string, live = false): Promise<SourceCheckResult[]> {
    const sources = this.db.prepare(`SELECT s.id, s.consultation_id, s.url, s.title, s.content_hash, s.fixture_path,
      s.consecutive_errors, s.live_content_hash, s.cadence, c.title canonical_title
      FROM source_documents s JOIN consultations c ON c.id = s.consultation_id
      WHERE s.consultation_id = ? ORDER BY s.id`).all(consultationId) as unknown as SourceRow[];
    if (sources.length === 0) throw new Error("Consultation has no sources or does not exist");
    const results: SourceCheckResult[] = [];
    for (const source of sources) results.push(await this.checkSource(source, live));
    if (live && results.some((result) => result.status === "changed") && sources.some((source) => !source.fixture_path)) {
      await enrichConsultation(this.db, consultationId, this.semanticProvider);
    }
    const latest = this.now().toISOString();
    this.db.prepare("UPDATE consultations SET last_checked_at = ? WHERE id = ?").run(latest, consultationId);
    return results;
  }

  async checkAll(live = false): Promise<SourceCheckResult[]> {
    const ids = this.db.prepare("SELECT id FROM consultations ORDER BY id").all() as unknown as Array<{ id: string }>;
    const output: SourceCheckResult[] = [];
    for (const { id } of ids) output.push(...await this.checkConsultation(id, live));
    return output;
  }

  private async checkSource(source: SourceRow, live: boolean): Promise<SourceCheckResult> {
    const started = this.now().toISOString();
    const runId = randomUUID();
    try {
      const raw = live ? await fetchOfficialSource(source.url) : source.fixture_path ? fs.readFileSync(source.fixture_path, "utf8") : (() => { throw new Error("No saved snapshot is configured for this source"); })();
      const nextHash = contentHash(raw);
      const previousHash = live ? (source.fixture_path ? source.live_content_hash : source.content_hash) : source.content_hash;
      if (live && !previousHash) {
        const finished = this.now().toISOString();
        this.db.prepare("UPDATE source_documents SET live_content_hash = ?, last_live_checked_at = ?, last_checked_at = ?, next_check_at = ?, check_status = 'success', consecutive_errors = 0 WHERE id = ?")
          .run(nextHash, finished, finished, this.nextCheck(source.cadence), source.id);
        this.insertRun(runId, source, started, finished, "success", null, nextHash, false, null, 0, "live");
        return { sourceId: source.id, status: "live_baseline", newEvents: 0, semanticCalled: false };
      }
      if (nextHash === previousHash) {
        const finished = this.now().toISOString();
        const nextCheck = this.nextCheck(source.cadence);
        if (live) this.db.prepare("UPDATE source_documents SET last_live_checked_at = ?, last_checked_at = ?, next_check_at = ?, check_status = 'success', consecutive_errors = 0 WHERE id = ?").run(finished, finished, nextCheck, source.id);
        else this.db.prepare("UPDATE source_documents SET last_checked_at = ?, next_check_at = ?, check_status = 'success', consecutive_errors = 0 WHERE id = ?").run(finished, nextCheck, source.id);
        this.insertRun(runId, source, started, finished, "success", previousHash, nextHash, false, null, 0, live ? "live" : "snapshot");
        return { sourceId: source.id, status: "unchanged", newEvents: 0, semanticCalled: false };
      }

      let semanticError: string | undefined;
      try {
        await extractWithCache(this.db, this.semanticProvider, { sourceDocumentId: source.id, contentHash: nextHash, text: normalizeContent(raw), canonicalTitle: source.canonical_title });
      } catch (error) {
        semanticError = error instanceof Error ? error.message : "Semantic analysis failed";
      }
      const eventId = `update-${source.id}-${nextHash.slice(0, 16)}`;
      const date = this.now().toISOString().slice(0, 10);
      const insert = this.db.prepare("INSERT OR IGNORE INTO timeline_events (id, consultation_id, event_type, title, description, event_date, stage, confidence, source_ids_json) VALUES (?, ?, 'source_update_detected', ?, ?, ?, 'New update', 'confirmed', ?)")
        .run(eventId, source.consultation_id, `New public update detected: ${source.title}`, "CivicLoop found a meaningful change in this official source. Review the original record for the new detail.", date, JSON.stringify([source.id]));
      const newEvents = Number(insert.changes);
      const finished = this.now().toISOString();
      const nextCheck = this.nextCheck(source.cadence);
      if (live) {
        if (source.fixture_path) {
          this.db.prepare("UPDATE source_documents SET live_content_hash = ?, last_live_checked_at = ?, last_checked_at = ?, last_changed_at = ?, next_check_at = ?, check_status = 'success', consecutive_errors = 0 WHERE id = ?")
            .run(nextHash, finished, finished, finished, nextCheck, source.id);
        } else {
          this.db.prepare("UPDATE source_documents SET extracted_text = ?, content_hash = ?, live_content_hash = ?, last_live_checked_at = ?, last_checked_at = ?, last_changed_at = ?, next_check_at = ?, check_status = 'success', consecutive_errors = 0 WHERE id = ?")
            .run(normalizeContent(raw), nextHash, nextHash, finished, finished, finished, nextCheck, source.id);
        }
      } else {
        this.db.prepare("UPDATE source_documents SET extracted_text = ?, content_hash = ?, last_checked_at = ?, last_changed_at = ?, next_check_at = ?, check_status = 'success', consecutive_errors = 0 WHERE id = ?")
          .run(normalizeContent(raw), nextHash, finished, finished, nextCheck, source.id);
      }
      materializeProjectHistory(this.db, source.consultation_id, source.id, normalizeContent(raw));
      this.db.prepare("UPDATE consultations SET latest_update_at = CASE WHEN latest_update_at < ? THEN ? ELSE latest_update_at END WHERE id = ?").run(date, date, source.consultation_id);
      if (newEvents > 0) this.db.prepare("INSERT OR IGNORE INTO notifications (id, consultation_id, event_id, kind, title, message, created_at) VALUES (?, ?, ?, 'source_changed', ?, ?, ?)")
        .run(`note-${eventId}`, source.consultation_id, eventId, "New official update found", `${source.title} changed. CivicLoop saved the update for review.`, finished);
      this.insertRun(runId, source, started, finished, "success", previousHash, nextHash, true, null, newEvents, live ? "live" : "snapshot");
      return { sourceId: source.id, status: "changed", newEvents, semanticCalled: true, semanticError };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown retrieval error";
      const finished = this.now().toISOString();
      this.db.prepare("UPDATE source_documents SET last_checked_at = ?, next_check_at = ?, check_status = 'failed', consecutive_errors = consecutive_errors + 1 WHERE id = ?").run(finished, this.retryAt(source.consecutive_errors + 1), source.id);
      this.insertRun(runId, source, started, finished, "failed", live ? source.live_content_hash : source.content_hash, null, false, message, 0, live ? "live" : "snapshot");
      return { sourceId: source.id, status: "failed", newEvents: 0, semanticCalled: false, error: message };
    }
  }

  private nextCheck(cadence: string) {
    const days = cadence === "daily" ? 1 : cadence === "monthly" ? 30 : 7;
    return new Date(this.now().getTime() + days * 24 * 60 * 60 * 1000).toISOString();
  }

  private retryAt(errors: number) {
    const hours = Math.min(24 * 7, 6 * (2 ** Math.max(0, errors - 1)));
    return new Date(this.now().getTime() + hours * 60 * 60 * 1000).toISOString();
  }

  private insertRun(id: string, source: SourceRow, started: string, finished: string, status: string, oldHash: string | null, newHash: string | null, changed: boolean, error: string | null, newEvents: number, mode: "snapshot" | "live") {
    this.db.prepare("INSERT INTO check_runs (id, consultation_id, source_id, started_at, finished_at, status, old_hash, new_hash, change_found, error, new_events, mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, source.consultation_id, source.id, started, finished, status, oldHash, newHash, changed ? 1 : 0, error, newEvents, mode);
  }
}
