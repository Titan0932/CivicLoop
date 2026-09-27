"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ConsultationSummary } from "@/lib/domain";
import { formatDate, statusLabels } from "@/lib/format";

type Collection = "tracked" | "directory";

export function Dashboard({ consultations, trackedIds }: { consultations: ConsultationSummary[]; trackedIds: string[] }) {
  const router = useRouter();
  const [collection, setCollection] = useState<Collection>("tracked");
  const [tracked, setTracked] = useState(() => new Set(trackedIds));
  const [pending, setPending] = useState(() => new Set<string>());
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [topic, setTopic] = useState("all");
  const [status, setStatus] = useState("all");
  const topics = [...new Set(consultations.map((item) => item.topic))];

  const filtered = useMemo(() => consultations.filter((item) => {
    if (collection === "tracked" && !tracked.has(item.id)) return false;
    const haystack = `${item.title} ${item.aliases.join(" ")} ${item.summary} ${item.location}`.toLowerCase();
    return haystack.includes(search.toLowerCase()) && (topic === "all" || item.topic === topic) && (status === "all" || item.status === status);
  }), [collection, consultations, search, status, topic, tracked]);

  useEffect(() => {
    if (!consultations.some((item) => item.buildStatus === "analyzing")) return;
    const timer = window.setInterval(() => router.refresh(), 2_500);
    return () => window.clearInterval(timer);
  }, [consultations, router]);

  function clearFilters() {
    setSearch("");
    setTopic("all");
    setStatus("all");
  }

  async function toggleTracking(item: ConsultationSummary) {
    if (pending.has(item.id)) return;
    const next = !tracked.has(item.id);
    setTrackingError(null);
    setPending((current) => new Set(current).add(item.id));
    try {
      const response = await fetch(`/api/tracking/${item.id}`, { method: next ? "POST" : "DELETE" });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Tracking could not be updated");
      setTracked((current) => {
        const updated = new Set(current);
        if (next) updated.add(item.id); else updated.delete(item.id);
        return updated;
      });
      router.refresh();
    } catch (cause) {
      setTrackingError(cause instanceof Error ? cause.message : "Tracking could not be updated");
    } finally {
      setPending((current) => {
        const updated = new Set(current);
        updated.delete(item.id);
        return updated;
      });
    }
  }

  return (
    <>
      <section className="collection-switcher" aria-label="Choose consultation collection">
        <button className={collection === "tracked" ? "active" : ""} onClick={() => { setCollection("tracked"); clearFilters(); }} aria-pressed={collection === "tracked"}>
          <span>My tracking</span><strong>{tracked.size}</strong><small>Consultations you chose to follow</small>
        </button>
        <button className={collection === "directory" ? "active" : ""} onClick={() => { setCollection("directory"); clearFilters(); }} aria-pressed={collection === "directory"}>
          <span>All consultations</span><strong>{consultations.length}</strong><small>Every case in CivicLoop’s directory</small>
        </button>
      </section>

      <section className="filter-bar" aria-label="Filter consultations">
        <label className="search-field"><span className="sr-only">Search consultations</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by project or neighbourhood" /></label>
        <details className="filter-options"><summary><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4" /></svg><span>Filters{topic !== "all" || status !== "all" ? " · active" : ""}</span></summary><div>
          <label><span className="sr-only">Topic</span><select value={topic} onChange={(event) => setTopic(event.target.value)}><option value="all">All topics</option>{topics.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span className="sr-only">Lifecycle status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All stages</option>{[...new Set(consultations.map((item) => item.status))].map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}</select></label>
        </div></details>
        {(search || topic !== "all" || status !== "all") && <button className="clear-button" onClick={clearFilters}>Clear</button>}
      </section>

      <div className="list-heading">
        <div><h2>{collection === "tracked" ? "My tracked consultations" : "Consultation directory"}</h2><p>{collection === "tracked" ? "Updates to these cases can trigger your notifications." : "Track a case to add it to your personal watchlist."}</p></div>
        <span aria-live="polite">{filtered.length} {filtered.length === 1 ? "result" : "results"}</span>
      </div>
      {trackingError && <div className="inline-error" role="alert">{trackingError}</div>}
      <section className="decision-list">
        {filtered.map((item) => {
          const isTracked = tracked.has(item.id);
          const isPending = pending.has(item.id);
          return <article className={`decision-row decision-${item.topic.toLowerCase().replaceAll(/[^a-z]+/g, "-")}`} key={item.id}>
            <div className="decision-main">
              <div className="decision-meta"><span>{item.location}</span>{isTracked && <span className="tracking-label">Tracking</span>}</div>
              <h3><Link href={`/consultations/${item.slug}`}>{item.title}</Link></h3>
              <p>{item.summary}</p>
            </div>
            <div className="decision-progress">
              {item.buildStatus === "analyzing"
                ? <><strong className="status-pill status-building"><span className="build-spinner" aria-hidden="true" /> Building case</strong><small>{item.buildCompleted} of {item.buildTotal} records reviewed</small></>
                : <><strong className={`status-pill status-${item.status}`}>{statusLabels[item.status]}</strong><small>Updated {formatDate(item.latestUpdateAt)}</small></>}
            </div>
            <div className="decision-actions">
              <button className={`follow-button ${isTracked ? "is-following" : ""}`} onClick={() => toggleTracking(item)} disabled={isPending} aria-pressed={isTracked} aria-label={`${isTracked ? "Stop tracking" : "Track"} ${item.title}`}>
                <svg aria-hidden="true" viewBox="0 0 24 24">{isTracked ? <path d="m5 12 4 4L19 6" /> : <path d="M12 5v14M5 12h14" />}</svg>
                {isPending ? "Updating…" : isTracked ? "Tracking" : "Track"}
              </button>
              <Link className="decision-link" href={`/consultations/${item.slug}`}>View case <span aria-hidden="true">→</span></Link>
            </div>
          </article>;
        })}
        {filtered.length === 0 && collection === "tracked" && tracked.size === 0
          ? <div className="empty-state tracking-empty"><strong>Your tracking list is empty.</strong><span>Browse the directory and track the consultations you care about. CivicLoop will then know which updates belong in your notification inbox.</span><button onClick={() => setCollection("directory")}>Browse all consultations</button></div>
          : filtered.length === 0 && <div className="empty-state"><strong>No consultations match those filters.</strong><span>Try a broader search or clear the filters.</span></div>}
      </section>
    </>
  );
}
