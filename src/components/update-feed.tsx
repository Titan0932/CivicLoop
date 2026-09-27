import Link from "next/link";
import type { ActivityNotification } from "@/lib/domain";
import { formatDate } from "@/lib/format";

export function UpdateFeed({ notifications }: { notifications: ActivityNotification[] }) {
  return <section id="updates" className="update-feed" aria-labelledby="updates-heading">
    <div className="update-feed-heading"><div><span>Monitoring activity</span><h2 id="updates-heading">Recent updates</h2></div><p>New cases and changes found in official records appear here.</p></div>
    {notifications.length === 0 ? <div className="update-empty">No new activity has been recorded yet. Saved projects remain available below.</div> : <ol>{notifications.map((notification) => <li key={notification.id}><time dateTime={notification.createdAt}>{formatDate(notification.createdAt)}</time><div><strong>{notification.title}</strong><p>{notification.message}</p><Link href={`/consultations/${notification.consultationSlug}`}>{notification.consultationTitle}</Link></div></li>)}</ol>}
  </section>;
}
