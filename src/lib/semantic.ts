import type { DatabaseSync } from "node:sqlite";
import OpenAI from "openai";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { createHash } from "node:crypto";

const EvidenceSchema = z.object({
  sourceDocumentId: z.string().min(1),
  excerpt: z.string().min(8).max(300),
});

export const SemanticResultSchema = z.object({
  documentType: z.enum(["consultation_notice", "consultation_results", "staff_report", "decision", "implementation_update", "other"]),
  projectAliases: z.array(z.object({ alias: z.string().min(2).max(200), evidence: EvidenceSchema })).max(10),
  relationship: z.object({
    type: z.enum(["results_report_for", "decision_for", "update_for", "unknown"]),
    confidenceLabel: z.enum(["verified", "strong_match", "needs_review"]),
    rationale: z.string().max(500),
    evidence: z.array(EvidenceSchema).max(4),
  }),
  summary: z.object({
    points: z.array(z.object({ text: z.string().min(1).max(350), evidence: EvidenceSchema })).min(1).max(5),
  }),
  feedbackThemes: z.array(z.object({
    theme: z.string().min(2).max(200),
    residentConcern: z.string().min(2).max(500),
    responseStatus: z.enum(["addressed", "partially_addressed", "declined", "acknowledged", "no_public_response"]),
    municipalResponse: z.string().max(700).nullable(),
    feedbackEvidence: EvidenceSchema,
    responseEvidence: EvidenceSchema.nullable(),
  })).max(12),
  commitments: z.array(z.object({
    action: z.string().min(2).max(600),
    owner: z.string().max(200).nullable(),
    targetDate: z.string().max(100).nullable(),
    status: z.enum(["planned", "in_progress", "completed", "unknown"]),
    evidence: EvidenceSchema,
  })).max(12),
});
export type SemanticResult = z.infer<typeof SemanticResultSchema>;

export interface SemanticInput { sourceDocumentId: string; contentHash: string; text: string; canonicalTitle?: string; }
export interface SemanticProvider { readonly id: string; extract(input: SemanticInput): Promise<SemanticResult>; }

function normalizedEvidence(value: string) {
  return value.toLowerCase().replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[.,;:!?]+/g, "").replace(/\s+/g, " ").trim();
}

function groundEvidence(evidence: z.infer<typeof EvidenceSchema>, input: SemanticInput, source: string) {
  if (evidence.sourceDocumentId !== input.sourceDocumentId) return false;
  const excerpt = normalizedEvidence(evidence.excerpt);
  if (source.includes(excerpt)) return true;
  const words = evidence.excerpt.trim().split(/\s+/);
  for (let length = words.length - 1; length >= 8; length -= 1) {
    const candidate = words.slice(0, length).join(" ").replace(/[,:;.!?]+$/, "");
    if (source.includes(normalizedEvidence(candidate))) {
      evidence.excerpt = candidate.replace(/\s+(a|an|the|and|or|of|in|on|at|to|for|with|between)$/i, "");
      return true;
    }
  }
  return false;
}

export function validateGrounding(result: SemanticResult, input: SemanticInput): SemanticResult {
  const source = normalizedEvidence(input.text);
  result.projectAliases = result.projectAliases.filter((item) => groundEvidence(item.evidence, input, source));
  const relationshipEvidence = result.relationship.evidence.filter((evidence) => groundEvidence(evidence, input, source));
  if (result.relationship.evidence.length > 0 && relationshipEvidence.length === 0) {
    result.relationship.type = "unknown";
    result.relationship.confidenceLabel = "needs_review";
  }
  result.relationship.evidence = relationshipEvidence;
  const rejectedSummary = result.summary.points.find((point) => !groundEvidence(point.evidence, input, source));
  result.summary.points = result.summary.points.filter((point) => groundEvidence(point.evidence, input, source));
  if (result.summary.points.length === 0) {
    const excerpt = rejectedSummary?.evidence.excerpt || "No grounded summary evidence was returned";
    throw new Error(`Semantic evidence excerpt was not found in ${input.sourceDocumentId}: ${excerpt.slice(0, 100)}`);
  }
  result.feedbackThemes = result.feedbackThemes.flatMap((theme) => {
    if (!groundEvidence(theme.feedbackEvidence, input, source)) return [];
    if (theme.responseEvidence && !groundEvidence(theme.responseEvidence, input, source)) {
      theme.responseEvidence = null;
      theme.municipalResponse = null;
      theme.responseStatus = "no_public_response";
    }
    return [theme];
  });
  result.commitments = result.commitments.filter((item) => groundEvidence(item.evidence, input, source));
  for (const commitment of result.commitments) {
    if (commitment.targetDate && ["unknown", "not stated", "none"].includes(commitment.targetDate.toLowerCase())) commitment.targetDate = null;
    if (commitment.owner && ["unknown", "not stated", "none"].includes(commitment.owner.toLowerCase())) commitment.owner = null;
  }
  if (input.canonicalTitle) {
    const canonical = normalizedEvidence(input.canonicalTitle);
    result.projectAliases = result.projectAliases.filter((item) => normalizedEvidence(item.alias) !== canonical);
  }
  for (const point of result.summary.points) {
    if (normalizedEvidence(point.evidence.excerpt) === "carried") {
      point.text = "The meeting record states that the motion or recommendation was carried.";
    }
  }
  return result;
}

const systemPrompt = `You extract civic-consultation facts from exactly one supplied official document.
Return only the requested JSON schema. Use only the supplied text.
Never invent URLs, identifiers, dates, decisions, public concerns, responses, owners, deadlines, or causal claims.
Every evidence excerpt must be a short exact contiguous quote copied character-for-character from the supplied text, with the exact supplied source document ID. Use roughly 8–30 words. Never join separate passages, add ellipses, correct grammar, change units, or paraphrase inside an excerpt.
Summarize in plain language. Keep uncertainty explicit.
Write each independently verifiable summary fact as its own summary point and attach the exact excerpt that supports that point. Do not combine unsupported facts into one point.
When supported, produce 2–4 concise summary points covering status, purpose, and the most important documented outcome.
For consultation-results documents, extract the major recurring preferences, concerns, and priorities that the document explicitly attributes to public input, even when it does not say that the feedback caused a design change. Keep themes distinct and grounded in the reported results. When the document states a related municipal design choice, action, or response, include separate response evidence; otherwise use no_public_response and a null response evidence value.
When a results report says staff or consultants reviewed the feedback and then selected a preferred option, treat the documented features of that option as responses to matching feedback themes. Pair only clearly matching features, and use partially_addressed when the option covers only part of a request.
Commitments are explicit promised future actions. Do not convert a past design change, completed action, proposal description, or general objective into a commitment. Use completed only when the document explicitly says a previously promised action was completed.
In municipal meeting records, “Carried” means that a motion or recommendation passed. It never means that the program was implemented or completed.
Use no_public_response only when a feedback concern is present but this document contains no response; do not claim that government did nothing.
An alias is a project/program title, not a document filename or generic heading.
If the document does not support a field, use an empty array, null, unknown, needs_review, or relationship type unknown as appropriate.`;

export class FixtureSemanticProvider implements SemanticProvider {
  readonly id = "fixture-v2";
  calls = 0;
  async extract(input: SemanticInput): Promise<SemanticResult> {
    this.calls += 1;
    const excerpt = input.text.trim().slice(0, 300) || "No source text was supplied.";
    return SemanticResultSchema.parse({
      documentType: "other",
      projectAliases: [],
      relationship: { type: "unknown", confidenceLabel: "needs_review", rationale: "Fixture provider does not infer relationships.", evidence: [] },
      summary: { points: [{ text: `Fixture analysis for ${input.sourceDocumentId}; no ungrounded claims added.`, evidence: { sourceDocumentId: input.sourceDocumentId, excerpt } }] },
      feedbackThemes: [],
      commitments: [],
    });
  }
}

export class LocalSemanticProvider implements SemanticProvider {
  readonly id: string;
  private client: OpenAI;
  constructor(
    private model = process.env.CIVICLOOP_LOCAL_LLM_MODEL || "mlx-community/Qwen3.5-9B-4bit",
    baseURL = process.env.CIVICLOOP_LOCAL_LLM_URL || "http://127.0.0.1:8001/v1",
  ) {
    this.client = new OpenAI({ apiKey: "local-civicloop", baseURL, timeout: 180_000, maxRetries: 0 });
    this.id = `local:${model}@${baseURL}`;
  }
  async extract(input: SemanticInput): Promise<SemanticResult> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      max_tokens: 3000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Source document ID: ${input.sourceDocumentId}\nCanonical tracked title: ${input.canonicalTitle || "not supplied"}\nDo not return the canonical tracked title as an alias.\n\nOFFICIAL DOCUMENT TEXT:\n${input.text.slice(0, 50000)}` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "civicloop_semantic_result", strict: true, schema: z.toJSONSchema(SemanticResultSchema) },
      },
    });
    const content = response.choices[0]?.message.content;
    if (!content) throw new Error("The local model returned no structured content");
    return SemanticResultSchema.parse(JSON.parse(content));
  }
}

function geminiJsonSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(geminiJsonSchema);
  if (!value || typeof value !== "object") return value;
  const unsupported = new Set(["$schema", "minLength", "maxLength", "pattern", "default"]);
  return Object.fromEntries(Object.entries(value).filter(([key]) => !unsupported.has(key)).map(([key, item]) => [key, geminiJsonSchema(item)]));
}

export class GeminiSemanticProvider implements SemanticProvider {
  readonly id: string;
  private client: GoogleGenAI;

  constructor(
    private model = process.env.CIVICLOOP_GEMINI_MODEL || "gemini-3.5-flash",
    apiKey = process.env.GEMINI_API_KEY,
  ) {
    if (!apiKey) throw new Error("GEMINI_API_KEY is required for the Gemini semantic provider");
    this.client = new GoogleGenAI({ apiKey });
    this.id = `gemini:${model}`;
  }

  async extract(input: SemanticInput): Promise<SemanticResult> {
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: `Source document ID: ${input.sourceDocumentId}\nCanonical tracked title: ${input.canonicalTitle || "not supplied"}\nDo not return the canonical tracked title as an alias.\n\nOFFICIAL DOCUMENT TEXT:\n${input.text.slice(0, 60_000)}`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseJsonSchema: geminiJsonSchema(z.toJSONSchema(SemanticResultSchema)),
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        maxOutputTokens: 4_000,
        httpOptions: { timeout: 120_000 },
      },
    });
    if (!response.text) throw new Error("Gemini returned no structured content");
    return SemanticResultSchema.parse(JSON.parse(response.text));
  }
}

export class FallbackSemanticProvider implements SemanticProvider {
  readonly id: string;

  constructor(private primary: SemanticProvider, private fallback: SemanticProvider) {
    this.id = `gemini-first:${primary.id}|fallback:${fallback.id}`;
  }

  async extract(input: SemanticInput): Promise<SemanticResult> {
    try {
      return validateGrounding(SemanticResultSchema.parse(await this.primary.extract(input)), input);
    } catch {
      return this.fallback.extract(input);
    }
  }
}

export function createDefaultSemanticProvider(): SemanticProvider {
  const local = new LocalSemanticProvider();
  if (!process.env.GEMINI_API_KEY) return local;
  return new FallbackSemanticProvider(new GeminiSemanticProvider(), local);
}

export class OpenAISemanticProvider implements SemanticProvider {
  readonly id: string;
  private client: OpenAI;
  constructor(private model = process.env.CIVICLOOP_LLM_MODEL || "gpt-5-mini") {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for the OpenAI semantic provider");
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.id = `openai:${model}`;
  }
  async extract(input: SemanticInput): Promise<SemanticResult> {
    const response = await this.client.responses.parse({
      model: this.model,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Source document ID: ${input.sourceDocumentId}\nCanonical tracked title: ${input.canonicalTitle || "not supplied"}\nDo not return the canonical tracked title as an alias.\n\nOFFICIAL DOCUMENT TEXT:\n${input.text.slice(0, 60000)}` },
      ],
      text: { format: zodTextFormat(SemanticResultSchema, "civicloop_semantic_result") },
    });
    if (!response.output_parsed) throw new Error("The model returned no validated structured result");
    return SemanticResultSchema.parse(response.output_parsed);
  }
}

export const semanticSchemaVersion = "semantic-v7";

export async function extractWithCache(db: DatabaseSync, provider: SemanticProvider, input: SemanticInput): Promise<{ result: SemanticResult; cached: boolean }> {
  const cacheKey = createHash("sha256").update(`${input.contentHash}:${semanticSchemaVersion}:${provider.id}:${input.canonicalTitle || ""}`).digest("hex");
  const hit = db.prepare("SELECT result_json FROM semantic_cache WHERE cache_key = ?").get(cacheKey) as { result_json: string } | undefined;
  if (hit) {
    const result = validateGrounding(SemanticResultSchema.parse(JSON.parse(hit.result_json)), input);
    const normalizedJson = JSON.stringify(result);
    if (normalizedJson !== hit.result_json) db.prepare("UPDATE semantic_cache SET result_json = ? WHERE cache_key = ?").run(normalizedJson, cacheKey);
    return { result, cached: true };
  }
  const result = validateGrounding(SemanticResultSchema.parse(await provider.extract(input)), input);
  const insert = db.prepare("INSERT OR IGNORE INTO semantic_cache (cache_key, source_id, provider, schema_version, result_json, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(cacheKey, input.sourceDocumentId, provider.id, semanticSchemaVersion, JSON.stringify(result), new Date().toISOString());
  if (Number(insert.changes) === 0) {
    const winner = db.prepare("SELECT result_json FROM semantic_cache WHERE cache_key = ?").get(cacheKey) as { result_json: string } | undefined;
    if (winner) return { result: validateGrounding(SemanticResultSchema.parse(JSON.parse(winner.result_json)), input), cached: true };
  }
  return { result, cached: false };
}
