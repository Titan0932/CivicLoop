import Link from "next/link";
import { DemoEventPublisher } from "@/components/demo-event-publisher";
import { getConsultations, getNotificationPreferences, getTrackedConsultationIds } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function NotificationDemoPage() {
  const trackedIds = new Set(getTrackedConsultationIds());
  const consultations = getConsultations().map((item) => ({ id: item.id, title: item.title, tracked: trackedIds.has(item.id) }));
  const preferences = getNotificationPreferences();
  const channels = [preferences.inAppEnabled && "in-app", preferences.emailEnabled && "email", preferences.smsEnabled && "SMS"].filter(Boolean);

  return <main id="main" className="calm-ui demo-main"><div className="demo-shell">
    <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/notifications">Notifications</Link><span aria-hidden="true">/</span><span>Demo console</span></nav>
    <header className="demo-header"><span className="home-kicker">Developer tool</span><h1>Notification event demo</h1><p>Publish a mock update to a consultation. CivicLoop stores the event, runs it through a notification worker, and immediately creates a delivery for each enabled channel.</p></header>

    <section className="event-pipeline" aria-label="Event delivery pipeline">
      <div><span>1</span><strong>Mock publisher</strong><small>Creates an update</small></div><i aria-hidden="true">→</i>
      <div><span>2</span><strong>Durable event</strong><small>Saved before delivery</small></div><i aria-hidden="true">→</i>
      <div><span>3</span><strong>Worker</strong><small>Finds subscribers</small></div><i aria-hidden="true">→</i>
      <div><span>4</span><strong>Channels</strong><small>{channels.length ? channels.join(" · ") : "none enabled"}</small></div>
    </section>

    <section className="demo-panel"><header><h2>Publish a consultation update</h2><p>The event and resulting deliveries remain in SQLite so the full flow is inspectable and replay-safe.</p></header><DemoEventPublisher consultations={consultations} /></section>
    <aside className="demo-note"><strong>What is real and what is simulated?</strong><p>The publisher, durable event record, subscriber lookup, worker, and in-app notification are functional. Email and SMS delivery are safely simulated until provider credentials are connected.</p></aside>
  </div></main>;
}
