import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveLeagueStartDate, getLeagueBySlug } from "@/lib/leagues";
import { buildLeagueSeasonTimeline } from "@/lib/leagueSeasonTimeline";

type RouteContext = { params: Promise<{ slug: string }> };

/**
 * GET /api/leagues/[slug]/season-timeline
 * Member-only. Raw/SmackDown + season finale PLEs between effective league start (draft-first) and end_date.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const league = await getLeagueBySlug(slug);
  if (!league) {
    return NextResponse.json({ error: "League not found or access denied." }, { status: 404 });
  }

  const effectiveStart = getEffectiveLeagueStartDate(league);
  const endRaw = league.end_date ? String(league.end_date).slice(0, 10) : null;
  const windowEnd = endRaw && /^\d{4}-\d{2}-\d{2}$/.test(endRaw) ? endRaw : "2099-12-31";

  const supabase = await createClient();
  const { data: eventRows, error } = await supabase
    .from("events")
    .select("id, name, date, status")
    .gte("date", effectiveStart)
    .lte("date", windowEnd)
    .order("date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const todayYmd = new Date().toISOString().slice(0, 10);
  const payload = buildLeagueSeasonTimeline({
    events: (eventRows ?? []) as { id: string; name: string | null; date: string | null; status: string | null }[],
    effectiveStartYmd: effectiveStart,
    endDateYmd: endRaw,
    todayYmd,
  });

  return NextResponse.json(payload);
}
