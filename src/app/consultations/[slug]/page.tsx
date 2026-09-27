import Link from "next/link";
import { notFound } from "next/navigation";
import { CaseBuildStatus, DataFreshnessAction, DetailActions } from "@/components/detail-actions";
import type { SourceDocument, TimelineEvent } from "@/lib/domain";
import { confidenceLabels, formatDate, humanize, responseLabels, statusLabels } from "@/lib/format";
import { getConsultationBySlug, getSemanticAnalyses, isConsultationTracked } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ConsultationPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ view?: string }> }) {
  const { slug } = await params;
  const requested = (await searchParams).view;
  const view = requested && ["feedback", "commitments", "timeline", "evidence"].includes(requested) ? requested : "overview";
  const item = getConsultationBySlug(slug);
  if (!item) notFound();

  const semanticAnalyses = getSemanticAnalyses(item.id);
  const initialTracking = isConsultationTracked(item.id);
  const sources = new Map(item.sources.map((source) => [source.id, source]));
  const latestEvent = item.events[0];
  const openCommitments = item.commitments.filter((commitment) => commitment.status !== "completed");
  const documentedResponses = item.feedback.filter((theme) => theme.responseStatus !== "no_public_response" && theme.responseSourceId).length;
  const summaryPoints = semanticAnalyses
    .flatMap((analysis) => analysis.result.summary.points.map((point) => ({ ...point, sourceTitle: analysis.sourceTitle, sourceUrl: analysis.sourceUrl })))
    .slice(0, 3);

  return (
    <main id="main" className="casefile-main calm-ui">
      <div className="casefile-shell">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Consultations</Link><span aria-hidden="true">/</span><span>{item.title}</span>
        </nav>

        <header className="briefing-header">
          <div className="briefing-title">
            <div className="briefing-meta"><span>{item.topic}</span><span>{item.location}</span>{item.ward && <span>{item.ward}</span>}</div>
            <h1>{item.title}</h1>
            <div className="case-status"><strong className={`status-pill status-${item.status}`}>{statusLabels[item.status]}</strong><span>Last checked {formatDate(item.lastCheckedAt)}</span><DataFreshnessAction consultationId={item.id} /></div>
          </div>
          <DetailActions consultationId={item.id} title={item.title} initialTracking={initialTracking} />
        </header>

        <CaseBuildStatus status={item.buildStatus} completed={item.buildCompleted} total={item.buildTotal} />

        <nav className="view-nav" aria-label="Case sections">{[["overview", "Overview"], ["feedback", "Public feedback"], ["commitments", "Commitments"], ["timeline", "Timeline"], ["evidence", "Sources"]].map(([key, label]) => <Link key={key} href={`/consultations/${slug}${key === "overview" ? "" : `?view=${key}`}`} aria-current={view === key ? "page" : undefined}>{label}</Link>)}</nav>

        <div className="casefile-grid">
          <div className="reading-column">
            {view === "overview" && <section id="overview" className="brief-section overview-section">
              <header className="content-section-header"><div className="section-eyebrow">Case overview</div><h2>Summary</h2><p className="section-description">What the checked official records currently tell us.</p></header>
              {item.buildStatus === "analyzing" && <SectionBuildState completed={item.buildCompleted} total={item.buildTotal} section="summary" />}
              <div className="overview-summary"><span>In brief</span><p>{item.summary}</p></div>
              <div className="summary-sections">
                {latestEvent && <article className="latest-outcome"><span>{latestEvent.eventType === "tracking_started" ? "Tracking started" : "Latest update"}</span><h3>{latestEvent.title}</h3><p>{latestEvent.description}</p><small>{formatDate(latestEvent.eventDate)}</small><div className="evidence-links">{latestEvent.sourceIds.map(id => sources.get(id)).filter(Boolean).map(source => <a key={source!.id} href={source!.url} target="_blank" rel="noreferrer">{source!.sourceSystem} source<span className="sr-only"> (opens in a new tab)</span></a>)}</div></article>}
                <article className="next-step"><span>Next</span><h3>What happens next?</h3>{openCommitments[0] ? <><p>{openCommitments[0].action}</p><p className="secondary-copy">{openCommitments[0].targetDate ? `Target: ${formatDate(openCommitments[0].targetDate)}` : "No target date is published in the checked record."}</p><Link href={`?view=commitments`}>View commitments ({openCommitments.length} open)</Link></> : <p>No outstanding commitments are recorded in the sources checked.</p>}</article>
              </div>
              {summaryPoints.length > 0 && <details className="glance-points"><summary>Read the AI-assisted source summaries</summary>
                <ul>{summaryPoints.map((point, index) => <li key={`${point.sourceUrl}-${index}`}><span>{point.text}</span><a href={point.sourceUrl} target="_blank" rel="noreferrer">Source: {point.sourceTitle}<span className="sr-only"> (opens in a new tab)</span></a></li>)}</ul>
                <details className="method-note"><summary>How this summary was created</summary><p>AI helps turn official records into plain-language points. Each point stays linked to its source, while dates, identifiers, and decision links are matched separately. Official records take precedence.</p></details>
              </details>}
            </section>}

            {view === "feedback" && <section id="feedback" className="brief-section">
              <header className="content-section-header"><div className="section-eyebrow">Public input and response</div><h2>What changed after feedback</h2><p className="section-description">Resident concerns are shown beside any matching response documented in the official records.</p></header>
              {item.buildStatus !== "analyzing" && item.feedback.length > 0 && <div className={`feedback-coverage ${documentedResponses === 0 ? "none" : ""}`}>
                <strong>{documentedResponses} of {item.feedback.length} themes have a documented response</strong>
                <span>{documentedResponses === item.feedback.length ? "Every extracted theme has a response in the records checked." : "For the remaining themes, CivicLoop found the concern but no matching response in the records checked."}</span>
              </div>}
              <div className="feedback-matrix" role="list">
                {item.buildStatus === "analyzing" && <SectionBuildState completed={item.buildCompleted} total={item.buildTotal} section="public feedback" />}
                {item.buildStatus !== "analyzing" && item.feedback.length === 0 && <p>No feedback themes were identified in the official records that were successfully reviewed.</p>}
                {item.feedback.map((theme) => <article key={theme.id} className="feedback-case" role="listitem">
                  <div className="feedback-concern"><span className="matrix-label">Residents raised</span><h3>{theme.theme}</h3><p>{theme.summary}</p></div>
                  <div className="feedback-status"><span className={`response-status ${theme.responseStatus}`}>{responseLabels[theme.responseStatus]}</span></div>
                  <div className="feedback-response"><span className="matrix-label">{theme.responseSourceId ? "Documented project response" : "Response check"}</span><p>{theme.responseSourceId ? theme.response : "No matching response was found in the official records checked."}</p><details><summary>See the evidence</summary><blockquote>“{theme.evidenceExcerpt}”</blockquote><div className="evidence-links"><a href={sources.get(theme.feedbackSourceId)?.url} target="_blank" rel="noreferrer">Public feedback record<span className="sr-only"> (opens in a new tab)</span></a>{theme.responseSourceId && <a href={sources.get(theme.responseSourceId)?.url} target="_blank" rel="noreferrer">Documented response source<span className="sr-only"> (opens in a new tab)</span></a>}</div></details></div>
                </article>)}
              </div>
              <details className="context-disclosure"><summary>About this feedback</summary><p>These classifications describe what the checked public records say. They do not measure whether consultation participants represent Ottawa’s whole population.</p></details>
            </section>}

            {view === "commitments" && <section id="commitments" className="brief-section">
              <header className="content-section-header"><div className="section-label">Accountability</div><h2>What the City committed to</h2></header>
              <div className="commitment-table">
                {item.buildStatus === "analyzing" && <SectionBuildState completed={item.buildCompleted} total={item.buildTotal} section="commitments" />}
                {item.buildStatus !== "analyzing" && item.commitments.length === 0 && <p>No commitments were identified in the official records that were successfully reviewed.</p>}
                {item.commitments.map((commitment) => <article key={commitment.id}>
                  <span className={`commitment-status ${commitment.status}`}>{humanize(commitment.status)}</span>
                  <div><h3>{commitment.action}</h3><p>{commitment.owner}</p></div>
                  <div className="commitment-date"><span>Target</span><strong>{commitment.targetDate ? formatDate(commitment.targetDate) : "No date published"}</strong></div>
                  <a href={sources.get(commitment.sourceId)?.url} target="_blank" rel="noreferrer">View source<span className="sr-only"> (opens in a new tab)</span></a>
                </article>)}
              </div>
            </section>}

            {view === "timeline" && <section id="timeline" className="brief-section timeline-section">
              <header className="content-section-header"><div className="section-label">Public record</div><h2>Decision and progress</h2></header>
              <ol className="casefile-timeline">
                {item.events.slice(0, 3).map((event) => <TimelineItem key={event.id} event={event} sources={sources} />)}
              </ol>
              {item.events.length === 0 && <div className="timeline-empty"><strong>No dated project milestones found yet.</strong><span>CivicLoop does not treat tracking activity or notification tests as project history.</span></div>}
              {item.events.length > 3 && <details className="timeline-more"><summary>View full timeline ({item.events.length} events)</summary><ol className="casefile-timeline">{item.events.slice(3).map((event) => <TimelineItem key={event.id} event={event} sources={sources} />)}</ol></details>}
            </section>}

            {view === "evidence" && <section id="evidence" className="brief-section evidence-section">
              <details className="evidence-drawer" open>
                <summary><span><strong>How we know</strong><small>Official sources, record links, and data freshness</small></span><span aria-hidden="true">+</span></summary>
                <div className="evidence-drawer-body">
                  <section><h3>Official sources</h3>{item.sources.map((source) => <article className="source-row" key={source.id}><div><strong>{source.sourceSystem}</strong><a href={source.url} target="_blank" rel="noreferrer">{source.title}<span className="sr-only"> (opens in a new tab)</span></a><small>{humanize(source.documentType)} · {formatDate(source.publishedAt)}</small></div>{source.identifiers.length > 0 && <details><summary>Record identifiers</summary><ul>{source.identifiers.map((identifier) => <li key={`${identifier.type}-${identifier.value}`}><span>{humanize(identifier.type)}</span><code>{identifier.value}</code></li>)}</ul></details>}</article>)}</section>
                  {item.aliases.length > 0 && <section><h3>Previously known as</h3><p>{item.aliases.join(" · ")}</p></section>}
                  {item.relationships.length > 0 && <section><h3>How CivicLoop linked these records</h3><p>Names alone are not enough. CivicLoop stores the supporting signals for each link.</p>{item.relationships.map((relationship) => <details className="relationship-row" key={relationship.id}><summary><span>{humanize(relationship.relationshipType)}</span><strong>{confidenceLabels[relationship.confidence]}</strong></summary><ul>{relationship.signals.map((signal, index) => <li key={index}><span>{humanize(signal.type)}</span><strong>{signal.value}</strong></li>)}</ul><small>{relationship.origin === "deterministic" ? "Rule-based evidence" : "AI-assisted suggestion"}{relationship.humanVerified ? " · Human verified" : " · Review pending"}</small></details>)}</section>}
                  <section><h3>Data freshness</h3><p>Last checked {formatDate(item.lastCheckedAt)}.</p>{item.checkRuns.length > 0 && <details><summary>Recent check history</summary><ul className="check-history">{item.checkRuns.slice(0, 5).map((run) => <li key={run.id}><strong>{run.status === "failed" ? "Retrieval failed" : run.changeFound ? "New update found" : "No change found"}</strong><span>{run.mode === "live" ? "Live source" : "Saved snapshot"} · {formatDate(run.finishedAt)}</span></li>)}</ul></details>}</section>
                  {semanticAnalyses.length > 0 && <section><h3>AI disclosure</h3><p>{semanticAnalyses.length} cached analysis {semanticAnalyses.length === 1 ? "result is" : "results are"} available. AI is used for plain-language summaries and candidate themes; official identifiers and citations remain the source of truth.</p><details><summary>Analysis details</summary><ul className="analysis-provenance">{semanticAnalyses.map((analysis) => <li key={`${analysis.sourceId}-${analysis.provider}`}><a href={analysis.sourceUrl} target="_blank" rel="noreferrer">{analysis.sourceTitle}</a><span>{analysis.provider.startsWith("gemini-first:") ? "Gemini with local fallback" : analysis.provider.startsWith("gemini:") ? "Gemini" : analysis.provider.startsWith("local:") ? "Local Qwen model" : analysis.provider.startsWith("openai:") ? "OpenAI model" : "Fixture provider"} · {formatDate(analysis.analyzedAt)}</span></li>)}</ul></details></section>}
                </div>
              </details>
            </section>}
          </div>

        </div>
      </div>
    </main>
  );
}

function TimelineItem({ event, sources }: { event: TimelineEvent; sources: Map<string, SourceDocument> }) {
  return <li><time dateTime={event.eventDate}>{formatDate(event.eventDate)}</time><div><span>{event.stage}</span><h3>{event.title}</h3><p>{event.description}</p><div>{event.sourceIds.map((id) => sources.get(id)).filter(Boolean).map((source) => <a key={source!.id} href={source!.url} target="_blank" rel="noreferrer">View {source!.sourceSystem} source<span className="sr-only"> (opens in a new tab)</span></a>)}</div></div></li>;
}

function SectionBuildState({ completed, total, section }: { completed: number; total: number; section: string }) {
  return <div className="section-build-state" role="status">
    <span className="build-spinner" aria-hidden="true" />
    <span><strong>Still reviewing {section}</strong><small>{completed} of {total} official {total === 1 ? "record" : "records"} processed</small></span>
  </div>;
}
