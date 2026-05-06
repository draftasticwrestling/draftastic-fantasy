import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import { processDailyLoginXp } from "@/lib/xp/processDailyLoginXp";

export async function POST() {
  const { user } = await getServerAuth();
  if (!user) return NextResponse.json({ ok: true });
  await processDailyLoginXp(user.id);
  return NextResponse.json({ ok: true });
}
