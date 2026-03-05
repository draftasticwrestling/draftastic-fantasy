import Link from "next/link";
import { supabase } from "@/lib/supabase";
import WrestlerList, { type WrestlerRow } from "@/app/wrestlers/WrestlerList";
import { aggregateWrestlerPoints, getPointsForWrestler } from "@/lib/scoring/aggregateWrestlerPoints.js";
import { aggregateWrestlerMatchStats, getMatchStatsForWrestler } from "@/lib/scoring/aggregateWrestlerMatchStats.js";
import {
  computeEndOfMonthBeltPoints,
  getCurrentChampionsBySlug,
  getMonthlyBeltForWrestler,
  inferReignsFromEvents,
  mergeReigns,
} from "@/lib/scoring/endOfMonthBeltPoints.js";
import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";
import { isPersonaOnlySlug, getPersonasForDisplay } from "@/lib/scoring/personaResolution.js";

const ADMIN_SINCE_DATE = "2025-01-01";
/** Match profile: all-time uses events from this date; high limit so we don't hit Supabase 1k default. */
const ALL_TIME_EVENTS_FROM = "2020-01-01";
const ALL_TIME_EVENTS_LIMIT = 10000;

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

export const metadata = {
  title: "Wrestlers — Admin — Draftastic Fantasy",
  description: "Admin table: same as League Leaders. Test profile links without logging in.",
};

export const dynamic = "force-dynamic";

export default async function AdminWrestlersPage() {
  // Use singleton (same as main /wrestlers) so table and profile page share the same data source
  const [
    wrestlersResult,
    { data: eventsSinceStart },
    { data: events2025 },
    { data: events2026 },
    { data: eventsAll },
    { data: rawReigns },
  ] = await Promise.all([
    supabase
      .from("wrestlers")
      .select('id, name, gender, brand, image_url, dob, "Status", "2K26 rating", "2K25 rating"')
      .order("name", { ascending: true }),
    supabase
      .from("events")
      .select("id, name, date, matches")
      .eq("status", "completed")
      .gte("date", ADMIN_SINCE_DATE)
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
      .order("date", { ascending: true }),
    supabase
      .from("events")
      .select("id, name, date, matches")
      .eq("status", "completed")
      .gte("date", ALL_TIME_EVENTS_FROM)
      .order("date", { ascending: true })
      .limit(ALL_TIME_EVENTS_LIMIT),
    supabase
      .from("championship_history")
      .select("champion_slug, champion_id, champion, champion_name, title, title_name, won_date, start_date, lost_date, end_date")
      .order("won_date", { ascending: true }),
  ]);

  const tableReigns = (rawReigns ?? []) as ChampionshipReign[];
  const inferredReigns = inferReignsFromEvents(eventsAll ?? []);
  const reigns = mergeReigns(tableReigns, inferredReigns) as ChampionshipReign[];

  const pointsBySlug = aggregateWrestlerPoints(eventsSinceStart ?? []);
  const points2025BySlug = aggregateWrestlerPoints(events2025 ?? []);
  const points2026BySlug = aggregateWrestlerPoints(events2026 ?? []);
  const pointsAllTimeBySlug = aggregateWrestlerPoints(eventsAll ?? []);
  const matchStatsBySlug = aggregateWrestlerMatchStats(eventsSinceStart ?? []);
  const matchStats2025BySlug = aggregateWrestlerMatchStats(events2025 ?? []);
  const matchStats2026BySlug = aggregateWrestlerMatchStats(events2026 ?? []);
  const matchStatsAllTimeBySlug = aggregateWrestlerMatchStats(eventsAll ?? []);
  const firstEligibleMonthEnd = firstMonthEndOnOrAfter(ADMIN_SINCE_DATE);
  const endOfMonthBeltPoints = computeEndOfMonthBeltPoints(reigns, firstEligibleMonthEnd);
  const firstEligibleMonthEndAllTime = "2020-01-31";
  const endOfMonthBeltPointsAllTime = computeEndOfMonthBeltPoints(reigns, firstEligibleMonthEndAllTime);
  const endOfMonthBeltPoints2025 = computeEndOfMonthBeltPoints(reigns, "2025-01-31", "2025-12-31");
  const endOfMonthBeltPoints2026 = computeEndOfMonthBeltPoints(reigns, "2026-01-31");
  const currentChampionsBySlug = getCurrentChampionsBySlug(reigns);

  const wrestlers = wrestlersResult.data ?? [];
  const error = wrestlersResult.error;
  const wrestlersFiltered = (wrestlers ?? []).filter((w: { id: string }) => !isPersonaOnlySlug(w.id));
  const rows = wrestlersFiltered.map((w: Record<string, unknown>) => {
    const slugKey = w.id as string;
    const nameKey = w.name ? normalizeWrestlerName(String(w.name)) : "";
    const canonicalKey = nameKey || (slugKey ? normalizeWrestlerName(String(slugKey)) : "") || slugKey;
    // Use slugKey (stable id/slug) first so points match when display name changed (e.g. Natalya → Nattie, slug still natalya)
    const points = getPointsForWrestler(pointsBySlug, slugKey, nameKey);
    const points2025 = getPointsForWrestler(points2025BySlug, slugKey, nameKey);
    const points2026 = getPointsForWrestler(points2026BySlug, slugKey, nameKey);
    const pointsAllTime = getPointsForWrestler(pointsAllTimeBySlug, slugKey, nameKey);
    const matchStats = getMatchStatsForWrestler(matchStatsBySlug, slugKey, nameKey);
    const matchStats2025 = getMatchStatsForWrestler(matchStats2025BySlug, slugKey, nameKey);
    const matchStats2026 = getMatchStatsForWrestler(matchStats2026BySlug, slugKey, nameKey);
    const matchStatsAllTime = getMatchStatsForWrestler(matchStatsAllTimeBySlug, slugKey, nameKey);
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
    return {
      id: String(w.id ?? ""),
      name: (w.name != null ? String(w.name) : null) as string | null,
      gender: (w.gender != null ? String(w.gender) : null) as string | null,
      brand: (w.brand != null ? String(w.brand) : null) as string | null,
      image_url: (w.image_url != null ? String(w.image_url) : null) as string | null,
      dob: (w.dob != null ? String(w.dob) : null) as string | null,
      rating_2k26: read2kRating(w, "2K26 rating"),
      rating_2k25: read2kRating(w, "2K25 rating"),
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
      mw: matchStats.mw,
      win: matchStats.win,
      loss: matchStats.loss,
      nc: matchStats.nc,
      dqw: matchStats.dqw,
      dql: matchStats.dql,
      mw2025: matchStats2025.mw,
      win2025: matchStats2025.win,
      loss2025: matchStats2025.loss,
      nc2025: matchStats2025.nc,
      dqw2025: matchStats2025.dqw,
      dql2025: matchStats2025.dql,
      mw2026: matchStats2026.mw,
      win2026: matchStats2026.win,
      loss2026: matchStats2026.loss,
      nc2026: matchStats2026.nc,
      dqw2026: matchStats2026.dqw,
      dql2026: matchStats2026.dql,
      mwAllTime: matchStatsAllTime.mw,
      winAllTime: matchStatsAllTime.win,
      lossAllTime: matchStatsAllTime.loss,
      ncAllTime: matchStatsAllTime.nc,
      dqwAllTime: matchStatsAllTime.dqw,
      dqlAllTime: matchStatsAllTime.dql,
      personaDisplay: getPersonasForDisplay(String(w.id)) ?? null,
      status: (w.Status ?? w.status) != null ? String(w.Status ?? w.status) : null,
      currentChampionship: titles.length > 0 ? titles.join(", ") : null,
    } satisfies WrestlerRow;
  });

  return (
    <main className="app-page" style={{ maxWidth: 1200, margin: "0 auto" }}>
      <p style={{ marginBottom: 24 }}>
        <Link href="/" className="app-link" style={{ fontWeight: 500 }}>
          ← Home
        </Link>
        {" · "}
        <span style={{ color: "var(--color-text-muted)" }}>Admin</span>
      </p>

      <h1 style={{ fontSize: "1.5rem", marginBottom: 8 }}>League Leaders</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 24 }}>
        Wrestlers ranked by fantasy points to date. Sorted by highest total first; you can re-sort by any column. (Standalone copy for testing profile links.)
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
        />
      )}
    </main>
  );
}
