export type MatchSignal = { type: string; value: string; strength: "strong" | "medium" | "weak" };

export interface MatchCandidate {
  directOfficialLink?: boolean;
  sharedStrongIdentifiers?: Array<{ type: string; value: string }>;
  explicitParent?: string;
  titleSimilarity?: boolean;
  sameLocation?: boolean;
  compatibleChronology?: boolean;
  distinctiveSubject?: boolean;
}

export interface MatchResult {
  linked: boolean;
  confidence: "verified" | "strong_match" | "needs_review";
  signals: MatchSignal[];
  reason: string;
}

export function evaluateMatch(candidate: MatchCandidate): MatchResult {
  const signals: MatchSignal[] = [];
  if (candidate.directOfficialLink) signals.push({ type: "direct_official_link", value: "An official record links directly to the other record.", strength: "strong" });
  if (candidate.explicitParent) signals.push({ type: "explicit_parent_relationship", value: candidate.explicitParent, strength: "strong" });
  for (const identifier of candidate.sharedStrongIdentifiers || []) {
    signals.push({ type: `shared_${identifier.type}`, value: identifier.value, strength: "strong" });
  }
  if (candidate.titleSimilarity) signals.push({ type: "title_similarity", value: "Titles are similar or known aliases.", strength: "weak" });
  if (candidate.sameLocation) signals.push({ type: "same_location", value: "Records concern the same distinctive location.", strength: "medium" });
  if (candidate.compatibleChronology) signals.push({ type: "compatible_chronology", value: "Dates follow a plausible lifecycle order.", strength: "medium" });
  if (candidate.distinctiveSubject) signals.push({ type: "distinctive_subject", value: "Records share a distinctive project description.", strength: "medium" });

  if (signals.some((signal) => signal.strength === "strong")) {
    return { linked: true, confidence: "verified", signals, reason: "At least one exact official relationship or identifier supports this link." };
  }
  if (signals.filter((signal) => signal.strength === "medium").length >= 2) {
    return { linked: true, confidence: "strong_match", signals, reason: "Multiple independent contextual signals support this reviewable link." };
  }
  return { linked: false, confidence: "needs_review", signals, reason: "The evidence is insufficient for an automatic link; title or topic similarity alone is not enough." };
}
