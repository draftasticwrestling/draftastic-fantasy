import { NextResponse } from "next/server";
import { recordEngagementEvent } from "@/lib/engagementEvents";
import { getServerAuth } from "@/lib/supabase/serverAuth";

export async function POST() {
  const { user } = await getServerAuth();
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  await recordEngagementEvent({
    eventName: "page.how_it_works_view",
    userId: user.id,
    path: "/how-it-works",
  });

  return NextResponse.json({ ok: true });
}
