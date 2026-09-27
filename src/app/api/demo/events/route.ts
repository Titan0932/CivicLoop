import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { publishDemoConsultationEvent } from "@/lib/notifications";

const statuses = ["open", "awaiting_results", "results_published", "awaiting_decision", "approved", "implementation_underway", "completed", "no_recent_update"] as const;
const DemoEventSchema = z.object({
  consultationId: z.string().min(1),
  title: z.string().trim().min(3).max(100),
  message: z.string().trim().min(5).max(500),
  lifecycleStatus: z.enum(statuses).nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const input = DemoEventSchema.parse(await request.json());
    return NextResponse.json(publishDemoConsultationEvent(getDb(), input), { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Check the event details" }, { status: 400 });
    const message = error instanceof Error ? error.message : "The demo event could not be published";
    return NextResponse.json({ error: message }, { status: message === "Consultation not found" ? 404 : 500 });
  }
}
