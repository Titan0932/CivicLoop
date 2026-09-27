import Link from "next/link";
import { NotificationInboxControls, NotificationSettings } from "@/components/notification-settings";
import type { NotificationDelivery } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { getConsultations, getNotificationDeliveries, getNotificationPreferences, getTrackedConsultationIds } from "@/lib/queries";

export const dynamic = "force-dynamic";

function masked(destination: string | null, channel: NotificationDelivery["channel"]) {
  if (!destination || channel === "in_app") return "CivicLoop inbox";
  if (channel === "email") {
    const [name, domain] = destination.split("@");
    return `${name?.slice(0, 1) || "*"}•••@${domain || "hidden"}`;
  }
  return `••• ${destination.replace(/\D/g, "").slice(-4)}`;
}

export default function NotificationsPage() {
  const preferences = getNotificationPreferences();
  const deliveries = getNotificationDeliveries();
  const inApp = deliveries.filter((item) => item.channel === "in_app");
  const channelLog = deliveries.filter((item) => item.channel !== "in_app");
  const trackedIds = new Set(getTrackedConsultationIds());
  const tracked = getConsultations().filter((item) => trackedIds.has(item.id));
  const unread = inApp.filter((item) => !item.readAt).length;

  return <main id="main" className="calm-ui notification-main">
    <div className="notification-shell">
      <header className="notification-header"><div><span className="home-kicker">Your updates</span><h1>Notifications</h1><p>Only consultations in <strong>My tracking</strong> can notify you. Choose how those updates should reach you.</p></div><Link className="demo-link" href="/demo/notifications">Open demo console</Link></header>

      <section className="notification-overview" aria-label="Notification overview">
        <div><strong>{tracked.length}</strong><span>Tracked consultations</span><Link href="/">Manage tracking</Link></div>
        <div><strong>{unread}</strong><span>Unread in-app updates</span></div>
        <div><strong>{[preferences.inAppEnabled, preferences.emailEnabled, preferences.smsEnabled].filter(Boolean).length}</strong><span>Enabled channels</span></div>
      </section>

      <div className="notification-layout">
        <section className="notification-card inbox-card">
          <header><div><h2>In-app inbox</h2><p>New events from the cases you track.</p></div><NotificationInboxControls hasUnread={unread > 0} /></header>
          <div className="notification-list">
            {inApp.map((item) => <article key={item.id} className={!item.readAt ? "unread" : ""}><span className="notification-dot" aria-hidden="true" /><div><div className="notification-meta"><span>{item.consultationTitle}</span><time>{formatDate(item.createdAt)}</time></div><h3>{item.title}</h3><p>{item.message}</p><Link href={`/consultations/${item.consultationSlug}`}>View consultation →</Link></div></article>)}
            {inApp.length === 0 && <div className="empty-state compact"><strong>No notifications yet.</strong><span>Track a consultation, then use the demo console to publish a mock update.</span><Link href="/demo/notifications">Try the notification demo</Link></div>}
          </div>
        </section>

        <aside className="notification-card settings-card"><header><h2>Delivery preferences</h2><p>Email and SMS are recorded as simulated deliveries in this prototype.</p></header><NotificationSettings initial={preferences} /></aside>
      </div>

      <section className="notification-card delivery-log"><header><div><h2>Email and SMS delivery log</h2><p>A safe demo record of what the worker would send through external providers.</p></div></header>
        <div className="delivery-rows">{channelLog.map((item) => <article key={item.id}><span className={`channel-badge ${item.channel}`}>{item.channel.toUpperCase()}</span><div><strong>{item.title}</strong><small>{item.consultationTitle} · {masked(item.destination, item.channel)}</small></div><span className="delivery-status">{item.status}</span><time>{formatDate(item.createdAt)}</time></article>)}{channelLog.length === 0 && <p className="muted-empty">No simulated email or SMS deliveries yet.</p>}</div>
      </section>
    </div>
  </main>;
}
