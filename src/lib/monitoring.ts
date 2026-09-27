import type { DatabaseSync } from "node:sqlite";
import type { SemanticProvider } from "./semantic";
import { UpdateChecker, type SourceCheckResult } from "./update-checker";

export interface MonitoringResult {
  checkedConsultations: number;
  checkedSources: number;
  changedSources: number;
  failedSources: number;
  results: SourceCheckResult[];
}

export async function runMonitoringCycle(
  db: DatabaseSync,
  provider: SemanticProvider,
  options: { now?: Date; includeAll?: boolean; live?: boolean } = {},
): Promise<MonitoringResult> {
  const now = options.now || new Date();
  const ids = db.prepare(options.includeAll
    ? "SELECT id FROM consultations ORDER BY id"
    : `SELECT DISTINCT c.id FROM consultations c JOIN source_documents s ON s.consultation_id = c.id
       WHERE s.next_check_at <= ? ORDER BY c.id`)
    .all(...(options.includeAll ? [] : [now.toISOString()])) as unknown as Array<{ id: string }>;
  const checker = new UpdateChecker(db, provider, () => now);
  const results: SourceCheckResult[] = [];
  for (const { id } of ids) results.push(...await checker.checkConsultation(id, options.live !== false));
  return {
    checkedConsultations: ids.length,
    checkedSources: results.length,
    changedSources: results.filter((result) => result.status === "changed").length,
    failedSources: results.filter((result) => result.status === "failed").length,
    results,
  };
}
