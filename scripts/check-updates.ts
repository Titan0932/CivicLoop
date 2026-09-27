import { getDb } from "../src/lib/db";
import nextEnv from "@next/env";
import { createDefaultSemanticProvider, FixtureSemanticProvider, GeminiSemanticProvider, LocalSemanticProvider, OpenAISemanticProvider } from "../src/lib/semantic";
import { UpdateChecker } from "../src/lib/update-checker";

nextEnv.loadEnvConfig(process.cwd());

async function main() {
  const live = process.argv.includes("--live");
  const provider = process.argv.includes("--openai") ? new OpenAISemanticProvider()
    : process.argv.includes("--fixture") ? new FixtureSemanticProvider()
      : process.argv.includes("--local") ? new LocalSemanticProvider()
        : process.argv.includes("--gemini") ? new GeminiSemanticProvider()
          : createDefaultSemanticProvider();
  const results = await new UpdateChecker(getDb(), provider).checkAll(live);
  const changed = results.filter((item) => item.status === "changed").length;
  const failed = results.filter((item) => item.status === "failed").length;
  console.log(`Checked ${results.length} sources: ${changed} changed, ${failed} failed, ${results.length - changed - failed} unchanged.`);
  for (const item of results) console.log(`${item.sourceId}: ${item.status}${item.error ? ` (${item.error})` : ""}`);
  if (failed) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
