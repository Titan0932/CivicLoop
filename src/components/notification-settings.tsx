"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { NotificationPreferences } from "@/lib/domain";

export function NotificationSettings({ initial }: { initial: NotificationPreferences }) {
  const router = useRouter();
  const [email, setEmail] = useState(initial.email || "");
  const [phone, setPhone] = useState(initial.phone || "");
  const [inAppEnabled, setInAppEnabled] = useState(initial.inAppEnabled);
  const [emailEnabled, setEmailEnabled] = useState(initial.emailEnabled);
  const [smsEnabled, setSmsEnabled] = useState(initial.smsEnabled);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/notification-preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, phone, inAppEnabled, emailEnabled, smsEnabled }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Settings could not be saved");
      setNotice({ kind: "success", message: "Notification settings saved." });
      router.refresh();
    } catch (cause) {
      setNotice({ kind: "error", message: cause instanceof Error ? cause.message : "Settings could not be saved" });
    } finally {
      setSaving(false);
    }
  }

  return <form className="notification-settings" onSubmit={save}>
    <div className="channel-option">
      <div><strong>In-app inbox</strong><small>See updates here in CivicLoop.</small></div>
      <label className="toggle"><input type="checkbox" checked={inAppEnabled} onChange={(event) => setInAppEnabled(event.target.checked)} /><span aria-hidden="true" /></label>
    </div>
    <div className="channel-option">
      <div><strong>Email</strong><small>Simulated in this local demo; no email is actually sent.</small></div>
      <label className="toggle"><input type="checkbox" checked={emailEnabled} onChange={(event) => setEmailEnabled(event.target.checked)} /><span aria-hidden="true" /></label>
      <label className="channel-destination"><span>Email address</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" disabled={!emailEnabled} /></label>
    </div>
    <div className="channel-option">
      <div><strong>SMS</strong><small>Simulated in this local demo; no text message is actually sent.</small></div>
      <label className="toggle"><input type="checkbox" checked={smsEnabled} onChange={(event) => setSmsEnabled(event.target.checked)} /><span aria-hidden="true" /></label>
      <label className="channel-destination"><span>Mobile number</span><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+1 613 555 0123" disabled={!smsEnabled} /></label>
    </div>
    <div className="settings-actions"><button type="submit" disabled={saving}>{saving ? "Saving…" : "Save preferences"}</button>{notice && <span className={notice.kind} role="status">{notice.message}</span>}</div>
  </form>;
}

export function NotificationInboxControls({ hasUnread }: { hasUnread: boolean }) {
  const router = useRouter();
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 4_000);
    return () => window.clearInterval(timer);
  }, [router]);

  async function markRead() {
    setMarking(true);
    await fetch("/api/notifications/read", { method: "POST" });
    router.refresh();
    setMarking(false);
  }

  return <div className="inbox-controls"><span><i aria-hidden="true" />Listening for demo events</span>{hasUnread && <button onClick={markRead} disabled={marking}>{marking ? "Updating…" : "Mark all read"}</button>}</div>;
}
