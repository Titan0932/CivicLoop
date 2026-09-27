import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { LifecycleStatus, NotificationPreferences } from "./domain";

export const DEMO_USER_ID = "demo-user";

export interface PreferenceUpdate {
  email: string | null;
  phone: string | null;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
}

export function setConsultationTracking(db: DatabaseSync, consultationId: string, tracking: boolean, userId = DEMO_USER_ID) {
  const consultation = db.prepare("SELECT 1 FROM consultations WHERE id = ?").get(consultationId);
  if (!consultation) throw new Error("Consultation not found");
  if (tracking) {
    db.prepare("INSERT OR IGNORE INTO consultation_subscriptions (user_id, consultation_id, created_at) VALUES (?, ?, ?)")
      .run(userId, consultationId, new Date().toISOString());
  } else {
    db.prepare("DELETE FROM consultation_subscriptions WHERE user_id = ? AND consultation_id = ?").run(userId, consultationId);
  }
  return tracking;
}

export function updateNotificationPreferences(db: DatabaseSync, update: PreferenceUpdate, userId = DEMO_USER_ID) {
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO notification_preferences
    (user_id, display_name, email, phone, in_app_enabled, email_enabled, sms_enabled, updated_at)
    VALUES (?, 'Demo user', ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET email = excluded.email, phone = excluded.phone,
      in_app_enabled = excluded.in_app_enabled, email_enabled = excluded.email_enabled,
      sms_enabled = excluded.sms_enabled, updated_at = excluded.updated_at`)
    .run(userId, update.email, update.phone, update.inAppEnabled ? 1 : 0, update.emailEnabled ? 1 : 0, update.smsEnabled ? 1 : 0, now);
}

function enabledChannels(preferences: NotificationPreferences) {
  return [
    ...(preferences.inAppEnabled ? [{ channel: "in_app" as const, destination: "CivicLoop inbox" }] : []),
    ...(preferences.emailEnabled && preferences.email ? [{ channel: "email" as const, destination: preferences.email }] : []),
    ...(preferences.smsEnabled && preferences.phone ? [{ channel: "sms" as const, destination: preferences.phone }] : []),
  ];
}

function preferencesFromRow(row: Record<string, unknown>): NotificationPreferences {
  return {
    userId: String(row.user_id), displayName: String(row.display_name),
    email: row.email ? String(row.email) : null, phone: row.phone ? String(row.phone) : null,
    inAppEnabled: Boolean(row.in_app_enabled), emailEnabled: Boolean(row.email_enabled), smsEnabled: Boolean(row.sms_enabled),
    updatedAt: String(row.updated_at),
  };
}

export function processDomainEvent(db: DatabaseSync, eventId: string) {
  const event = db.prepare("SELECT * FROM domain_events WHERE id = ?").get(eventId) as Record<string, unknown> | undefined;
  if (!event) throw new Error("Domain event not found");
  if (event.status === "processed") {
    const total = db.prepare("SELECT COUNT(*) total FROM notification_deliveries WHERE event_id = ?").get(eventId) as { total: number };
    return { eventId, status: "processed" as const, deliveries: Number(total.total), subscribers: 0 };
  }
  const subscribers = db.prepare(`SELECT p.* FROM consultation_subscriptions s
    JOIN notification_preferences p ON p.user_id = s.user_id
    WHERE s.consultation_id = ?`).all(String(event.consultation_id)) as unknown as Array<Record<string, unknown>>;
  const now = new Date().toISOString();
  let deliveries = 0;
  try {
    for (const row of subscribers) {
      const preferences = preferencesFromRow(row);
      for (const item of enabledChannels(preferences)) {
        const status = item.channel === "in_app" ? "delivered" : "simulated";
        const insert = db.prepare(`INSERT OR IGNORE INTO notification_deliveries
          (id, event_id, consultation_id, user_id, channel, title, message, destination, status, created_at, delivered_at, read_at, error)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`)
          .run(randomUUID(), eventId, String(event.consultation_id), preferences.userId, item.channel,
            String(event.title), String(event.message), item.destination, status, now, now);
        deliveries += Number(insert.changes);
      }
    }
    db.prepare("UPDATE domain_events SET status = 'processed', processed_at = ?, error = NULL WHERE id = ?").run(now, eventId);
    return { eventId, status: "processed" as const, deliveries, subscribers: subscribers.length };
  } catch (error) {
    db.prepare("UPDATE domain_events SET status = 'failed', processed_at = ?, error = ? WHERE id = ?")
      .run(now, error instanceof Error ? error.message.slice(0, 1_000) : "Notification processing failed", eventId);
    throw error;
  }
}

export interface DemoEventInput {
  consultationId: string;
  title: string;
  message: string;
  lifecycleStatus?: LifecycleStatus | null;
}

export function publishDemoConsultationEvent(db: DatabaseSync, input: DemoEventInput) {
  const consultation = db.prepare("SELECT title, slug FROM consultations WHERE id = ?").get(input.consultationId) as { title: string; slug: string } | undefined;
  if (!consultation) throw new Error("Consultation not found");
  const eventId = randomUUID();
  const now = new Date().toISOString();
  const eventTitle = `[Demo] ${input.title}`;
  db.prepare(`INSERT INTO domain_events
    (id, consultation_id, event_type, title, message, payload_json, status, created_at, processed_at, error)
    VALUES (?, ?, 'demo_consultation_updated', ?, ?, ?, 'pending', ?, NULL, NULL)`)
    .run(eventId, input.consultationId, eventTitle, input.message,
      JSON.stringify({ consultationSlug: consultation.slug, lifecycleStatus: input.lifecycleStatus || null, simulated: true }), now);
  if (input.lifecycleStatus) db.prepare("UPDATE consultations SET status = ?, latest_update_at = ? WHERE id = ?").run(input.lifecycleStatus, now.slice(0, 10), input.consultationId);
  db.prepare(`INSERT OR IGNORE INTO notifications
    (id, consultation_id, event_id, kind, title, message, created_at)
    VALUES (?, ?, ?, 'source_changed', ?, ?, ?)`)
    .run(`note-demo-${eventId}`, input.consultationId, eventId, eventTitle, input.message, now);
  const outcome = processDomainEvent(db, eventId);
  return { ...outcome, consultationTitle: consultation.title, consultationSlug: consultation.slug, publishedAt: now };
}

export function markInAppNotificationsRead(db: DatabaseSync, userId = DEMO_USER_ID) {
  return Number(db.prepare("UPDATE notification_deliveries SET read_at = ? WHERE user_id = ? AND channel = 'in_app' AND read_at IS NULL")
    .run(new Date().toISOString(), userId).changes);
}
