import nextEnv from "@next/env";
import { getDb } from "../src/lib/db";
import { runMonitoringCycle } from "../src/lib/monitoring";
import { createDefaultSemanticProvider, FixtureSemanticProvider, GeminiSemanticProvider, LocalSemanticProvider, OpenAISemanticProvider, type SemanticProvider } from "../src/lib/semantic";

nextEnv.loadEnvConfig(process.cwd());

function providerFromArgs(): SemanticProvider {
  if (process.argv.includes("--openai")) return new OpenAISemanticProvider();
  if (process.argv.includes("--fixture")) return new FixtureSemanticProvider();
  if (process.argv.includes("--local")) return new LocalSemanticProvider();
  if (process.argv.includes("--gemini")) return new GeminiSemanticProvider();
  return createDefaultSemanticProvider();
}

async function cycle() {
  const result = await runMonitoringCycle(getDb(), providerFromArgs(), { includeAll: process.argv.includes("--all") });
  console.log(`Monitoring cycle: ${result.checkedConsultations} consultations, ${result.checkedSources} sources, ${result.changedSources} changed, ${result.failedSources} failed.`);
  for (const item of result.results) console.log(`${item.sourceId}: ${item.status}${item.semanticError ? ` · AI: ${item.semanticError}` : ""}${item.error ? ` · ${item.error}` : ""}`);
  if (result.failedSources) process.exitCode = 1;
}

async function main() {
  await cycle();
  if (!process.argv.includes("--watch")) return;
  const rawMinutes = process.argv.find((argument) => argument.startsWith("--interval-minutes="))?.split("=")[1];
  const minutes = Math.max(5, Number(rawMinutes || 60));
  console.log(`Monitoring continuously every ${minutes} minutes. Stop with Ctrl+C.`);
  setInterval(() => { cycle().catch((error) => console.error(error)); }, minutes * 60 * 1000);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
