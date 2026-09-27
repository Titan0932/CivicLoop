export type ConfidenceLabel = "verified" | "strong_match" | "needs_review";
export type LifecycleStatus =
  | "open"
  | "awaiting_results"
  | "results_published"
  | "awaiting_decision"
  | "approved"
  | "implementation_underway"
  | "completed"
  | "no_recent_update";

export type ResponseStatus =
  | "addressed"
  | "partially_addressed"
  | "declined"
  | "acknowledged"
  | "no_public_response";

export type CaseBuildStatus = "ready" | "analyzing" | "partial" | "failed";

export interface SourceIdentifier {
  type: string;
  value: string;
  sourceUrl: string;
}

export interface ConsultationSummary {
  id: string;
  slug: string;
  title: string;
  aliases: string[];
  summary: string;
  topic: string;
  location: string;
  ward: string | null;
  department: string;
  openedAt: string | null;
  closedAt: string | null;
  status: LifecycleStatus;
  latestUpdateAt: string;
  lastCheckedAt: string;
  matchLabel: ConfidenceLabel;
  buildStatus: CaseBuildStatus;
  buildCompleted: number;
  buildTotal: number;
  buildError: string | null;
}

export interface SourceDocument {
  id: string;
  consultationId: string;
  url: string;
  title: string;
  documentType: string;
  sourceSystem: string;
  publishedAt: string | null;
  identifiers: SourceIdentifier[];
  contentHash: string;
  firstSeenAt: string;
  lastCheckedAt: string;
  lastChangedAt: string;
  nextCheckAt: string;
  cadence: string;
  checkStatus: string;
  consecutiveErrors: number;
  fixturePath: string | null;
  liveContentHash: string | null;
  lastLiveCheckedAt: string | null;
}

export interface TimelineEvent {
  id: string;
  consultationId: string;
  eventType: string;
  title: string;
  description: string;
  eventDate: string;
  stage: string;
  confidence: "confirmed" | "inferred";
  sourceIds: string[];
}

export interface FeedbackTheme {
  id: string;
  theme: string;
  summary: string;
  responseStatus: ResponseStatus;
  response: string;
  feedbackSourceId: string;
  responseSourceId: string | null;
  verification: ConfidenceLabel;
  evidenceExcerpt: string;
}

export interface Commitment {
  id: string;
  action: string;
  owner: string;
  targetDate: string | null;
  status: "planned" | "in_progress" | "completed" | "unknown";
  latestStatusAt: string;
  sourceId: string;
}

export interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  relationshipType: string;
  confidence: ConfidenceLabel;
  signals: Array<{ type: string; value: string }>;
  origin: "deterministic" | "llm_assisted";
  humanVerified: boolean;
}

export interface CheckRun {
  id: string;
  consultationId: string;
  sourceId: string | null;
  startedAt: string;
  finishedAt: string;
  status: "success" | "failed";
  changeFound: boolean;
  error: string | null;
  newEvents: number;
  mode: "snapshot" | "live";
}

export interface ActivityNotification {
  id: string;
  consultationId: string;
  consultationSlug: string;
  consultationTitle: string;
  kind: "case_added" | "source_changed" | "analysis_completed";
  title: string;
  message: string;
  createdAt: string;
}

export interface NotificationPreferences {
  userId: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  updatedAt: string;
}

export interface NotificationDelivery {
  id: string;
  eventId: string;
  consultationId: string;
  consultationSlug: string;
  consultationTitle: string;
  channel: "in_app" | "email" | "sms";
  title: string;
  message: string;
  destination: string | null;
  status: "delivered" | "simulated" | "failed";
  createdAt: string;
  deliveredAt: string | null;
  readAt: string | null;
}

export interface ConsultationDetail extends ConsultationSummary {
  sources: SourceDocument[];
  events: TimelineEvent[];
  feedback: FeedbackTheme[];
  commitments: Commitment[];
  relationships: Relationship[];
  checkRuns: CheckRun[];
}
