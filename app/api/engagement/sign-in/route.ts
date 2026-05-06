import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import { recordEngagementEvent } from "@/lib/engagementEvents";
import { processDailyLoginXp } from "@/lib/xp/processDailyLoginXp";

export async function POST() {
  const { supabase, user } = await getServerAuth();
  if (!user) return NextResponse.json({ ok: true });

  const { data: membership } = await supabase
    .from("league_members")
    .select("leagues!inner(season_slug, is_archived)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  const seasonSlug =
    (((membership as { leagues?: { season_slug?: string | null; is_archived?: boolean | null } | null } | null)
      ?.leagues?.is_archived
      ? null
      : (membership as { leagues?: { season_slug?: string | null } | null } | null)?.leagues?.season_slug) ??
      null) || null;

  await recordEngagementEvent({
    eventName: "auth.sign_in",
    userId: user.id,
    seasonSlug,
    path: "/auth/callback",
  });
  await processDailyLoginXp(user.id);
  return NextResponse.json({ ok: true });
}
