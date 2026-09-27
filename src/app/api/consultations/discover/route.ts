import { after, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { enrichConsultation, importOfficialConsultation } from "@/lib/importer";
import { createDefaultSemanticProvider } from "@/lib/semantic";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { url?: unknown };
  try {
    body = await request.json() as { url?: unknown };
  } catch {
    return NextResponse.json({ error: "Send a JSON body with an official consultation URL." }, { status: 400 });
  }
  if (typeof body.url !== "string" || body.url.trim().length === 0 || body.url.length > 2_000) {
    return NextResponse.json({ error: "Enter a valid official City of Ottawa consultation URL." }, { status: 400 });
  }
  try {
    const result = await importOfficialConsultation(getDb(), body.url, { semanticProvider: null });
    if (!result.existing) after(async () => {
      const db = getDb();
      try {
        const enrichment = await enrichConsultation(db, result.consultationId, createDefaultSemanticProvider());
        if (enrichment.analysisCount > 0) db.prepare(`INSERT OR IGNORE INTO notifications
          (id, consultation_id, event_id, kind, title, message, created_at)
          VALUES (?, ?, NULL, 'analysis_completed', 'Plain-language analysis ready', ?, ?)`) 
          .run(`note-analysis-${result.consultationId}`, result.consultationId,
            `CivicLoop analyzed ${enrichment.analysisCount} official ${enrichment.analysisCount === 1 ? "record" : "records"} and updated the case summary.`, new Date().toISOString());
      } catch (error) {
        db.prepare("UPDATE consultations SET build_status = 'failed', build_error = ? WHERE id = ?")
          .run(error instanceof Error ? error.message.slice(0, 2_000) : "Plain-language analysis failed.", result.consultationId);
      }
    });
    return NextResponse.json(result, { status: result.existing ? 200 : 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The consultation could not be imported." }, { status: 400 });
  }
}
