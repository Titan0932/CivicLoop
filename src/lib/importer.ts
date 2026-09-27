import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { discoverOfficialConsultation, type DiscoveryReport } from "./discovery";
import { reconcileDocumentedResponses } from "./feedback-reconciliation";
import { materializeProjectHistory } from "./project-history";
import { createDefaultSemanticProvider, extractWithCache, type SemanticProvider, type SemanticResult } from "./semantic";

type ExistingSource = { consultation_id: string; slug: string; url: string };

export interface ImportResult {
  existing: boolean;
  consultationId: string;
  slug: string;
  sourceCount: number;
  analysisCount: number;
  warnings: string[];
}

export interface ImportOptions {
  discover?: (url: string) => Promise<DiscoveryReport>;
  semanticProvider?: SemanticProvider | null;
  now?: () => Date;
}

export function normalizeOfficialUrl(value: string) {
  const url = new URL(value.trim());
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  const entries = [...url.searchParams.entries()].sort(([a, av], [b, bv]) => a.localeCompare(b) || av.localeCompare(bv));
  url.search = "";
  for (const [key, item] of entries) url.searchParams.append(key, item);
  return url.toString();
}

function token(value: string, length = 14) {
  return createHash("sha256").update(value).digest("hex").slice(0, length);
}

function slugify(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 68) || "community-consultation";
}

function uniqueSlug(db: DatabaseSync, title: string) {
  const base = slugify(title);
  let slug = base;
  let suffix = 2;
  while (db.prepare("SELECT 1 FROM consultations WHERE slug = ?").get(slug)) slug = `${base}-${suffix++}`;
  return slug;
}

function classifySource(title: string, sourceSystem: string, motionResult: string | null, isSeed: boolean) {
  const text = title.toLowerCase();
  if (/what we (heard|learned)|as.we.heard|results|feedback/.test(text)) return "consultation_results";
  if (/minutes|decision|council|committee/.test(text) || motionResult) return "decision";
  if (/implementation|construction|update/.test(text)) return "implementation_update";
  if (isSeed && sourceSystem === "Engage Ottawa") return "consultation_notice";
  return "other";
}

function statusFromAnalyses(results: SemanticResult[]) {
  const types = new Set(results.map((result) => result.documentType));
  if (types.has("implementation_update")) return "implementation_underway";
  if (types.has("decision")) return "approved";
  if (types.has("staff_report")) return "awaiting_decision";
  if (types.has("consultation_results")) return "results_published";
  if (types.has("consultation_notice")) return "open";
  return "no_recent_update";
}

function existingConsultation(db: DatabaseSync, normalizedUrl: string) {
  const rows = db.prepare("SELECT s.consultation_id, c.slug, s.url FROM source_documents s JOIN consultations c ON c.id = s.consultation_id").all() as unknown as ExistingSource[];
  return rows.find((row) => {
    try { return normalizeOfficialUrl(row.url) === normalizedUrl; } catch { return false; }
  });
}

function materializeAnalysis(db: DatabaseSync, consultationId: string, sourceId: string, result: SemanticResult, now: string) {
  for (const [index, theme] of result.feedbackThemes.entries()) {
    const hasDocumentedResponse = Boolean(theme.municipalResponse && theme.responseEvidence);
    const responseStatus = hasDocumentedResponse && theme.responseStatus === "no_public_response" ? "acknowledged" : theme.responseStatus;
    db.prepare(`INSERT OR IGNORE INTO feedback_themes
      (id, consultation_id, theme, summary, response_status, response, feedback_source_id, response_source_id, verification, evidence_excerpt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(`fb-${token(`${sourceId}:${index}:${theme.theme}`)}`, consultationId, theme.theme, theme.residentConcern, responseStatus,
        theme.municipalResponse || "No municipal response was found in this source.", sourceId, theme.responseEvidence ? sourceId : null,
        result.relationship.confidenceLabel, theme.feedbackEvidence.excerpt);
  }
  for (const [index, commitment] of result.commitments.entries()) {
    db.prepare(`INSERT OR IGNORE INTO commitments
      (id, consultation_id, action, owner, target_date, status, latest_status_at, source_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(`com-${token(`${sourceId}:${index}:${commitment.action}`)}`, consultationId, commitment.action,
        commitment.owner || "Not stated in the source", commitment.targetDate, commitment.status, now.slice(0, 10), sourceId);
  }
}

export async function enrichConsultation(db: DatabaseSync, consultationId: string, provider: SemanticProvider) {
  const consultation = db.prepare("SELECT title FROM consultations WHERE id = ?").get(consultationId) as { title: string } | undefined;
  if (!consultation) throw new Error("Consultation not found");
  const sources = db.prepare("SELECT id, title, extracted_text, content_hash FROM source_documents WHERE consultation_id = ? ORDER BY published_at, id")
    .all(consultationId) as unknown as Array<{ id: string; title: string; extracted_text: string; content_hash: string }>;
  const results: SemanticResult[] = [];
  const warnings: string[] = [];
  const analyzedAt = new Date().toISOString();
  db.prepare("UPDATE consultations SET build_status = 'analyzing', build_completed = 0, build_total = ?, build_error = NULL WHERE id = ?")
    .run(sources.length, consultationId);
  db.prepare("DELETE FROM feedback_themes WHERE consultation_id = ?").run(consultationId);
  db.prepare("DELETE FROM commitments WHERE consultation_id = ?").run(consultationId);
  for (const source of sources) {
    try {
      const extraction = await extractWithCache(db, provider, { sourceDocumentId: source.id, contentHash: source.content_hash, text: source.extracted_text, canonicalTitle: consultation.title });
      results.push(extraction.result);
      materializeAnalysis(db, consultationId, source.id, extraction.result, analyzedAt);
      materializeProjectHistory(db, consultationId, source.id, source.extracted_text);
    } catch (error) {
      warnings.push(`AI analysis for ${source.title}: ${error instanceof Error ? error.message : "analysis failed"}`);
    } finally {
      db.prepare("UPDATE consultations SET build_completed = build_completed + 1 WHERE id = ?").run(consultationId);
    }
  }
  reconcileDocumentedResponses(db, consultationId);
  if (results.length > 0) {
    const aliases = [...new Set(results.flatMap((result) => result.projectAliases.map((alias) => alias.alias)))];
    const summary = results.flatMap((result) => result.summary.points.map((point) => point.text)).slice(0, 2).join(" ");
    db.prepare("UPDATE consultations SET aliases_json = ?, summary = ?, status = ?, build_status = ?, build_error = ? WHERE id = ?")
      .run(JSON.stringify(aliases), summary || `Official records are now being tracked for ${consultation.title}.`, statusFromAnalyses(results),
        warnings.length ? "partial" : "ready", warnings.length ? warnings.join(" ").slice(0, 2_000) : null, consultationId);
  } else {
    db.prepare("UPDATE consultations SET build_status = 'failed', build_error = ? WHERE id = ?")
      .run(warnings.join(" ").slice(0, 2_000) || "No official source could be analyzed.", consultationId);
  }
  return { analysisCount: results.length, warnings };
}

export async function importOfficialConsultation(db: DatabaseSync, submittedUrl: string, options: ImportOptions = {}): Promise<ImportResult> {
  const now = options.now?.() || new Date();
  const requestedAt = now.toISOString();
  const normalizedUrl = normalizeOfficialUrl(submittedUrl);
  const requestId = randomUUID();
  db.prepare("INSERT INTO discovery_requests (id, submitted_url, normalized_url, status, requested_at) VALUES (?, ?, ?, 'processing', ?)")
    .run(requestId, submittedUrl, normalizedUrl, requestedAt);

  try {
    const existing = existingConsultation(db, normalizedUrl);
    if (existing) {
      db.prepare("UPDATE discovery_requests SET consultation_id = ?, status = 'existing' WHERE id = ?").run(existing.consultation_id, requestId);
      return { existing: true, consultationId: existing.consultation_id, slug: existing.slug, sourceCount: 0, analysisCount: 0, warnings: [] };
    }

    const discover = options.discover || discoverOfficialConsultation;
    const report = await discover(normalizedUrl);
    const successful = report.records.filter((record) => record.retrievalStatus === "success");
    if (successful.length === 0) throw new Error("No official records could be retrieved from that URL");

    const raced = existingConsultation(db, normalizedUrl);
    if (raced) {
      db.prepare("UPDATE discovery_requests SET consultation_id = ?, status = 'existing' WHERE id = ?").run(raced.consultation_id, requestId);
      return { existing: true, consultationId: raced.consultation_id, slug: raced.slug, sourceCount: 0, analysisCount: 0, warnings: [] };
    }

    const seed = successful[0];
    const consultationId = `con-community-${token(normalizedUrl)}`;
    const slug = uniqueSlug(db, seed.title);
    const date = requestedAt.slice(0, 10);
    const nextCheck = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const warnings = report.records.filter((record) => record.retrievalStatus === "failed").map((record) => `${record.title}: ${record.error || "retrieval failed"}`);

    db.prepare(`INSERT INTO consultations
      (id, slug, title, aliases_json, summary, topic, location, ward, department, opened_at, closed_at, status, latest_update_at, last_checked_at, match_label,
       build_status, build_completed, build_total, build_error)
      VALUES (?, ?, ?, '[]', ?, 'Community submitted', 'Ottawa', NULL, 'City of Ottawa', NULL, NULL, 'no_recent_update', ?, ?, ?, 'analyzing', 0, ?, NULL)`) 
      .run(consultationId, slug, seed.title, `A community-submitted case assembled from ${successful.length} directly linked official ${successful.length === 1 ? "record" : "records"}.`, date, requestedAt, successful.length > 1 ? "strong_match" : "needs_review", successful.length);

    const sourceIds: string[] = [];
    for (const [index, record] of successful.entries()) {
      const sourceId = `src-community-${token(record.url)}`;
      sourceIds.push(sourceId);
      const identifiers = record.identifiers.map((identifier) => ({ ...identifier, sourceUrl: record.url }));
      db.prepare(`INSERT OR IGNORE INTO source_documents
        (id, consultation_id, url, title, document_type, source_system, published_at, identifiers_json, extracted_text, content_hash,
         first_seen_at, last_checked_at, last_changed_at, next_check_at, cadence, check_status, consecutive_errors, fixture_path, live_content_hash, last_live_checked_at)
        VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 'weekly', 'success', 0, NULL, ?, ?)`)
        .run(sourceId, consultationId, record.url, record.title, classifySource(record.title, record.sourceSystem, record.motionResult, index === 0),
          record.sourceSystem, JSON.stringify(identifiers), record.extractedText, record.contentHash, requestedAt, requestedAt, requestedAt, nextCheck,
          record.contentHash, requestedAt);
      materializeProjectHistory(db, consultationId, sourceId, record.extractedText);
    }

    for (let index = 1; index < sourceIds.length; index += 1) {
      db.prepare(`INSERT OR IGNORE INTO relationships
        (id, source_id, target_id, relationship_type, confidence, signals_json, origin, human_verified)
        VALUES (?, ?, ?, 'directly_linked_official_record', 'strong_match', ?, 'deterministic', 0)`)
        .run(`rel-community-${token(`${sourceIds[index]}:${sourceIds[0]}`)}`, sourceIds[index], sourceIds[0],
          JSON.stringify([{ type: "official_direct_link", value: "This record was linked directly from the submitted official consultation page." }]));
    }

    const eventId = `evt-community-${token(normalizedUrl)}`;
    db.prepare(`INSERT OR IGNORE INTO timeline_events
      (id, consultation_id, event_type, title, description, event_date, stage, confidence, source_ids_json)
      VALUES (?, ?, 'tracking_started', 'Community requested this case', ?, ?, 'Discovery', 'confirmed', ?)`)
      .run(eventId, consultationId, `CivicLoop retrieved ${successful.length} directly linked official ${successful.length === 1 ? "record" : "records"} and began monitoring this consultation.`, date, JSON.stringify(sourceIds));

    const provider = options.semanticProvider === undefined ? createDefaultSemanticProvider() : options.semanticProvider;
    let analysisCount = 0;
    if (provider) {
      const enrichment = await enrichConsultation(db, consultationId, provider);
      analysisCount = enrichment.analysisCount;
      warnings.push(...enrichment.warnings);
    }

    db.prepare("INSERT OR IGNORE INTO notifications (id, consultation_id, event_id, kind, title, message, created_at) VALUES (?, ?, ?, 'case_added', ?, ?, ?)")
      .run(`note-${eventId}`, consultationId, eventId, "New consultation added", `${seed.title} was submitted by the community and is now being monitored.`, requestedAt);
    db.prepare("UPDATE discovery_requests SET consultation_id = ?, status = 'imported' WHERE id = ?").run(consultationId, requestId);

    return { existing: false, consultationId, slug, sourceCount: successful.length, analysisCount, warnings };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Consultation discovery failed";
    db.prepare("UPDATE discovery_requests SET status = 'failed', error = ? WHERE id = ?").run(message, requestId);
    throw error;
  }
}
