import Link from "next/link";
import { redirect } from "next/navigation";
import { WrestlerMatchStatsDisclaimer } from "@/app/components/WrestlerMatchStatsDisclaimer";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import { getLeagueBySlug, getLeagueMembers, getRostersForLeague, getEffectiveLeagueStartDate } from "@/lib/leagues";
import WrestlerList from "@/app/wrestlers/WrestlerList";
import { aggregateWrestlerPoints, getPointsForWrestler } from "@/lib/scoring/aggregateWrestlerPoints.js";
import { aggregateWrestlerMatchStats, getMatchStatsForWrestler, getUnparsedMatchesByWrestler, getUnparsedMatchesForWrestler } from "@/lib/scoring/aggregateWrestlerMatchStats.js";
import {
  computeEndOfMonthBeltPoints,
  computeHybridBeltHoldBySlugForCalendarYear,
  computeHybridPublicBeltHoldBySlug,
  computeWeeklyBeltHoldPointsAccumulated,
  firstLegacyCalendarMonthEndEligibleForLeagueStart,
  getCurrentChampionsBySlug,
  getMonthlyBeltForWrestler,
  inferReignsFromEvents,
  mergeReigns,
} from "@/lib/scoring/endOfMonthBeltPoints.js";
import { factionDisplayName } from "@/lib/factionName";
import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";
import { classifyEventType, EVENT_TYPES } from "@/lib/scoring/parsers/eventClassifier.js";
import { isPersonaOnlySlug, getPersonasForDisplay } from "@/lib/scoring/personaResolution.js";
import type { CurrentChampionFromChanges } from "@/lib/championshipCurrentFromChanges";
import { getCurrentChampionsFromChanges } from "@/lib/championshipCurrentFromChanges";
import { getCurrentChampionsFromChampionshipsTable } from "@/lib/championshipCurrentFromTable";
import { getBeltImageUrlForTitle } from "@/lib/championshipBeltOverlay";
import {
  adjustRts2026LeagueAggregateBeltPoints,
  beltScoringLastMonthEndInclusive,
} from "@/lib/beltRts2026JulyDeferral";
import {
  beltScoringLastWeekEndSundayInclusive,
  firstEligibleWeekEndSundayForLeagueStart,
} from "@/lib/beltWeeklyHold";
import { leagueUsesWeeklyPstBeltHold } from "@/lib/leagueStructure";
import { ROAD_TO_SUMMERSLAM_SEASON_SLUG } from "@/lib/leagueStructure";
import { wrestlerRosterFromBrand } from "@/lib/wrestlerRosterFromBrand";
import { EVENT_STATUSES_FOR_SCORING } from "@/lib/eventsScoring";
import {
  LEAGUE_LEADERS_ALL_TIME_EVENTS_FROM,
  LEAGUE_LEADERS_ALL_TIME_EVENTS_LIMIT,
  allTimeLeadersStylePointBreakdown,
} from "@/lib/leagueLeadersAllTimeScoring";

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

/** Allow cached response per league for 5 minutes to reduce repeated heavy queries. */
export const revalidate = 300;

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
  const { supabase } = await getServerAuth();
  const league = await getLeagueBySlug(slug);
  if (!league) {
    redirect("/leagues");
  }

  const startDate = getEffectiveLeagueStartDate(league);

  const [wrestlersResult, rosters, members, { data: rawReigns }, currentFromTable, currentFromChanges] =
    await Promise.all([
      (async () => {
        // Column is "Status" (capital S) in DB; avoid .or("status...") and select "Status" only
        const r = await supabase
          .from("wrestlers")
          .select('id, name, gender, brand, image_url, dob, "Status", "2K26 rating", "2K25 rating"')
          .order("name", { ascending: true });
        return r;
      })(),
      getRostersForLeague(league.id),
      getLeagueMembers(league.id),
      supabase.from("championship_history").select("*"),
      getCurrentChampionsFromChampionshipsTable(supabase).catch((): Record<string, CurrentChampionFromChanges> => ({})),
      getCurrentChampionsFromChanges(supabase).catch((): Record<string, CurrentChampionFromChanges> => ({})),
    ]);

  const wrestlers = wrestlersResult.data ?? [];
  /** Always aggregate from events here — wrestler_stats_cache uses integer columns + different belt windows and skips history when only since-start events are loaded. */
  const wrestlersFiltered = (wrestlers ?? []).filter((w) => !isPersonaOnlySlug(w.id));

  const { data: allEventsData } = await supabase
    .from("events")
    .select("id, name, date, matches")
    .in("status", [...EVENT_STATUSES_FOR_SCORING])
    .gte("date", LEAGUE_LEADERS_ALL_TIME_EVENTS_FROM)
    .order("date", { ascending: true })
    .limit(LEAGUE_LEADERS_ALL_TIME_EVENTS_LIMIT);
  const eventsAll = (allEventsData ?? []) as { id: string; name: string; date: string; matches?: object[] }[];
  const eventsSinceStart = eventsAll.filter((e) => (e.date ?? "") >= startDate);
  const events2025 = eventsAll.filter((e) => (e.date ?? "") >= "2025-01-01" && (e.date ?? "") <= "2025-12-31");
  const events2026 = eventsAll.filter((e) => (e.date ?? "") >= "2026-01-01" && (e.date ?? "") <= "2026-12-31");

  const memberByUserId = Object.fromEntries((members ?? []).map((m) => [m.user_id, m]));
  const rosterByWrestler: Record<string, { ownerName: string; ownerUserId: string }> = {};
  for (const [uid, entries] of Object.entries(rosters ?? {})) {
    const ownerName = factionDisplayName(memberByUserId[uid], "Manager");
    for (const e of entries) {
      rosterByWrestler[e.wrestler_id] = { ownerName, ownerUserId: uid };
    }
  }

  const tableReigns = (rawReigns ?? []) as ChampionshipReign[];
  const inferredReigns = inferReignsFromEvents(eventsAll);
  const reigns = mergeReigns(tableReigns, inferredReigns) as ChampionshipReign[];

  const pointsBySlug = aggregateWrestlerPoints(eventsSinceStart);
  const isNxtEventType = (eventType: string) =>
    eventType === EVENT_TYPES.NXT || eventType.startsWith("nxt-");
  const mainRosterOnlyEventsSinceStart = eventsSinceStart.filter((e) => {
    const t = classifyEventType(e.name ?? "", e.id ?? "");
    return !isNxtEventType(t);
  });
  const pointsBySlugMainRosterOnly = aggregateWrestlerPoints(mainRosterOnlyEventsSinceStart);
  const points2025BySlug = aggregateWrestlerPoints(events2025);
  const points2026BySlug = aggregateWrestlerPoints(events2026);
  const pointsAllTimeBySlug = aggregateWrestlerPoints(eventsAll);

  const matchStatsBySlug = aggregateWrestlerMatchStats(eventsSinceStart);
  const matchStats2025BySlug = aggregateWrestlerMatchStats(events2025);
  const matchStats2026BySlug = aggregateWrestlerMatchStats(events2026);
  const matchStatsAllTimeBySlug = aggregateWrestlerMatchStats(eventsAll);
  // All-time unparsed matches (for "matches needing review" indicator on League Leaders)
  const unparsedBySlug = getUnparsedMatchesByWrestler(
    eventsAll as { id: string; name: string; date: string; matches?: object[] }[]
  );
  const todayYmd = new Date().toISOString().slice(0, 10);
  const beltLastMonthEnd = beltScoringLastMonthEndInclusive(league.end_date);
  const isRtsWeekly = leagueUsesWeeklyPstBeltHold(league.season_slug);
  let endOfMonthBeltPoints: Record<string, number>;
  if (isRtsWeekly) {
    const firstW = firstEligibleWeekEndSundayForLeagueStart(startDate);
    const lastW = beltScoringLastWeekEndSundayInclusive(league.end_date);
    endOfMonthBeltPoints = computeWeeklyBeltHoldPointsAccumulated(reigns, firstW, lastW);
  } else {
    const firstM = firstLegacyCalendarMonthEndEligibleForLeagueStart(startDate);
    endOfMonthBeltPoints = computeEndOfMonthBeltPoints(reigns, firstM, beltLastMonthEnd);
    endOfMonthBeltPoints = adjustRts2026LeagueAggregateBeltPoints(
      endOfMonthBeltPoints,
      reigns,
      firstM,
      league.end_date,
      todayYmd
    );
  }
  const endOfMonthBeltPointsAllTime = computeHybridPublicBeltHoldBySlug(reigns);
  const endOfMonthBeltPoints2025 = computeHybridBeltHoldBySlugForCalendarYear(reigns, 2025);
  const endOfMonthBeltPoints2026 = computeHybridBeltHoldBySlugForCalendarYear(reigns, 2026);
  const currentChampionsBySlug = getCurrentChampionsBySlug(reigns);

  const error = wrestlersResult.error;
  const enforceNxtPendingOnlyForRts = league.season_slug === ROAD_TO_SUMMERSLAM_SEASON_SLUG;
  const rows = wrestlersFiltered.map((w) => {
    const slugKey = w.id;
    const nameKey = w.name ? normalizeWrestlerName(w.name) : "";
    const idKey = normalizeWrestlerName(String(w.id));
    const canonicalKey = nameKey || (slugKey ? normalizeWrestlerName(String(slugKey)) : "") || slugKey;
    // Use slugKey (stable id/slug) first so points match when display name changed (e.g. Natalya → Nattie, slug still natalya)
    const pointsAll = getPointsForWrestler(pointsBySlug, slugKey, nameKey);
    const pointsMainOnly = getPointsForWrestler(pointsBySlugMainRosterOnly, slugKey, nameKey);
    const isNxtRoster = wrestlerRosterFromBrand(w.brand ?? null) === "NXT";
    const useMainOnlyForDisplay = enforceNxtPendingOnlyForRts && isNxtRoster;
    const points = useMainOnlyForDisplay ? pointsMainOnly : pointsAll;
    const extraBelt = getMonthlyBeltForWrestler(endOfMonthBeltPoints, slugKey, nameKey);
    const beltPoints = points.beltPoints + extraBelt;
    const beltPointsAll = pointsAll.beltPoints + extraBelt;
    const totalPoints = points.rsPoints + points.plePoints + beltPoints;
    const totalPointsAll = pointsAll.rsPoints + pointsAll.plePoints + beltPointsAll;
    const nxtPointsPending = useMainOnlyForDisplay ? Math.max(0, totalPointsAll - totalPoints) : 0;
    const matchStats = getMatchStatsForWrestler(matchStatsBySlug, slugKey, nameKey);

    const points2025 = getPointsForWrestler(points2025BySlug, slugKey, nameKey);
    const points2026 = getPointsForWrestler(points2026BySlug, slugKey, nameKey);
    const pointsAllTime = getPointsForWrestler(pointsAllTimeBySlug, slugKey, nameKey);
    const matchStats2025 = getMatchStatsForWrestler(matchStats2025BySlug, slugKey, nameKey);
    const matchStats2026 = getMatchStatsForWrestler(matchStats2026BySlug, slugKey, nameKey);
    const matchStatsAllTime = getMatchStatsForWrestler(matchStatsAllTimeBySlug, slugKey, nameKey);
    const allTimeParts = allTimeLeadersStylePointBreakdown(pointsAllTimeBySlug, endOfMonthBeltPointsAllTime, slugKey, nameKey);
    const beltPointsAllTime = allTimeParts.beltCombined;
    const totalPointsAllTime = allTimeParts.total;
    const extraBelt2025 = getMonthlyBeltForWrestler(endOfMonthBeltPoints2025, slugKey, nameKey);
    const extraBelt2026 = getMonthlyBeltForWrestler(endOfMonthBeltPoints2026, slugKey, nameKey);
    const beltPoints2025 = points2025.beltPoints + extraBelt2025;
    const beltPoints2026 = points2026.beltPoints + extraBelt2026;
    const totalPoints2025Row = points2025.rsPoints + points2025.plePoints + beltPoints2025;
    const totalPoints2026Row = points2026.rsPoints + points2026.plePoints + beltPoints2026;
    const fromTable =
      currentFromTable[idKey] ?? currentFromTable[slugKey] ?? (nameKey ? currentFromTable[nameKey] : null);
    const fromChanges =
      currentFromChanges[idKey] ?? currentFromChanges[slugKey] ?? (nameKey ? currentFromChanges[nameKey] : null);
    const titlesFromHistory =
      currentChampionsBySlug[canonicalKey] ?? currentChampionsBySlug[slugKey] ?? (nameKey ? currentChampionsBySlug[nameKey] : null) ?? [];
    const primaryTitle = (fromTable ?? fromChanges) ? (fromTable ?? fromChanges)!.title : (titlesFromHistory[0] ?? null);
    const titles = primaryTitle ? [primaryTitle] : titlesFromHistory;
    const raw = w as Record<string, unknown>;
    const unparsedCount = getUnparsedMatchesForWrestler(unparsedBySlug, slugKey, nameKey).length;
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
      nxtPointsPending,
      nxtRtsLeaguePoints: useMainOnlyForDisplay,
      rsPoints2025: points2025.rsPoints,
      plePoints2025: points2025.plePoints,
      beltPoints2025,
      totalPoints2025: totalPoints2025Row,
      rsPoints2026: points2026.rsPoints,
      plePoints2026: points2026.plePoints,
      beltPoints2026,
      totalPoints2026: totalPoints2026Row,
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
      personaDisplay: getPersonasForDisplay(w.id) ?? null,
      status: (raw.Status ?? raw.status) != null ? String(raw.Status ?? raw.status) : null,
      currentChampionship: titles.length > 0 ? titles.join(", ") : null,
      championBeltImageUrl: primaryTitle ? getBeltImageUrlForTitle(primaryTitle, w.gender) : null,
      unparsedCount,
    };
  });

  return (
    <main className="app-page" style={{ maxWidth: 1200, margin: "0 auto" }}>
      <nav
        aria-label="Wrestlers view"
        style={{
          display: "inline-flex",
          border: "1px solid var(--color-border)",
          borderRadius: 8,
          overflow: "hidden",
          marginBottom: 12,
        }}
      >
        <Link
          href={`/leagues/${slug}/wrestlers/league-leaders`}
          style={{
            padding: "8px 12px",
            textDecoration: "none",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "#fff",
            background: "#111",
          }}
        >
          League Leaders
        </Link>
        <Link
          href={`/leagues/${slug}/wrestlers/free-agents`}
          style={{
            padding: "8px 12px",
            textDecoration: "none",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "var(--color-text)",
            background: "var(--color-bg-surface)",
            borderLeft: "1px solid var(--color-border)",
          }}
        >
          Free Agents
        </Link>
      </nav>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 8 }}>League Leaders</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 16, fontSize: 13 }}>
        Wrestlers ranked by fantasy points to date. Sorted by highest total first; you can re-sort by any column.
      </p>
      {enforceNxtPendingOnlyForRts && (
        <p style={{ color: "#8a6d00", marginBottom: 16, fontSize: 13 }}>
          (<strong>*</strong>) next to points means NXT event and belt points are included and some or all will not factor into
          league points.
        </p>
      )}
      <WrestlerMatchStatsDisclaimer style={{ marginBottom: 24 }} />

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
          wrestlerProfileFrom="league-leaders"
          rosterByWrestler={rosterByWrestler}
          enableViewToggle
          rtsNxtPointsFootnote={enforceNxtPendingOnlyForRts}
        />
      )}
    </main>
  );
}
