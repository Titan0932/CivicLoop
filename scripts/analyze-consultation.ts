import fs from "node:fs";
import path from "node:path";
import nextEnv from "@next/env";
import { getDb } from "../src/lib/db";
import { fetchOfficialSource } from "../src/lib/fetcher";
import { contentHash, normalizeContent } from "../src/lib/hash";
import {
  extractWithCache,
  createDefaultSemanticProvider,
  FixtureSemanticProvider,
  GeminiSemanticProvider,
  LocalSemanticProvider,
  OpenAISemanticProvider,
  type SemanticProvider,
  type SemanticResult,
} from "../src/lib/semantic";

type ConsultationRow = { id: string; slug: string; title: string };
type SourceRow = { id: string; title: string; url: string; extracted_text: string; content_hash: string };
type AnalysisItem = {
  sourceId: string; sourceTitle: string; sourceUrl: string; provider: string; cached: boolean;
  inputMode: "live" | "saved"; contentHash: string; result?: SemanticResult; error?: string;
};

nextEnv.loadEnvConfig(process.cwd());

function providerFromArgs(): SemanticProvider {
  if (process.argv.includes("--openai")) return new OpenAISemanticProvider();
  if (process.argv.includes("--fixture")) return new FixtureSemanticProvider();
  if (process.argv.includes("--local")) return new LocalSemanticProvider();
  if (process.argv.includes("--gemini")) return new GeminiSemanticProvider();
  return createDefaultSemanticProvider();
}

function reportMarkdown(consultation: ConsultationRow, analyses: AnalysisItem[]) {
  const lines = [
    `# AI-assisted analysis: ${consultation.title}`, ``,
    `Generated: ${new Date().toISOString()}`, ``,
    `Model output is reviewable interpretation. Source-matched excerpts below remain the evidence; deterministic identifiers and decisions take precedence.`, ``,
  ];
  for (const item of analyses) {
    lines.push(`## ${item.sourceTitle}`, ``, `- Source: ${item.sourceUrl}`, `- Provider: ${item.provider}`, `- Input: ${item.inputMode}`, `- Cache: ${item.cached ? "hit" : "miss"}`);
    if (item.error || !item.result) { lines.push(`- Error: ${item.error || "No result"}`, ``); continue; }
    const result = item.result;
    lines.push(`- Document type: ${result.documentType}`, ``);
    for (const point of result.summary.points) lines.push(point.text, ``, `> ${point.evidence.excerpt}`, ``);
    if (result.projectAliases.length) {
      lines.push(`### Possible aliases`, ``);
      for (const alias of result.projectAliases) lines.push(`- **${alias.alias}** — “${alias.evidence.excerpt}”`);
      lines.push(``);
    }
    if (result.feedbackThemes.length) {
      lines.push(`### Feedback and response`, ``);
      for (const theme of result.feedbackThemes) {
        lines.push(`- **${theme.theme}** — ${theme.responseStatus}`, `  - Concern: ${theme.residentConcern}`, `  - Response: ${theme.municipalResponse || "No response in this document"}`, `  - Evidence: “${theme.feedbackEvidence.excerpt}”`);
        if (theme.responseEvidence) lines.push(`  - Response evidence: “${theme.responseEvidence.excerpt}”`);
      }
      lines.push(``);
    }
    if (result.commitments.length) {
      lines.push(`### Commitments`, ``);
      for (const commitment of result.commitments) lines.push(`- **${commitment.status}** — ${commitment.action} · owner: ${commitment.owner || "not stated"} · target: ${commitment.targetDate || "not stated"}\n  - Evidence: “${commitment.evidence.excerpt}”`);
      lines.push(``);
    }
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  const input = process.argv.slice(2).find((argument) => !argument.startsWith("--"));
  if (!input) throw new Error("Usage: npm run analyze-consultation -- <slug|consultation-id> [--live] [--source=<source-id>] [--gemini|--local|--openai|--fixture]");
  const db = getDb();
  const consultation = db.prepare("SELECT id, slug, title FROM consultations WHERE slug = ? OR id = ? LIMIT 1").get(input, input) as ConsultationRow | undefined;
  if (!consultation) throw new Error("Analyze a tracked consultation by slug or ID. Run check-consultation with an official URL first to create a discovery report.");
  const sourceFilter = process.argv.find((argument) => argument.startsWith("--source="))?.slice("--source=".length);
  const sources = db.prepare(`SELECT id, title, url, extracted_text, content_hash FROM source_documents WHERE consultation_id = ? ${sourceFilter ? "AND id = ?" : ""} ORDER BY published_at`)
    .all(...(sourceFilter ? [consultation.id, sourceFilter] : [consultation.id])) as unknown as SourceRow[];
  if (!sources.length) throw new Error(sourceFilter ? `Source ${sourceFilter} does not belong to this consultation` : "No sources are available to analyze");
  const provider = providerFromArgs();
  const live = process.argv.includes("--live");
  const analyses: AnalysisItem[] = [];
  console.log(`Analyzing ${sources.length} source${sources.length === 1 ? "" : "s"} for ${consultation.slug} with ${provider.id}…`);
  for (const source of sources) {
    try {
      const text = live ? normalizeContent(await fetchOfficialSource(source.url)) : source.extracted_text;
      const hash = live ? contentHash(text) : source.content_hash;
      const extraction = await extractWithCache(db, provider, { sourceDocumentId: source.id, contentHash: hash, text, canonicalTitle: consultation.title });
      analyses.push({ sourceId: source.id, sourceTitle: source.title, sourceUrl: source.url, provider: provider.id, cached: extraction.cached, inputMode: live ? "live" : "saved", contentHash: hash, result: extraction.result });
      console.log(`✓ ${source.id}: ${extraction.cached ? "cache hit" : "analyzed"} — ${extraction.result.documentType}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown analysis error";
      analyses.push({ sourceId: source.id, sourceTitle: source.title, sourceUrl: source.url, provider: provider.id, cached: false, inputMode: live ? "live" : "saved", contentHash: source.content_hash, error: message });
      console.error(`× ${source.id}: ${message}`);
    }
  }
  const directory = path.join(process.cwd(), "reports");
  fs.mkdirSync(directory, { recursive: true });
  const label = provider.id.startsWith("gemini-first:") ? "gemini-first"
    : provider.id.startsWith("gemini:") ? "gemini"
      : provider.id.startsWith("local:") ? "local"
        : provider.id.startsWith("openai:") ? "openai" : "fixture";
  const jsonPath = path.join(directory, `${consultation.slug}-analysis-${label}.json`);
  const markdownPath = path.join(directory, `${consultation.slug}-analysis-${label}.md`);
  fs.writeFileSync(jsonPath, `${JSON.stringify({ consultation, generatedAt: new Date().toISOString(), analyses }, null, 2)}\n`);
  fs.writeFileSync(markdownPath, reportMarkdown(consultation, analyses));
  console.log(`Analysis report: ${markdownPath}`);
  console.log(`Machine-readable analysis: ${jsonPath}`);
  if (analyses.every((item) => item.error)) process.exitCode = 1;
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
