import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { updateNotificationPreferences } from "@/lib/notifications";
import { getNotificationPreferences } from "@/lib/queries";

const PreferenceSchema = z.object({
  email: z.union([z.email(), z.literal("")]).transform((value) => value || null),
  phone: z.union([z.string().trim().regex(/^\+?[0-9 ()-]{7,25}$/, "Enter a valid phone number"), z.literal("")]).transform((value) => value || null),
  inAppEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  smsEnabled: z.boolean(),
}).superRefine((value, context) => {
  if (value.emailEnabled && !value.email) context.addIssue({ code: "custom", path: ["email"], message: "Add an email address to enable email" });
  if (value.smsEnabled && !value.phone) context.addIssue({ code: "custom", path: ["phone"], message: "Add a phone number to enable SMS" });
});

export async function PATCH(request: Request) {
  try {
    const body = PreferenceSchema.parse(await request.json());
    const db = getDb();
    updateNotificationPreferences(db, body);
    return NextResponse.json({ preferences: getNotificationPreferences(undefined, db) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Check the notification settings" }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Preferences could not be saved" }, { status: 500 });
  }
}
