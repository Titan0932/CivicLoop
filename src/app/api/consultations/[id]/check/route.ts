import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getConsultationById } from "@/lib/queries";
import { createDefaultSemanticProvider } from "@/lib/semantic";
import { UpdateChecker } from "@/lib/update-checker";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!getConsultationById(id)) return NextResponse.json({ error: "Consultation not found" }, { status: 404 });
  const results = await new UpdateChecker(getDb(), createDefaultSemanticProvider()).checkConsultation(id, true);
  const failed = results.filter((item) => item.status === "failed");
  const changed = results.filter((item) => item.status === "changed");
  const analysisWarnings = results.filter((item) => item.semanticError);
  return NextResponse.json({
    outcome: failed.length ? "failed" : changed.length ? "changed" : "unchanged",
    message: failed.length
      ? `${failed.length} source check${failed.length === 1 ? "" : "s"} failed. This is a retrieval problem, not evidence that no public update exists.`
      : changed.length
        ? `${changed.length} changed source${changed.length === 1 ? " was" : "s were"} found.${analysisWarnings.length ? " The update was saved, but AI analysis needs another attempt." : " AI analysis was run for the changed content."}`
        : `Checked ${results.length} live official ${results.length === 1 ? "source" : "sources"}. No meaningful change was found; AI analysis was skipped.`,
    results,
  });
}
