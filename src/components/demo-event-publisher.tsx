"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LifecycleStatus } from "@/lib/domain";
import { statusLabels } from "@/lib/format";

interface DemoConsultation {
  id: string;
  title: string;
  tracked: boolean;
}

interface PublishResult {
  status: string;
  deliveries: number;
  subscribers: number;
  consultationTitle: string;
}

const statuses = Object.entries(statusLabels) as Array<[LifecycleStatus, string]>;

export function DemoEventPublisher({ consultations }: { consultations: DemoConsultation[] }) {
  const router = useRouter();
  const [consultationId, setConsultationId] = useState(consultations.find((item) => item.tracked)?.id || consultations[0]?.id || "");
  const [title, setTitle] = useState("New project update published");
  const [message, setMessage] = useState("The City posted a new update to this consultation. This is a simulated event for the CivicLoop notification demo.");
  const [lifecycleStatus, setLifecycleStatus] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<PublishResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selected = consultations.find((item) => item.id === consultationId);

  async function publish(event: React.FormEvent) {
    event.preventDefault();
    setPublishing(true);
    setResult(null);
    setError(null);
    try {
      const response = await fetch("/api/demo/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ consultationId, title, message, lifecycleStatus: lifecycleStatus || null }),
      });
      const body = await response.json() as PublishResult & { error?: string };
      if (!response.ok) throw new Error(body.error || "The event could not be published");
      setResult(body);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The event could not be published");
    } finally {
      setPublishing(false);
    }
  }

  if (consultations.length === 0) return <div className="empty-state"><strong>No consultations are available.</strong><span>Add one to the directory before publishing a demo update.</span></div>;

  return <form className="demo-event-form" onSubmit={publish}>
    <label><span>Consultation to update</span><select value={consultationId} onChange={(event) => setConsultationId(event.target.value)}>{consultations.map((item) => <option key={item.id} value={item.id}>{item.tracked ? "Tracking · " : "Not tracking · "}{item.title}</option>)}</select></label>
    <div className={`tracking-check ${selected?.tracked ? "ready" : "warning"}`}><strong>{selected?.tracked ? "This user is tracking the consultation" : "This user is not tracking the consultation"}</strong><span>{selected?.tracked ? "The event will create deliveries for every enabled channel." : "The event will be processed, but this user will receive no notification."}</span></div>
    <label><span>Update title</span><input value={title} onChange={(event) => setTitle(event.target.value)} required minLength={3} maxLength={100} /></label>
    <label><span>Notification message</span><textarea value={message} onChange={(event) => setMessage(event.target.value)} required minLength={5} maxLength={500} rows={4} /></label>
    <label><span>Also change the case stage <small>optional</small></span><select value={lifecycleStatus} onChange={(event) => setLifecycleStatus(event.target.value)}><option value="">Keep its current stage</option>{statuses.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
    <button className="publish-event-button" type="submit" disabled={publishing || !consultationId}>{publishing ? "Publishing event…" : "Publish mock update"}</button>
    {error && <div className="demo-result error" role="alert">{error}</div>}
    {result && <div className="demo-result success" role="status"><strong>Event processed immediately</strong><span>{result.subscribers} subscriber · {result.deliveries} channel {result.deliveries === 1 ? "delivery" : "deliveries"} created for {result.consultationTitle}.</span><Link href="/notifications">Open the notification inbox →</Link></div>}
  </form>;
}
