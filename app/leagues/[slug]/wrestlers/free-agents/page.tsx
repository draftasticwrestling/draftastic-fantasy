import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLeagueBySlug, getRostersForLeague, getEffectiveLeagueStartDate } from "@/lib/leagues";
import WrestlerList from "@/app/wrestlers/WrestlerList";
import { aggregateWrestlerPoints, getPointsForWrestler } from "@/lib/scoring/aggregateWrestlerPoints.js";
import {
  computeEndOfMonthBeltPoints,
  getCurrentChampionsBySlug,
  getMonthlyBeltForWrestler,
  inferReignsFromEvents,
  mergeReigns,
} from "@/lib/scoring/endOfMonthBeltPoints.js";
import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";
import { isPersonaOnlySlug, getPersonasForDisplay } from "@/lib/scoring/personaResolution.js";

function firstMonthEndOnOrAfter(startDate: string): string {
  const d = new Date(startDate + "T12:00:00");
  const year = d.getFullYear();
  const month = d.getMonth();
  const lastDay = new Date(year, month + 1, 0);
  return lastDay.toISOString().slice(0, 10);
}

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

/** Match profile: all-time uses events from this date; high limit so we don't hit Supabase 1k default. */
const ALL_TIME_EVENTS_FROM = "2020-01-01";
const ALL_TIME_EVENTS_LIMIT = 10000;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  const title = league
    ? `Free Agents — ${league.name} — Draftastic Fantasy`
    : "Free Agents — Draftastic Fantasy";
  return { title };
}

export default async function WrestlersFreeAgentsPage({
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
      .gte("date", ALL_TIME_EVENTS_FROM)
      .order("date", { ascending: true })
      .limit(ALL_TIME_EVENTS_LIMIT),
    getRostersForLeague(league.id),
  ]);

  const wrestlers = wrestlersResult.data ?? [];
  const error = wrestlersResult.error;
  const onRosterIds = new Set<string>();
  for (const entries of Object.values(rosters ?? {})) {
    for (const e of entries) {
      onRosterIds.add(String(e.wrestler_id).toLowerCase());
    }
  }

  const { data: rawReigns } = await supabase
    .from("championship_history")
    .select("champion_slug, champion_id, champion, champion_name, title, title_name, won_date, start_date, lost_date, end_date")
    .order("won_date", { ascending: true });
  const tableReigns = (rawReigns ?? []) as ChampionshipReign[];
  const inferredReigns = inferReignsFromEvents(eventsAll ?? []);
  const reigns = mergeReigns(tableReigns, inferredReigns) as ChampionshipReign[];

  const pointsBySlug = aggregateWrestlerPoints(eventsSinceStart ?? []);
  const points2025BySlug = aggregateWrestlerPoints(events2025 ?? []);
  const points2026BySlug = aggregateWrestlerPoints(events2026 ?? []);
  const pointsAllTimeBySlug = aggregateWrestlerPoints(eventsAll ?? []);
  const firstEligibleMonthEnd = firstMonthEndOnOrAfter(startDate);
  const endOfMonthBeltPoints = computeEndOfMonthBeltPoints(reigns, firstEligibleMonthEnd);
  const firstEligibleMonthEndAllTime = "2020-01-31";
  const endOfMonthBeltPointsAllTime = computeEndOfMonthBeltPoints(reigns, firstEligibleMonthEndAllTime);
  const endOfMonthBeltPoints2025 = computeEndOfMonthBeltPoints(reigns, "2025-01-31", "2025-12-31");
  const endOfMonthBeltPoints2026 = computeEndOfMonthBeltPoints(reigns, "2026-01-31");
  const currentChampionsBySlug = getCurrentChampionsBySlug(reigns);

  const wrestlersFiltered = (wrestlers ?? []).filter(
    (w) => !isPersonaOnlySlug(w.id) && !onRosterIds.has(String(w.id).toLowerCase())
  );
  const rows = wrestlersFiltered.map((w) => {
    const slugKey = w.id;
    const nameKey = w.name ? normalizeWrestlerName(w.name) : "";
    const canonicalKey = nameKey || (slugKey ? normalizeWrestlerName(String(slugKey)) : "") || slugKey;
    // Use slugKey (stable id/slug) first so points match when display name changed (e.g. Natalya → Nattie, slug still natalya)
    const points = getPointsForWrestler(pointsBySlug, slugKey, nameKey);
    const points2025 = getPointsForWrestler(points2025BySlug, slugKey, nameKey);
    const points2026 = getPointsForWrestler(points2026BySlug, slugKey, nameKey);
    const pointsAllTime = getPointsForWrestler(pointsAllTimeBySlug, slugKey, nameKey);
    const extraBelt = getMonthlyBeltForWrestler(endOfMonthBeltPoints, slugKey, nameKey);
    const extraBeltAllTime = getMonthlyBeltForWrestler(endOfMonthBeltPointsAllTime, slugKey, nameKey);
    const extraBelt2025 = getMonthlyBeltForWrestler(endOfMonthBeltPoints2025, slugKey, nameKey);
    const extraBelt2026 = getMonthlyBeltForWrestler(endOfMonthBeltPoints2026, slugKey, nameKey);
    const beltPoints = points.beltPoints + extraBelt;
    const totalPoints = points.rsPoints + points.plePoints + beltPoints;
    const beltPointsAllTime = pointsAllTime.beltPoints + extraBeltAllTime;
    const totalPointsAllTime =
      pointsAllTime.rsPoints + pointsAllTime.plePoints + beltPointsAllTime;
    const beltPoints2025 = points2025.beltPoints + extraBelt2025;
    const beltPoints2026 = points2026.beltPoints + extraBelt2026;
    const titles =
      currentChampionsBySlug[canonicalKey] ?? currentChampionsBySlug[slugKey] ?? (nameKey ? currentChampionsBySlug[nameKey] : null) ?? [];
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
      <h1 style={{ fontSize: "1.5rem", marginBottom: 8 }}>Free Agents</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 24 }}>
        Wrestlers not on any team in this league. Same table and filters as League Leaders; add them from your team page (Roster) or during the draft.
      </p>

      {error && (
        <p style={{ color: "var(--color-red)", marginBottom: 16 }}>
          Error loading wrestlers: {error.message}
        </p>
      )}

      {rows.length === 0 && !error && (
        <p style={{ color: "var(--color-text-muted)" }}>
          No free agents. Every wrestler in the pool is already on a team in this league.
        </p>
      )}

      {rows.length > 0 && (
        <WrestlerList
          wrestlers={rows}
          defaultSortColumn="totalPoints"
          defaultSortDir="desc"
          defaultPointsPeriod="allTime"
        />
      )}
    </main>
  );
}
