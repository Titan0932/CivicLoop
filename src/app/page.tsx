import { Dashboard } from "@/components/dashboard";
import Link from "next/link";
import { ConsultationFinder } from "@/components/consultation-finder";
import { UpdateFeed } from "@/components/update-feed";
import { getConsultations, getDashboardStats, getRecentNotifications, getTrackedConsultationIds } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const consultations = getConsultations();
  const stats = getDashboardStats();
  const trackedIds = getTrackedConsultationIds();
  const notifications = getRecentNotifications();
  const activeCommitments = (stats.commitments.in_progress || 0) + (stats.commitments.planned || 0);
  return (
    <main id="main" className="home-main calm-ui">
      <section className="home-masthead">
        <div>
          <span className="home-kicker">Ottawa consultation tracker</span>
          <h1>Track the consultations you care about.</h1>
          <p>Your tracking list is personal. The directory contains every public consultation CivicLoop has found.</p>
        </div>
      </section>
      <section className="home-workspace">
        <nav className="view-nav" aria-label="Consultation tracker">
          <Link href="/" aria-current={!view || !["add", "updates"].includes(view) ? "page" : undefined}>Consultations <span>{stats.total}</span></Link>
          <Link href="/?view=updates" aria-current={view === "updates" ? "page" : undefined}>Recent activity</Link>
          <Link href="/?view=add" aria-current={view === "add" ? "page" : undefined}>Add a consultation</Link>
        </nav>
        {view === "add" ? <ConsultationFinder /> : view === "updates" ? <UpdateFeed notifications={notifications} /> : <><Dashboard consultations={consultations} trackedIds={trackedIds} /><p className="collection-note">{trackedIds.length} in your tracking list · {stats.implementation} in implementation · {activeCommitments} open commitments across the directory</p></>}
      </section>
    </main>
  );
}
