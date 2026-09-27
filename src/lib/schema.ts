import type { DatabaseSync } from "node:sqlite";

export function initializeSchema(db: DatabaseSync) {
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS consultations (
      id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, title TEXT NOT NULL,
      aliases_json TEXT NOT NULL, summary TEXT NOT NULL, topic TEXT NOT NULL,
      location TEXT NOT NULL, ward TEXT, department TEXT NOT NULL,
      opened_at TEXT, closed_at TEXT, status TEXT NOT NULL,
      latest_update_at TEXT NOT NULL, last_checked_at TEXT NOT NULL,
      match_label TEXT NOT NULL,
      build_status TEXT NOT NULL DEFAULT 'ready',
      build_completed INTEGER NOT NULL DEFAULT 0,
      build_total INTEGER NOT NULL DEFAULT 0,
      build_error TEXT
    );
    CREATE TABLE IF NOT EXISTS source_documents (
      id TEXT PRIMARY KEY, consultation_id TEXT NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
      url TEXT UNIQUE NOT NULL, title TEXT NOT NULL, document_type TEXT NOT NULL,
      source_system TEXT NOT NULL, published_at TEXT, identifiers_json TEXT NOT NULL,
      extracted_text TEXT NOT NULL, content_hash TEXT NOT NULL, first_seen_at TEXT NOT NULL,
      last_checked_at TEXT NOT NULL, last_changed_at TEXT NOT NULL, next_check_at TEXT NOT NULL,
      cadence TEXT NOT NULL, check_status TEXT NOT NULL, consecutive_errors INTEGER NOT NULL DEFAULT 0,
      fixture_path TEXT, live_content_hash TEXT, last_live_checked_at TEXT
    );
    CREATE TABLE IF NOT EXISTS relationships (
      id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
      target_id TEXT NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
      relationship_type TEXT NOT NULL, confidence TEXT NOT NULL, signals_json TEXT NOT NULL,
      origin TEXT NOT NULL, human_verified INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS timeline_events (
      id TEXT PRIMARY KEY, consultation_id TEXT NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL,
      event_date TEXT NOT NULL, stage TEXT NOT NULL, confidence TEXT NOT NULL,
      source_ids_json TEXT NOT NULL, UNIQUE(consultation_id, event_type, event_date, title)
    );
    CREATE TABLE IF NOT EXISTS feedback_themes (
      id TEXT PRIMARY KEY, consultation_id TEXT NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
      theme TEXT NOT NULL, summary TEXT NOT NULL, response_status TEXT NOT NULL,
      response TEXT NOT NULL, feedback_source_id TEXT NOT NULL, response_source_id TEXT,
      verification TEXT NOT NULL, evidence_excerpt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS commitments (
      id TEXT PRIMARY KEY, consultation_id TEXT NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
      action TEXT NOT NULL, owner TEXT NOT NULL, target_date TEXT, status TEXT NOT NULL,
      latest_status_at TEXT NOT NULL, source_id TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS check_runs (
      id TEXT PRIMARY KEY, consultation_id TEXT NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
      source_id TEXT, started_at TEXT NOT NULL, finished_at TEXT NOT NULL,
      status TEXT NOT NULL, old_hash TEXT, new_hash TEXT, change_found INTEGER NOT NULL,
      error TEXT, new_events INTEGER NOT NULL DEFAULT 0, mode TEXT NOT NULL DEFAULT 'snapshot'
    );
    CREATE TABLE IF NOT EXISTS semantic_cache (
      cache_key TEXT PRIMARY KEY, source_id TEXT NOT NULL, provider TEXT NOT NULL,
      schema_version TEXT NOT NULL, result_json TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS discovery_requests (
      id TEXT PRIMARY KEY, submitted_url TEXT NOT NULL, normalized_url TEXT NOT NULL,
      consultation_id TEXT REFERENCES consultations(id) ON DELETE SET NULL,
      status TEXT NOT NULL, requested_at TEXT NOT NULL, error TEXT
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY, consultation_id TEXT NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
      event_id TEXT, kind TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL,
      created_at TEXT NOT NULL, UNIQUE(event_id, kind)
    );
    CREATE TABLE IF NOT EXISTS notification_preferences (
      user_id TEXT PRIMARY KEY, display_name TEXT NOT NULL,
      email TEXT, phone TEXT,
      in_app_enabled INTEGER NOT NULL DEFAULT 1,
      email_enabled INTEGER NOT NULL DEFAULT 0,
      sms_enabled INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS consultation_subscriptions (
      user_id TEXT NOT NULL,
      consultation_id TEXT NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, consultation_id)
    );
    CREATE TABLE IF NOT EXISTS domain_events (
      id TEXT PRIMARY KEY,
      consultation_id TEXT NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL,
      payload_json TEXT NOT NULL, status TEXT NOT NULL,
      created_at TEXT NOT NULL, processed_at TEXT, error TEXT
    );
    CREATE TABLE IF NOT EXISTS notification_deliveries (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES domain_events(id) ON DELETE CASCADE,
      consultation_id TEXT NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL, channel TEXT NOT NULL,
      title TEXT NOT NULL, message TEXT NOT NULL,
      destination TEXT, status TEXT NOT NULL,
      created_at TEXT NOT NULL, delivered_at TEXT, read_at TEXT,
      error TEXT, UNIQUE(event_id, user_id, channel)
    );
    CREATE INDEX IF NOT EXISTS idx_sources_consultation ON source_documents(consultation_id);
    CREATE INDEX IF NOT EXISTS idx_events_consultation ON timeline_events(consultation_id, event_date);
    CREATE INDEX IF NOT EXISTS idx_checks_consultation ON check_runs(consultation_id, started_at);
    CREATE INDEX IF NOT EXISTS idx_discovery_url ON discovery_requests(normalized_url, requested_at);
    CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sources_next_check ON source_documents(next_check_at);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON consultation_subscriptions(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_domain_events_status ON domain_events(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_deliveries_user_created ON notification_deliveries(user_id, created_at DESC);
  `);
  db.prepare(`INSERT OR IGNORE INTO notification_preferences
    (user_id, display_name, email, phone, in_app_enabled, email_enabled, sms_enabled, updated_at)
    VALUES ('demo-user', 'Demo user', NULL, NULL, 1, 0, 0, datetime('now'))`).run();
  const sourceColumns = db.prepare("PRAGMA table_info(source_documents)").all() as unknown as Array<{ name: string }>;
  if (!sourceColumns.some((column) => column.name === "live_content_hash")) db.exec("ALTER TABLE source_documents ADD COLUMN live_content_hash TEXT");
  if (!sourceColumns.some((column) => column.name === "last_live_checked_at")) db.exec("ALTER TABLE source_documents ADD COLUMN last_live_checked_at TEXT");
  const checkColumns = db.prepare("PRAGMA table_info(check_runs)").all() as unknown as Array<{ name: string }>;
  if (!checkColumns.some((column) => column.name === "mode")) db.exec("ALTER TABLE check_runs ADD COLUMN mode TEXT NOT NULL DEFAULT 'snapshot'");
  const consultationColumns = db.prepare("PRAGMA table_info(consultations)").all() as unknown as Array<{ name: string }>;
  if (!consultationColumns.some((column) => column.name === "build_status")) db.exec("ALTER TABLE consultations ADD COLUMN build_status TEXT NOT NULL DEFAULT 'ready'");
  if (!consultationColumns.some((column) => column.name === "build_completed")) db.exec("ALTER TABLE consultations ADD COLUMN build_completed INTEGER NOT NULL DEFAULT 0");
  if (!consultationColumns.some((column) => column.name === "build_total")) db.exec("ALTER TABLE consultations ADD COLUMN build_total INTEGER NOT NULL DEFAULT 0");
  if (!consultationColumns.some((column) => column.name === "build_error")) db.exec("ALTER TABLE consultations ADD COLUMN build_error TEXT");
  db.exec("PRAGMA optimize");
}
