import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

export interface DerivedHistoryEvent {
  eventType: string;
  title: string;
  description: string;
  eventDate: string;
  stage: string;
  confidence: "confirmed" | "inferred";
}

function contains(text: string, pattern: RegExp) {
  return pattern.test(text);
}

export function deriveProjectHistory(text: string): DerivedHistoryEvent[] {
  const events: DerivedHistoryEvent[] = [];
  const add = (event: DerivedHistoryEvent) => {
    if (!events.some((item) => item.eventType === event.eventType && item.eventDate === event.eventDate && item.title === event.title)) events.push(event);
  };

  if (contains(text, /spring of 2020, the City of Ottawa conducted a survey/i)) add({
    eventType: "consultation_round",
    title: "Initial community survey gathered renovation priorities",
    description: "The City surveyed residents about how the community centre could be renovated and improved.",
    eventDate: "2020",
    stage: "Consultation",
    confidence: "confirmed",
  });

  if (contains(text, /second survey was (?:open|conducted).*June 1, 2021.*August 5, 2021/i)) add({
    eventType: "consultation_round",
    title: "Second design-options survey opened",
    description: "The nine-week survey asked residents about three expansion options and ran from June 1 to August 5, 2021.",
    eventDate: "2021-06-01",
    stage: "Consultation",
    confidence: "confirmed",
  });

  if (contains(text, /consultants reviewed all the feedback[\s\S]{0,180}Option 3 came forward as the preferred option/i)) add({
    eventType: "results_published",
    title: "Option 3 identified as the preferred design direction",
    description: "After reviewing the feedback, the project consultants selected Option 3 for further development because it offered the most advantages and fewest disadvantages.",
    eventDate: "2021-08",
    stage: "Results",
    confidence: "confirmed",
  });

  if (contains(text, /Update\s*[–-]\s*January 16,\s*2026[\s\S]{0,500}(?:full funding[\s\S]{0,120}secured|funding secured)/i)) add({
    eventType: "funding_secured",
    title: "Full funding secured and detailed design began",
    description: "The project page reports that the 2026 City budget fully funded the expansion and that the project entered detailed design.",
    eventDate: "2026-01-16",
    stage: "Design",
    confidence: "confirmed",
  });

  if (contains(text, /public information session will be held on February 19, 2026/i)) add({
    eventType: "scheduled_engagement",
    title: "Public information session scheduled",
    description: "The City scheduled an in-person session to present preliminary expansion drawings, answer questions, and receive comments.",
    eventDate: "2026-02-19",
    stage: "Consultation",
    confidence: "confirmed",
  });

  if (contains(text, /(?:on-line|online) public survey[^.]{0,160}February 12, 2026[^.]{0,80}March 6, 2026/i)) add({
    eventType: "scheduled_engagement",
    title: "Public design survey scheduled",
    description: "An online survey was scheduled from February 12 to March 6, 2026 to gather feedback on the preliminary design.",
    eventDate: "2026-02-12",
    stage: "Consultation",
    confidence: "confirmed",
  });

  if (contains(text, /Update\s*[–-]\s*May 2026[\s\S]{0,800}What We Learned/i)) add({
    eventType: "results_published",
    title: "Latest engagement results published",
    description: "The City published a What We Learned report summarizing feedback from the 2026 survey.",
    eventDate: "2026-05",
    stage: "Results",
    confidence: "confirmed",
  });

  return events.sort((a, b) => a.eventDate.localeCompare(b.eventDate));
}

export function materializeProjectHistory(db: DatabaseSync, consultationId: string, sourceId: string, text: string) {
  let inserted = 0;
  for (const event of deriveProjectHistory(text)) {
    const token = createHash("sha256").update(`${consultationId}:${sourceId}:${event.eventType}:${event.eventDate}:${event.title}`).digest("hex").slice(0, 16);
    const result = db.prepare(`INSERT OR IGNORE INTO timeline_events
      (id, consultation_id, event_type, title, description, event_date, stage, confidence, source_ids_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(`history-${token}`, consultationId, event.eventType, event.title, event.description, event.eventDate, event.stage, event.confidence, JSON.stringify([sourceId]));
    inserted += Number(result.changes);
  }
  return inserted;
}
