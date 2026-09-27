import { describe, expect, test } from "vitest";
import { createMemoryDb } from "@/lib/db";
import { publishDemoConsultationEvent, setConsultationTracking, updateNotificationPreferences } from "@/lib/notifications";
import { getConsultationBySlug, getNotificationDeliveries, getTrackedConsultationIds } from "@/lib/queries";
import { seedDatabase } from "@/lib/seed";

describe("tracking and event-driven notifications", () => {
  test("fans a durable consultation event out to enabled subscriber channels", () => {
    const db = createMemoryDb();
    seedDatabase(db);
    setConsultationTracking(db, "con-field-street", true);
    updateNotificationPreferences(db, {
      email: "demo@example.test", phone: "+1 613 555 0123",
      inAppEnabled: true, emailEnabled: true, smsEnabled: true,
    });

    const timelineBefore = getConsultationBySlug("field-street-sidewalk", db)?.events.length;
    const outcome = publishDemoConsultationEvent(db, {
      consultationId: "con-field-street",
      title: "Construction schedule posted",
      message: "A mock construction schedule is now available.",
    });
    const deliveries = getNotificationDeliveries(10, undefined, db);

    expect(outcome).toMatchObject({ status: "processed", subscribers: 1, deliveries: 3 });
    expect(deliveries.map((item) => item.channel).sort()).toEqual(["email", "in_app", "sms"]);
    expect(deliveries.find((item) => item.channel === "in_app")?.status).toBe("delivered");
    expect(deliveries.filter((item) => item.channel !== "in_app").every((item) => item.status === "simulated")).toBe(true);
    expect((db.prepare("SELECT status FROM domain_events WHERE id = ?").get(outcome.eventId) as { status: string }).status).toBe("processed");
    expect(getConsultationBySlug("field-street-sidewalk", db)?.events.length).toBe(timelineBefore);
  });

  test("untracking stops future deliveries without removing the directory case", () => {
    const db = createMemoryDb();
    seedDatabase(db);
    setConsultationTracking(db, "con-field-street", true);
    setConsultationTracking(db, "con-field-street", false);

    const outcome = publishDemoConsultationEvent(db, {
      consultationId: "con-field-street",
      title: "Another update",
      message: "This event has no subscribers.",
    });

    expect(outcome.deliveries).toBe(0);
    expect(getTrackedConsultationIds(undefined, db)).toEqual([]);
    expect((db.prepare("SELECT COUNT(*) total FROM consultations WHERE id = 'con-field-street'").get() as { total: number }).total).toBe(1);
  });
});
