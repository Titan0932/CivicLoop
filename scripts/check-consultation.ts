import fs from "node:fs";
import path from "node:path";
import { getDb } from "../src/lib/db";
import { discoverOfficialConsultation, type DiscoveryReport } from "../src/lib/discovery";
import { getConsultationBySlug } from "../src/lib/queries";
import { createDefaultSemanticProvider, FixtureSemanticProvider, GeminiSemanticProvider, LocalSemanticProvider, OpenAISemanticProvider } from "../src/lib/semantic";
import { UpdateChecker } from "../src/lib/update-checker";

type MatchRow = { id: string; slug: string };

function safeName(input: string) {
  return input.toLowerCase().replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "consultation";
}

function writeReport(name: string, value: unknown, markdown: string) {
  const directory = path.join(process.cwd(), "reports");
  fs.mkdirSync(directory, { recursive: true });
  const jsonPath = path.join(directory, `${name}-latest.json`);
  const markdownPath = path.join(directory, `${name}-latest.md`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(value, null, 2)}\n`);
  fs.writeFileSync(markdownPath, markdown);
  return { jsonPath, markdownPath };
}

function discoveryMarkdown(report: DiscoveryReport) {
  const lines = [`# Live consultation discovery`, ``, `Seed: ${report.seedUrl}`, `Checked: ${report.checkedAt}`, ``, report.coverageNote, ``];
  for (const record of report.records) {
    lines.push(`## ${record.title}`, ``, `- URL: ${record.url}`, `- Source: ${record.sourceSystem}`, `- Retrieval: ${record.retrievalStatus}`);
    if (record.motionResult) lines.push(`- Motion result: ${record.motionResult}`);
    if (record.error) lines.push(`- Error: ${record.error}`);
    for (const identifier of record.identifiers) lines.push(`- ${identifier.type}: ${identifier.value}`);
    if (record.textPreview) lines.push(``, record.textPreview, ``);
  }
  return `${lines.join("\n")}\n`;
}

function knownMarkdown(detail: NonNullable<ReturnType<typeof getConsultationBySlug>>, outcomes: Awaited<ReturnType<UpdateChecker["checkConsultation"]>>, live: boolean) {
  const lines = [
    `# ${detail.title}`, ``, detail.summary, ``,
    `Checked: ${new Date().toISOString()}`, `Mode: ${live ? "live official sources" : "saved snapshots"}`, ``,
    `## Check outcomes`, ``,
    ...outcomes.map((item) => `- ${item.sourceId}: ${item.status}${item.error ? ` — ${item.error}` : ""}`), ``,
    `## Decision trail`, ``,
    ...detail.events.map((event) => `- ${event.eventDate} — **${event.title}**: ${event.description}`), ``,
    `## Sources`, ``,
    ...detail.sources.map((source) => `- [${source.title}](${source.url}) — ${source.sourceSystem}; ${source.identifiers.map((id) => `${id.type}=${id.value}`).join(", ")}`), ``,
    `## Matching evidence`, ``,
    ...detail.relationships.flatMap((relationship) => [`- **${relationship.confidence} / ${relationship.relationshipType}**`, ...relationship.signals.map((signal) => `  - ${signal.type}: ${signal.value}`)]), ``,
    `## Feedback and response`, ``,
    ...detail.feedback.map((theme) => `- **${theme.theme}** — ${theme.responseStatus}: ${theme.response}`), ``,
    `## Commitments`, ``,
    ...detail.commitments.map((commitment) => `- **${commitment.status}** — ${commitment.action} (${commitment.owner})`), ``,
  ];
  return lines.join("\n");
}

async function main() {
  const input = process.argv.slice(2).find((argument) => !argument.startsWith("--"));
  if (!input) throw new Error("Usage: npm run check-consultation -- <slug|consultation-id|official-url> [--saved]");
  const db = getDb();
  const match = db.prepare(`
    SELECT DISTINCT c.id, c.slug FROM consultations c
    LEFT JOIN source_documents s ON s.consultation_id = c.id
    WHERE c.slug = ? OR c.id = ? OR s.url = ? LIMIT 1
  `).get(input, input, input) as MatchRow | undefined;

  if (match) {
    const live = !process.argv.includes("--saved");
    const provider = process.argv.includes("--openai") ? new OpenAISemanticProvider()
      : process.argv.includes("--fixture") ? new FixtureSemanticProvider()
        : process.argv.includes("--local") ? new LocalSemanticProvider()
          : process.argv.includes("--gemini") ? new GeminiSemanticProvider()
            : createDefaultSemanticProvider();
    console.log(`${live ? "Live-checking" : "Checking saved snapshots for"} ${match.slug}…`);
    const outcomes = await new UpdateChecker(db, provider).checkConsultation(match.id, live);
    const detail = getConsultationBySlug(match.slug, db);
    if (!detail) throw new Error("Consultation disappeared after check");
    const report = { mode: live ? "live_refresh" : "snapshot_refresh", consultation: detail, outcomes };
    const paths = writeReport(match.slug, report, knownMarkdown(detail, outcomes, live));
    for (const outcome of outcomes) console.log(`${outcome.sourceId}: ${outcome.status}${outcome.error ? ` (${outcome.error})` : ""}`);
    console.log(`Evidence report: ${paths.markdownPath}`);
    console.log(`Machine-readable report: ${paths.jsonPath}`);
    if (outcomes.every((item) => item.status === "failed")) process.exitCode = 1;
    return;
  }

  if (!/^https?:\/\//.test(input)) {
    const available = db.prepare("SELECT slug FROM consultations ORDER BY slug").all() as unknown as Array<{ slug: string }>;
    throw new Error(`Unknown consultation. Use an official Ottawa URL or one of: ${available.map((item) => item.slug).join(", ")}`);
  }
  console.log(`Discovering official records linked from ${input}…`);
  const report = await discoverOfficialConsultation(input);
  const name = safeName(new URL(input).pathname);
  const paths = writeReport(name, report, discoveryMarkdown(report));
  console.log(`Retrieved ${report.records.filter((record) => record.retrievalStatus === "success").length} of ${report.records.length} directly linked official records.`);
  for (const record of report.records) console.log(`${record.retrievalStatus === "success" ? "✓" : "×"} ${record.title} — ${record.url}`);
  console.log(`Discovery report: ${paths.markdownPath}`);
  console.log(`Machine-readable report: ${paths.jsonPath}`);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
