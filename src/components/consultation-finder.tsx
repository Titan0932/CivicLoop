"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type FinderResult = {
  existing: boolean;
  slug: string;
  sourceCount: number;
  warnings: string[];
};

export function ConsultationFinder() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FinderResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true); setError(null); setResult(null);
    try {
      const response = await fetch("/api/consultations/discover", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
      const body = await response.json() as FinderResult & { error?: string };
      if (!response.ok) throw new Error(body.error || "CivicLoop could not check that consultation.");
      setResult(body); setUrl(""); router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "CivicLoop could not check that consultation.");
    } finally { setLoading(false); }
  }

  return <section className="finder-panel" aria-labelledby="finder-title">
    <div><span className="finder-kicker">Community-powered tracking</span><h2 id="finder-title">Can’t find a consultation?</h2><p>Paste its official Ottawa page. If CivicLoop already knows it, we’ll open the existing case. If not, we’ll collect its directly linked official records and start monitoring it.</p></div>
    <form onSubmit={submit}>
      <label htmlFor="consultation-url">Official consultation URL</label>
      <div><input id="consultation-url" type="url" required value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://engage.ottawa.ca/..." disabled={loading} /><button type="submit" disabled={loading}>{loading ? "Building the case…" : "Find or track it"}</button></div>
      <small>Only allowlisted City of Ottawa sources are accepted. New cases may take a moment to collect.</small>
    </form>
    <div className="finder-result" aria-live="polite">
      {result && <div className="finder-success"><strong>{result.existing ? "Already tracked" : "Case created"}</strong><span>{result.existing ? "CivicLoop found the existing public case." : `${result.sourceCount} official ${result.sourceCount === 1 ? "record is" : "records are"} saved. Plain-language analysis will continue in the background.`}</span><Link href={`/consultations/${result.slug}`}>Open the case</Link></div>}
      {error && <div className="finder-error"><strong>We couldn’t add that page</strong><span>{error}</span></div>}
    </div>
  </section>;
}
