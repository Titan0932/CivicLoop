import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { setConsultationTracking } from "@/lib/notifications";

async function updateTracking(id: string, tracking: boolean) {
  try {
    setConsultationTracking(getDb(), id, tracking);
    return NextResponse.json({ consultationId: id, tracking });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tracking could not be updated";
    return NextResponse.json({ error: message }, { status: message === "Consultation not found" ? 404 : 500 });
  }
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return updateTracking((await context.params).id, true);
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  return updateTracking((await context.params).id, false);
}
