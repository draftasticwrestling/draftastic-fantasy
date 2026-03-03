import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLeagueBySlug, getLeagueMembers, getRostersForLeague, getEffectiveLeagueStartDate } from "@/lib/leagues";
import WrestlerList from "@/app/wrestlers/WrestlerList";
import { aggregateWrestlerPoints } from "@/lib/scoring/aggregateWrestlerPoints.js";
import {
  computeEndOfMonthBeltPoints,
  getCurrentChampionsBySlug,
  inferReignsFromEvents,
  mergeReigns,
} from "@/lib/scoring/endOfMonthBeltPoints.js";

/** First month-end eligible for belt points when using "since league start" (last day of the month that contains startDate). */
function firstMonthEndOnOrAfter(startDate: string): string {
  const d = new Date(startDate + "T12:00:00");
  const year = d.getFullYear();
  const month = d.getMonth();
  const lastDay = new Date(year, month + 1, 0);
  return lastDay.toISOString().slice(0, 10);
}
import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";
import { isPersonaOnlySlug, getPersonasForDisplay } from "@/lib/scoring/personaResolution.js";

function read2kRating(row: Record<string, unknown>, key: string): number | null {
  const v = row[key];
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

type ChampionshipReign = {
  champion_slug?: string | null;
  champion_id?: string | null;
  champion?: string | null;
  champion_name?: string | null;
  title?: string | null;
  title_name?: string | null;
  won_date?: string | null;
  start_date?: string | null;
  lost_date?: string | null;
  end_date?: string | null;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  const title = league
    ? `League Leaders — ${league.name} — Draftastic Fantasy`
    : "League Leaders — Draftastic Fantasy";
  return { title };
}

export default async function LeagueLeadersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const league = await getLeagueBySlug(slug);
  if (!league) {
    redirect("/leagues");
  }

  const startDate = getEffectiveLeagueStartDate(league);

  const [
    wrestlersResult,
    { data: eventsSinceStart },
    { data: events2025 },
    { data: events2026 },
    { data: eventsAll },
    rosters,
    members,
  ] = await Promise.all([
    (async () => {
      // Column is "Status" (capital S) in DB; avoid .or("status...") and select "Status" only
      const r = await supabase
        .from("wrestlers")
        .select('id, name, gender, brand, image_url, dob, "Status", "2K26 rating", "2K25 rating"')
        .order("name", { ascending: true });
      return r;
    })(),
    supabase
      .from("events")
      .select("id, name, date, matches")
      .eq("status", "completed")
      .gte("date", startDate)
      .order("date", { ascending: true }),
    supabase
      .from("events")
      .select("id, name, date, matches")
      .eq("status", "completed")
      .gte("date", "2025-01-01")
      .lte("date", "2025-12-31")
      .order("date", { ascending: true }),
    supabase
      .from("events")
      .select("id, name, date, matches")
      .eq("status", "completed")
      .gte("date", "2026-01-01")
      .lte("date", "2026-12-31")
      .order("date", { ascending: true }),
    supabase
      .from("events")
      .select("id, name, date, matches")
      .eq("status", "completed")
      .order("date", { ascending: true }),
    getRostersForLeague(league.id),
    getLeagueMembers(league.id),
  ]);

  const memberByUserId = Object.fromEntries((members ?? []).map((m) => [m.user_id, m]));
  const rosterByWrestler: Record<string, { ownerName: string; ownerUserId: string }> = {};
  for (const [uid, entries] of Object.entries(rosters ?? {})) {
    const ownerName =
      (memberByUserId[uid]?.team_name?.trim() || memberByUserId[uid]?.display_name?.trim()) || "Owner";
    for (const e of entries) {
      rosterByWrestler[e.wrestler_id] = { ownerName, ownerUserId: uid };
    }
  }

  const { data: rawReigns } = await supabase
    .from("championship_history")
    .select("champion_slug, champion_id, champion, champion_name, title, title_name, won_date, start_date, lost_date, end_date")
    .order("won_date", { ascending: true });
  const tableReigns = (rawReigns ?? []) as ChampionshipReign[];
  const inferredReigns = inferReignsFromEvents(eventsSinceStart ?? []);
  const reigns = mergeReigns(tableReigns, inferredReigns) as ChampionshipReign[];

  const pointsBySlug = aggregateWrestlerPoints(eventsSinceStart ?? []);
  const points2025BySlug = aggregateWrestlerPoints(events2025 ?? []);
  const points2026BySlug = aggregateWrestlerPoints(events2026 ?? []);
  const pointsAllTimeBySlug = aggregateWrestlerPoints(eventsAll ?? []);
  // Only award end-of-month belt points for month-ends on or after league start (e.g. league started 2/20/26 → first eligible month-end is 2/28/26; current month excluded until passed).
  const firstEligibleMonthEnd = firstMonthEndOnOrAfter(startDate);
  const endOfMonthBeltPoints = computeEndOfMonthBeltPoints(reigns, firstEligibleMonthEnd);
  const firstEligibleMonthEndAllTime = "2020-01-31";
  const endOfMonthBeltPointsAllTime = computeEndOfMonthBeltPoints(reigns, firstEligibleMonthEndAllTime);
  const endOfMonthBeltPoints2025 = computeEndOfMonthBeltPoints(reigns, "2025-01-31", "2025-12-31");
  const endOfMonthBeltPoints2026 = computeEndOfMonthBeltPoints(reigns, "2026-01-31");
  const currentChampionsBySlug = getCurrentChampionsBySlug(reigns);

  const wrestlers = wrestlersResult.data ?? [];
  const error = wrestlersResult.error;
  const wrestlersFiltered = (wrestlers ?? []).filter((w) => !isPersonaOnlySlug(w.id));
  const rows = wrestlersFiltered.map((w) => {
    const points = pointsBySlug[w.id] ?? { rsPoints: 0, plePoints: 0, beltPoints: 0 };
    const points2025 = points2025BySlug[w.id] ?? { rsPoints: 0, plePoints: 0, beltPoints: 0 };
    const points2026 = points2026BySlug[w.id] ?? { rsPoints: 0, plePoints: 0, beltPoints: 0 };
    const pointsAllTime = pointsAllTimeBySlug[w.id] ?? { rsPoints: 0, plePoints: 0, beltPoints: 0 };
    const slugKey = w.id;
    const nameKey = w.name ? normalizeWrestlerName(w.name) : "";
    const extraBelt =
      (typeof endOfMonthBeltPoints[slugKey] === "number" ? endOfMonthBeltPoints[slugKey] : null) ??
      (nameKey && typeof endOfMonthBeltPoints[nameKey] === "number" ? endOfMonthBeltPoints[nameKey] : null) ??
      0;
    const extraBeltAllTime =
      (typeof endOfMonthBeltPointsAllTime[slugKey] === "number" ? endOfMonthBeltPointsAllTime[slugKey] : null) ??
      (nameKey && typeof endOfMonthBeltPointsAllTime[nameKey] === "number" ? endOfMonthBeltPointsAllTime[nameKey] : null) ??
      0;
    const extraBelt2025 =
      (typeof endOfMonthBeltPoints2025[slugKey] === "number" ? endOfMonthBeltPoints2025[slugKey] : null) ??
      (nameKey && typeof endOfMonthBeltPoints2025[nameKey] === "number" ? endOfMonthBeltPoints2025[nameKey] : null) ??
      0;
    const extraBelt2026 =
      (typeof endOfMonthBeltPoints2026[slugKey] === "number" ? endOfMonthBeltPoints2026[slugKey] : null) ??
      (nameKey && typeof endOfMonthBeltPoints2026[nameKey] === "number" ? endOfMonthBeltPoints2026[nameKey] : null) ??
      0;
    const beltPoints = points.beltPoints + extraBelt;
    const totalPoints = points.rsPoints + points.plePoints + beltPoints;
    const beltPointsAllTime = pointsAllTime.beltPoints + extraBeltAllTime;
    const totalPointsAllTime =
      pointsAllTime.rsPoints + pointsAllTime.plePoints + beltPointsAllTime;
    const beltPoints2025 = points2025.beltPoints + extraBelt2025;
    const beltPoints2026 = points2026.beltPoints + extraBelt2026;
    const titles =
      currentChampionsBySlug[slugKey] ?? (nameKey ? currentChampionsBySlug[nameKey] : null) ?? [];
    const raw = w as Record<string, unknown>;
    return {
      id: w.id,
      name: w.name ?? null,
      gender: w.gender ?? null,
      brand: w.brand ?? null,
      image_url: (w as { image_url?: string }).image_url ?? null,
      dob: (w as { dob?: string }).dob ?? null,
      rating_2k26: read2kRating(w as Record<string, unknown>, "2K26 rating"),
      rating_2k25: read2kRating(w as Record<string, unknown>, "2K25 rating"),
      rsPoints: points.rsPoints,
      plePoints: points.plePoints,
      beltPoints,
      totalPoints,
      rsPoints2025: points2025.rsPoints,
      plePoints2025: points2025.plePoints,
      beltPoints2025,
      totalPoints2025: points2025.rsPoints + points2025.plePoints + beltPoints2025,
      rsPoints2026: points2026.rsPoints,
      plePoints2026: points2026.plePoints,
      beltPoints2026,
      totalPoints2026: points2026.rsPoints + points2026.plePoints + beltPoints2026,
      rsPointsAllTime: pointsAllTime.rsPoints,
      plePointsAllTime: pointsAllTime.plePoints,
      beltPointsAllTime,
      totalPointsAllTime,
      personaDisplay: getPersonasForDisplay(w.id) ?? null,
      status: (raw.Status ?? raw.status) != null ? String(raw.Status ?? raw.status) : null,
      currentChampionship: titles.length > 0 ? titles.join(", ") : null,
    };
  });

  return (
    <main className="app-page" style={{ maxWidth: 1200, margin: "0 auto" }}>
      <p style={{ marginBottom: 16 }}>
        <Link href={`/leagues/${slug}`} className="app-link" style={{ fontWeight: 600 }}>
          ← {league.name}
        </Link>
      </p>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 8 }}>League Leaders</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 24 }}>
        Wrestlers ranked by fantasy points to date. Sorted by highest total first; you can re-sort by any column.
      </p>

      {error && (
        <p style={{ color: "var(--color-red)", marginBottom: 16 }}>
          Error loading wrestlers: {error.message}
        </p>
      )}

      {rows.length === 0 && !error && (
        <p style={{ color: "var(--color-text-muted)" }}>No wrestlers in the database yet.</p>
      )}

      {rows.length > 0 && (
        <WrestlerList
          wrestlers={rows}
          defaultSortColumn="totalPoints"
          defaultSortDir="desc"
          defaultPointsPeriod="allTime"
          leagueSlug={slug}
          rosterByWrestler={rosterByWrestler}
        />
      )}
    </main>
  );
}
