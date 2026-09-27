import type { DatabaseSync } from "node:sqlite";
import { getDb } from "./db";
import { semanticSchemaVersion, SemanticResultSchema, type SemanticResult } from "./semantic";
import type {
  CheckRun,
  Commitment,
  ConsultationDetail,
  ConsultationSummary,
  FeedbackTheme,
  Relationship,
  SourceDocument,
  TimelineEvent,
  ActivityNotification,
  NotificationDelivery,
  NotificationPreferences,
} from "./domain";
import { DEMO_USER_ID } from "./notifications";

type Row = Record<string, string | number | null>;
const rows = (value: unknown) => value as Row[];

function consultationFromRow(row: Row): ConsultationSummary {
  return {
    id: String(row.id), slug: String(row.slug), title: String(row.title),
    aliases: JSON.parse(String(row.aliases_json)) as string[], summary: String(row.summary),
    topic: String(row.topic), location: String(row.location), ward: row.ward ? String(row.ward) : null,
    department: String(row.department), openedAt: row.opened_at ? String(row.opened_at) : null,
    closedAt: row.closed_at ? String(row.closed_at) : null,
    status: String(row.status) as ConsultationSummary["status"], latestUpdateAt: String(row.latest_update_at),
    lastCheckedAt: String(row.last_checked_at), matchLabel: String(row.match_label) as ConsultationSummary["matchLabel"],
    buildStatus: String(row.build_status || "ready") as ConsultationSummary["buildStatus"],
    buildCompleted: Number(row.build_completed || 0), buildTotal: Number(row.build_total || 0),
    buildError: row.build_error ? String(row.build_error) : null,
  };
}

function sourceFromRow(row: Row): SourceDocument {
  return {
    id: String(row.id), consultationId: String(row.consultation_id), url: String(row.url), title: String(row.title),
    documentType: String(row.document_type), sourceSystem: String(row.source_system),
    publishedAt: row.published_at ? String(row.published_at) : null,
    identifiers: JSON.parse(String(row.identifiers_json)), contentHash: String(row.content_hash),
    firstSeenAt: String(row.first_seen_at), lastCheckedAt: String(row.last_checked_at),
    lastChangedAt: String(row.last_changed_at), nextCheckAt: String(row.next_check_at), cadence: String(row.cadence),
    checkStatus: String(row.check_status), consecutiveErrors: Number(row.consecutive_errors),
    fixturePath: row.fixture_path ? String(row.fixture_path) : null,
    liveContentHash: row.live_content_hash ? String(row.live_content_hash) : null,
    lastLiveCheckedAt: row.last_live_checked_at ? String(row.last_live_checked_at) : null,
  };
}

export function getConsultations(db: DatabaseSync = getDb()): ConsultationSummary[] {
  return rows(db.prepare("SELECT * FROM consultations ORDER BY latest_update_at DESC").all()).map(consultationFromRow);
}

export function getConsultationBySlug(slug: string, db: DatabaseSync = getDb()): ConsultationDetail | null {
  const raw = db.prepare("SELECT * FROM consultations WHERE slug = ?").get(slug) as Row | undefined;
  if (!raw) return null;
  const consultation = consultationFromRow(raw);
  const sources = rows(db.prepare("SELECT * FROM source_documents WHERE consultation_id = ? ORDER BY published_at").all(consultation.id)).map(sourceFromRow);
  const events = rows(db.prepare(`SELECT * FROM timeline_events
    WHERE consultation_id = ? AND event_type NOT IN ('tracking_started', 'demo_notification', 'source_update_detected')
    ORDER BY event_date DESC`).all(consultation.id)).map((row): TimelineEvent => ({
    id: String(row.id), consultationId: String(row.consultation_id), eventType: String(row.event_type), title: String(row.title),
    description: String(row.description), eventDate: String(row.event_date), stage: String(row.stage),
    confidence: String(row.confidence) as TimelineEvent["confidence"], sourceIds: JSON.parse(String(row.source_ids_json)),
  }));
  const feedback = rows(db.prepare("SELECT * FROM feedback_themes WHERE consultation_id = ?").all(consultation.id)).map((row): FeedbackTheme => ({
    id: String(row.id), theme: String(row.theme), summary: String(row.summary),
    responseStatus: String(row.response_status) as FeedbackTheme["responseStatus"], response: String(row.response),
    feedbackSourceId: String(row.feedback_source_id), responseSourceId: row.response_source_id ? String(row.response_source_id) : null,
    verification: String(row.verification) as FeedbackTheme["verification"], evidenceExcerpt: String(row.evidence_excerpt),
  }));
  const commitments = rows(db.prepare("SELECT * FROM commitments WHERE consultation_id = ?").all(consultation.id)).map((row): Commitment => ({
    id: String(row.id), action: String(row.action), owner: String(row.owner), targetDate: row.target_date ? String(row.target_date) : null,
    status: String(row.status) as Commitment["status"], latestStatusAt: String(row.latest_status_at), sourceId: String(row.source_id),
  }));
  const sourceIds = sources.map((source) => source.id);
  const relationships = sourceIds.length === 0 ? [] : rows(db.prepare(`SELECT * FROM relationships WHERE source_id IN (${sourceIds.map(() => "?").join(",")}) OR target_id IN (${sourceIds.map(() => "?").join(",")})`).all(...sourceIds, ...sourceIds)).map((row): Relationship => ({
    id: String(row.id), sourceId: String(row.source_id), targetId: String(row.target_id), relationshipType: String(row.relationship_type),
    confidence: String(row.confidence) as Relationship["confidence"], signals: JSON.parse(String(row.signals_json)),
    origin: String(row.origin) as Relationship["origin"], humanVerified: Boolean(row.human_verified),
  }));
  const checkRuns = rows(db.prepare("SELECT * FROM check_runs WHERE consultation_id = ? ORDER BY started_at DESC LIMIT 8").all(consultation.id)).map((row): CheckRun => ({
    id: String(row.id), consultationId: String(row.consultation_id), sourceId: row.source_id ? String(row.source_id) : null,
    startedAt: String(row.started_at), finishedAt: String(row.finished_at), status: String(row.status) as CheckRun["status"],
    changeFound: Boolean(row.change_found), error: row.error ? String(row.error) : null, newEvents: Number(row.new_events),
    mode: (row.mode ? String(row.mode) : "snapshot") as CheckRun["mode"],
  }));
  return { ...consultation, sources, events, feedback, commitments, relationships, checkRuns };
}

export function getConsultationById(id: string, db: DatabaseSync = getDb()): ConsultationSummary | null {
  const raw = db.prepare("SELECT * FROM consultations WHERE id = ?").get(id) as Row | undefined;
  return raw ? consultationFromRow(raw) : null;
}

export function getSourcesForConsultation(id: string, db: DatabaseSync = getDb()): SourceDocument[] {
  return rows(db.prepare("SELECT * FROM source_documents WHERE consultation_id = ? ORDER BY published_at").all(id)).map(sourceFromRow);
}

export function getDashboardStats(db: DatabaseSync = getDb()) {
  const consultations = getConsultations(db);
  const commitmentRows = rows(db.prepare("SELECT status, COUNT(*) total FROM commitments GROUP BY status").all());
  const commitments = Object.fromEntries(commitmentRows.map((row) => [String(row.status), Number(row.total)]));
  return {
    total: consultations.length,
    tracked: getTrackedConsultationIds(DEMO_USER_ID, db).length,
    implementation: consultations.filter((item) => item.status === "implementation_underway").length,
    verified: consultations.filter((item) => item.matchLabel === "verified").length,
    commitments,
  };
}

export function getRecentNotifications(limit = 8, db: DatabaseSync = getDb()): ActivityNotification[] {
  return rows(db.prepare(`SELECT n.*, c.slug consultation_slug, c.title consultation_title
    FROM notifications n JOIN consultations c ON c.id = n.consultation_id
    ORDER BY n.created_at DESC LIMIT ?`).all(limit)).map((row) => ({
      id: String(row.id), consultationId: String(row.consultation_id), consultationSlug: String(row.consultation_slug),
      consultationTitle: String(row.consultation_title), kind: String(row.kind) as ActivityNotification["kind"],
      title: String(row.title), message: String(row.message), createdAt: String(row.created_at),
    }));
}

export function getTrackedConsultationIds(userId = DEMO_USER_ID, db: DatabaseSync = getDb()) {
  return rows(db.prepare("SELECT consultation_id FROM consultation_subscriptions WHERE user_id = ? ORDER BY created_at DESC").all(userId))
    .map((row) => String(row.consultation_id));
}

export function isConsultationTracked(consultationId: string, userId = DEMO_USER_ID, db: DatabaseSync = getDb()) {
  return Boolean(db.prepare("SELECT 1 FROM consultation_subscriptions WHERE user_id = ? AND consultation_id = ?").get(userId, consultationId));
}

export function getNotificationPreferences(userId = DEMO_USER_ID, db: DatabaseSync = getDb()): NotificationPreferences {
  const row = db.prepare("SELECT * FROM notification_preferences WHERE user_id = ?").get(userId) as Row | undefined;
  if (!row) throw new Error("Notification preferences are unavailable");
  return {
    userId: String(row.user_id), displayName: String(row.display_name), email: row.email ? String(row.email) : null,
    phone: row.phone ? String(row.phone) : null, inAppEnabled: Boolean(row.in_app_enabled),
    emailEnabled: Boolean(row.email_enabled), smsEnabled: Boolean(row.sms_enabled), updatedAt: String(row.updated_at),
  };
}

export function getNotificationDeliveries(limit = 30, userId = DEMO_USER_ID, db: DatabaseSync = getDb()): NotificationDelivery[] {
  return rows(db.prepare(`SELECT d.*, c.slug consultation_slug, c.title consultation_title
    FROM notification_deliveries d JOIN consultations c ON c.id = d.consultation_id
    WHERE d.user_id = ? ORDER BY d.created_at DESC LIMIT ?`).all(userId, limit)).map((row) => ({
      id: String(row.id), eventId: String(row.event_id), consultationId: String(row.consultation_id),
      consultationSlug: String(row.consultation_slug), consultationTitle: String(row.consultation_title),
      channel: String(row.channel) as NotificationDelivery["channel"], title: String(row.title), message: String(row.message),
      destination: row.destination ? String(row.destination) : null, status: String(row.status) as NotificationDelivery["status"],
      createdAt: String(row.created_at), deliveredAt: row.delivered_at ? String(row.delivered_at) : null,
      readAt: row.read_at ? String(row.read_at) : null,
    }));
}

export function getUnreadNotificationCount(userId = DEMO_USER_ID, db: DatabaseSync = getDb()) {
  const row = db.prepare("SELECT COUNT(*) total FROM notification_deliveries WHERE user_id = ? AND channel = 'in_app' AND read_at IS NULL").get(userId) as { total: number };
  return Number(row.total);
}

export interface SemanticAnalysisView {
  sourceId: string;
  sourceTitle: string;
  sourceUrl: string;
  provider: string;
  analyzedAt: string;
  result: SemanticResult;
}

export function getSemanticAnalyses(consultationId: string, db: DatabaseSync = getDb()): SemanticAnalysisView[] {
  const raw = rows(db.prepare(`
    SELECT sc.source_id, sc.provider, sc.result_json, sc.created_at, sd.title source_title, sd.url source_url
    FROM semantic_cache sc JOIN source_documents sd ON sd.id = sc.source_id
    WHERE sd.consultation_id = ? AND sc.schema_version = ?
    ORDER BY sc.created_at DESC
  `).all(consultationId, semanticSchemaVersion));
  const seen = new Set<string>();
  const output: SemanticAnalysisView[] = [];
  for (const row of raw) {
    const key = `${row.source_id}:${row.provider}`;
    if (seen.has(key)) continue;
    try {
      output.push({
        sourceId: String(row.source_id), sourceTitle: String(row.source_title), sourceUrl: String(row.source_url),
        provider: String(row.provider), analyzedAt: String(row.created_at),
        result: SemanticResultSchema.parse(JSON.parse(String(row.result_json))),
      });
      seen.add(key);
    } catch {
      // Ignore stale or invalid cache entries; the analysis command can regenerate them.
    }
  }
  return output;
}
