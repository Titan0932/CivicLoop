import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { markInAppNotificationsRead } from "@/lib/notifications";

export async function POST() {
  return NextResponse.json({ markedRead: markInAppNotificationsRead(getDb()) });
}
