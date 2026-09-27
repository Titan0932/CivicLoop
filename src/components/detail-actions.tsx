"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFollow } from "./use-follow";

export function DetailActions({ consultationId, title, initialTracking }: { consultationId: string; title: string; initialTracking: boolean }) {
  const { following, toggle, pending, error } = useFollow(consultationId, initialTracking);

  return (
    <div className="detail-actions">
      <button className={`save-button ${following ? "is-following" : ""}`} onClick={toggle} disabled={pending} aria-pressed={following} aria-label={`${following ? "Stop tracking" : "Track updates for"} ${title}`}>
        <svg aria-hidden="true" viewBox="0 0 24 24">{following ? <path d="m5 12 4 4L19 6" /> : <path d="M12 5v14M5 12h14" />}</svg>
        <span>{pending ? "Updating…" : following ? "Tracking" : "Track updates"}</span>
      </button>
      {error && <small className="action-error" role="alert">{error}</small>}
    </div>
  );
}

export function DataFreshnessAction({ consultationId }: { consultationId: string }) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState<{ kind: string; message: string } | null>(null);

  async function check() {
    setChecking(true); setNotice(null);
    try {
      const response = await fetch(`/api/consultations/${consultationId}/check`, { method: "POST" });
      const body = await response.json() as { outcome?: string; message?: string; error?: string };
      if (!response.ok) throw new Error(body.error || "Check could not be completed");
      setNotice({ kind: body.outcome || "unchanged", message: body.message || "Check complete." });
      router.refresh();
    } catch (error) {
      setNotice({ kind: "failed", message: error instanceof Error ? error.message : "Check could not be completed" });
    } finally { setChecking(false); }
  }

  return (
    <div className="freshness-action">
      <button className="text-button" onClick={check} disabled={checking}><svg className={checking ? "spin" : ""} aria-hidden="true" viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.34 5.66M20 5v6h-6" /></svg>{checking ? "Syncing…" : "Sync now"}</button>
      {notice && <div className={`check-notice ${notice.kind}`} role="status"><strong>{notice.kind === "unchanged" ? "Checked—no change" : notice.kind === "changed" ? "New update found" : "Check failed"}</strong><span>{notice.message}</span></div>}
    </div>
  );
}

export function CaseBuildStatus({
  status,
  completed,
  total,
}: {
  status: "ready" | "analyzing" | "partial" | "failed";
  completed: number;
  total: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (status !== "analyzing") return;
    const timer = window.setInterval(() => router.refresh(), 2_500);
    return () => window.clearInterval(timer);
  }, [router, status]);

  if (status === "ready") return null;
  const active = status === "analyzing";
  const title = active ? "Building this case" : status === "partial" ? "Case built with some gaps" : "Case analysis could not finish";
  const detail = active
    ? `${completed} of ${total} official ${total === 1 ? "record" : "records"} reviewed. New findings will appear here automatically.`
    : status === "partial"
      ? `${completed} of ${total} official ${total === 1 ? "record was" : "records were"} reviewed. Some information may still be missing.`
      : "The official records are saved, but the plain-language analysis needs another attempt.";

  return <div className={`case-build-status ${status}`} role="status" aria-live="polite">
    <span className={active ? "build-spinner" : "build-status-icon"} aria-hidden="true">{active ? "" : "!"}</span>
    <span><strong>{title}</strong><small>{detail}</small></span>
  </div>;
}
