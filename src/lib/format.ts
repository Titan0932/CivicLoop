import type { ConfidenceLabel, LifecycleStatus, ResponseStatus } from "./domain";

export function formatDate(value: string | null, includeYear = true) {
  if (!value) return "Date not published";
  if (/^\d{4}$/.test(value)) return value;
  if (/^\d{4}-\d{2}$/.test(value)) {
    const month = new Date(`${value}-01T12:00:00Z`);
    return new Intl.DateTimeFormat("en-CA", { month: "short", year: "numeric" }).format(month);
  }
  const parsed = /^\d{4}-\d{2}-\d{2}/.test(value) ? new Date(`${value.slice(0, 10)}T12:00:00Z`) : new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", ...(includeYear ? { year: "numeric" } : {}) }).format(parsed);
}

export const statusLabels: Record<LifecycleStatus, string> = {
  open: "Open for input", awaiting_results: "Awaiting results", results_published: "Results published",
  awaiting_decision: "Awaiting decision", approved: "Approved", implementation_underway: "Implementation underway",
  completed: "Completed", no_recent_update: "No recent public update found",
};

export const confidenceLabels: Record<ConfidenceLabel, string> = {
  verified: "Verified", strong_match: "Strong match", needs_review: "Needs review",
};

export const responseLabels: Record<ResponseStatus, string> = {
  addressed: "Addressed", partially_addressed: "Partially addressed", declined: "Declined",
  acknowledged: "Acknowledged", no_public_response: "No public response found",
};

export function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
