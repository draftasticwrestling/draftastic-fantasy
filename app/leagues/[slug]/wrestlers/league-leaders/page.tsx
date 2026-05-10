import Link from "next/link";
import { redirect } from "next/navigation";
import { WrestlerMatchStatsDisclaimer } from "@/app/components/WrestlerMatchStatsDisclaimer";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import {
  getLeagueBySlug,
  getLeagueMembers,
  getRostersForLeague,
  getEffectiveLeagueStartDate,
  type LeagueMember,
  type LeagueRosterEntry,
} from "@/lib/leagues";
import WrestlerList, { type WrestlerRow } from "@/app/wrestlers/WrestlerList";
import { aggregateWrestlerPoints } from "@/lib/scoring/aggregateWrestlerPoints.js";
import {
  aggregateWrestlerMatchStats,
  getUnparsedMatchesByWrestler,
} from "@/lib/scoring/aggregateWrestlerMatchStats.js";
import {
  computeEndOfMonthBeltPoints,
  computeHybridBeltHoldBySlugForCalendarYear,
  computeWeeklyBeltHoldPointsAccumulated,
  firstLegacyCalendarMonthEndEligibleForLeagueStart,
  getCurrentChampionsBySlug,
  inferReignsFromEvents,
  mergeReigns,
} from "@/lib/scoring/endOfMonthBeltPoints.js";
import {
  mergeCurrentChampionTitleStrings,
  mergeGetCurrentChampionFromMap,
  mergeGetMatchStatsForWrestler,
  mergeGetMonthlyBeltForWrestler,
  mergeGetPointsForWrestler,
  mergeUnparsedMatchCount,
} from "@/lib/scoring/draftAliasListMerge";
import { factionDisplayName } from "@/lib/factionName";
import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";
import { classifyEventType, EVENT_TYPES } from "@/lib/scoring/parsers/eventClassifier.js";
import { getListPersonaFootnote, isHiddenCanonicalListSlug } from "@/lib/scoring/personaResolution.js";
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
import { brandByWrestlerSlugFromRows } from "@/lib/wrestlerBrandLookup";
import { EVENT_STATUSES_FOR_SCORING } from "@/lib/eventsScoring";
import {
  LEAGUE_LEADERS_ALL_TIME_EVENTS_LIMIT,
  allTimeLeadersStylePointBreakdown,
  loadLeagueLeadersAllTimeScoringBundle,
} from "@/lib/leagueLeadersAllTimeScoring";
import { recordEngagementEvent } from "@/lib/engagementEvents";
import {
  isWrestlerStatsCachePointColumnsSane,
  isWrestlerStatsCacheUsable,
  loadWrestlerStatsCacheMaps,
} from "@/lib/wrestlerStatsCache";

function read2kRating(row: Record<string, unknown>, key: string): number | null {
  const v = row[key];
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

/** Row shape for League Leaders wrestler select (explicit for TS when using defensive try/catch). */
type LeagueLeadersWrestlerRow = {
  id: string;
  name: string | null;
  gender: string | null;
  brand: string | null;
  image_url: string | null;
  dob: string | null;
  Status?: string | null;
  "2K26 rating"?: number | null;
  "2K25 rating"?: number | null;
};

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
/** Hosts that honor this (e.g. Vercel / some Netlify Next runtimes) get more time for heavy aggregates. */
export const maxDuration = 120;

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
  let supabase: Awaited<ReturnType<typeof getServerAuth>>["supabase"];
  let user: Awaited<ReturnType<typeof getServerAuth>>["user"];
  let league: Awaited<ReturnType<typeof getLeagueBySlug>>;

  try {
    const auth = await getServerAuth();
    supabase = auth.supabase;
    user = auth.user;
    league = await getLeagueBySlug(slug);
  } catch (err) {
    console.error("[league-leaders] failed to initialize", err);
    return (
      <main className="app-page" style={{ maxWidth: 900, margin: "0 auto" }}>
        <p style={{ marginBottom: 24 }}>
          <Link href={`/leagues/${slug}`} className="app-link">← League</Link>
        </p>
        <h1 style={{ fontSize: "1.25rem", marginBottom: 12 }}>League Leaders temporarily unavailable</h1>
        <p style={{ color: "var(--color-text-muted)", marginBottom: 14 }}>
          We hit a temporary loading error. Please retry in a few seconds.
        </p>
        <Link href={`/leagues/${slug}/wrestlers/league-leaders`} className="app-link" prefetch={false}>
          Retry League Leaders
        </Link>
      </main>
    );
  }
  if (!league) {
    redirect("/leagues");
  }
  if (user) {
    void recordEngagementEvent({
      eventName: "page.league_leaders_view",
      userId: user.id,
      leagueId: league.id,
      seasonSlug: league.season_slug ?? null,
      path: `/leagues/${slug}/wrestlers/league-leaders`,
    });
  }

  const enforceNxtPendingOnlyForRts = league.season_slug === ROAD_TO_SUMMERSLAM_SEASON_SLUG;
  let rows: WrestlerRow[] = [];
  let rosterByWrestler: Record<string, { ownerName: string; ownerUserId: string }> = {};
  let error: { message: string } | null = null;
  let computeFailed = false;

  try {
  const startDate = getEffectiveLeagueStartDate(league);

  const [wrestlersResult, rosters, members, { data: rawReigns }, currentFromTable, currentFromChanges] =
    await Promise.all([
      (async () => {
        try {
          // Column is "Status" (capital S) in DB; avoid .or("status...") and select "Status" only
          return await supabase
            .from("wrestlers")
            .select('id, name, gender, brand, image_url, dob, "Status", "2K26 rating", "2K25 rating"')
            .order("name", { ascending: true });
        } catch {
          return { data: null, error: { message: "Network error loading wrestlers" } as { message: string } };
        }
      })(),
      getRostersForLeague(league.id).catch((): Record<string, LeagueRosterEntry[]> => ({})),
      getLeagueMembers(league.id).catch((): LeagueMember[] => []),
      (async () => {
        try {
          return await supabase.from("championship_history").select("*");
        } catch {
          return { data: null };
        }
      })(),
      getCurrentChampionsFromChampionshipsTable(supabase).catch((): Record<string, CurrentChampionFromChanges> => ({})),
      getCurrentChampionsFromChanges(supabase).catch((): Record<string, CurrentChampionFromChanges> => ({})),
    ]);

  const wrestlers = (wrestlersResult.data ?? []) as LeagueLeadersWrestlerRow[];
  const brandBySlug = brandByWrestlerSlugFromRows(
    (wrestlers ?? []).map((w) => ({
      id: w.id,
      brand: (w as { brand?: string | null }).brand ?? null,
    }))
  );
  const wrestlersFiltered = (wrestlers ?? []).filter((w) => !isHiddenCanonicalListSlug(w.id));
  const statsCacheMaps = await loadWrestlerStatsCacheMaps(supabase);
  const cacheUsable = Boolean(
    statsCacheMaps &&
      isWrestlerStatsCacheUsable(
        statsCacheMaps,
        wrestlersFiltered.map((w) => String(w.id))
      )
  );
  const cachePointsSane = Boolean(statsCacheMaps && isWrestlerStatsCachePointColumnsSane(statsCacheMaps));
  /** Cache hits avoid heavy live aggregates; sanity rejects belt-only corrupt rows. */
  const trustLeadersCache = cacheUsable && cachePointsSane;
  if (cacheUsable && statsCacheMaps && !cachePointsSane) {
    console.warn(
      "[league-leaders] wrestler_stats_cache failed point-column sanity (high belt, no R/S+PLE); using live bundle"
    );
  }

  let liveLeadersBundle: Awaited<ReturnType<typeof loadLeagueLeadersAllTimeScoringBundle>> | null = null;
  if (!trustLeadersCache) {
    liveLeadersBundle = await loadLeagueLeadersAllTimeScoringBundle(supabase);
  }

  let sinceStartEventsData: { id: string; name: string; date: string; matches?: object[] }[] | null = null;
  try {
    const ev = await supabase
      .from("events")
      .select("id, name, date, matches")
      .in("status", [...EVENT_STATUSES_FOR_SCORING])
      .gte("date", startDate)
      .order("date", { ascending: true })
      .limit(Math.min(LEAGUE_LEADERS_ALL_TIME_EVENTS_LIMIT, 2000));
    sinceStartEventsData = (ev.data ?? []) as { id: string; name: string; date: string; matches?: object[] }[];
  } catch {
    sinceStartEventsData = [];
  }
  const eventsSinceStart = sinceStartEventsData ?? [];
  const eventsAll = eventsSinceStart;

  const membersList: LeagueMember[] = members ?? [];
  const rostersByUser: Record<string, LeagueRosterEntry[]> = rosters ?? {};
  const memberByUserId = Object.fromEntries(membersList.map((m) => [m.user_id, m]));
  rosterByWrestler = {};
  for (const [uid, entries] of Object.entries(rostersByUser)) {
    const ownerName = factionDisplayName(memberByUserId[uid], "Manager");
    for (const e of entries) {
      rosterByWrestler[e.wrestler_id] = { ownerName, ownerUserId: uid };
    }
  }

  const tableReigns = (rawReigns ?? []) as ChampionshipReign[];
  let reigns: ChampionshipReign[];
  try {
    const inferredReigns = inferReignsFromEvents(eventsAll);
    reigns = mergeReigns(tableReigns, inferredReigns) as ChampionshipReign[];
  } catch {
    reigns = tableReigns;
  }

  const pointsBySlug = aggregateWrestlerPoints(eventsSinceStart, brandBySlug);
  const isNxtEventType = (eventType: string) =>
    eventType === EVENT_TYPES.NXT || eventType.startsWith("nxt-");
  const mainRosterOnlyEventsSinceStart = eventsSinceStart.filter((e) => {
    const t = classifyEventType(e.name ?? "", e.id ?? "");
    return !isNxtEventType(t);
  });
  const pointsBySlugMainRosterOnly = aggregateWrestlerPoints(mainRosterOnlyEventsSinceStart, brandBySlug);
  const toPointsMap = (
    map: Map<string, { rs_points: number; ple_points: number; belt_points: number }>
  ): Record<string, { rsPoints: number; plePoints: number; beltPoints: number }> =>
    Object.fromEntries(
      [...map.entries()].map(([k, v]) => [
        k,
        { rsPoints: Number(v.rs_points ?? 0), plePoints: Number(v.ple_points ?? 0), beltPoints: Number(v.belt_points ?? 0) },
      ])
    );
  const toMatchStatsMap = (
    map: Map<string, { mw: number; win: number; loss: number; nc: number; dqw: number; dql: number }>
  ): Record<string, { mw: number; win: number; loss: number; nc: number; dqw: number; dql: number }> =>
    Object.fromEntries(
      [...map.entries()].map(([k, v]) => [
        k,
        { mw: Number(v.mw ?? 0), win: Number(v.win ?? 0), loss: Number(v.loss ?? 0), nc: Number(v.nc ?? 0), dqw: Number(v.dqw ?? 0), dql: Number(v.dql ?? 0) },
      ])
    );
  const pointsAllTimeFromCache =
    trustLeadersCache && statsCacheMaps ? toPointsMap(statsCacheMaps.all_time) : null;

  const points2025BySlug =
    trustLeadersCache && statsCacheMaps
      ? toPointsMap(statsCacheMaps["2025"])
      : liveLeadersBundle
        ? liveLeadersBundle.points2025BySlug
        : pointsBySlug;
  const points2026BySlug =
    trustLeadersCache && statsCacheMaps
      ? toPointsMap(statsCacheMaps["2026"])
      : liveLeadersBundle
        ? liveLeadersBundle.points2026BySlug
        : pointsBySlug;
  const pointsBySlugMainRosterOnly2025 = trustLeadersCache
    ? points2025BySlug
    : liveLeadersBundle
      ? liveLeadersBundle.points2025MainOnlyBySlug
      : pointsBySlugMainRosterOnly;
  const pointsBySlugMainRosterOnly2026 = trustLeadersCache
    ? points2026BySlug
    : liveLeadersBundle
      ? liveLeadersBundle.points2026MainOnlyBySlug
      : pointsBySlugMainRosterOnly;

  const matchStatsBySlug = aggregateWrestlerMatchStats(eventsSinceStart);
  const matchStatsMainOnlyBySlug = aggregateWrestlerMatchStats(mainRosterOnlyEventsSinceStart);
  const matchStats2025BySlug =
    trustLeadersCache && statsCacheMaps
      ? toMatchStatsMap(statsCacheMaps["2025"])
      : liveLeadersBundle
        ? liveLeadersBundle.matchStats2025BySlug
        : matchStatsBySlug;
  const matchStats2025MainOnlyBySlug = trustLeadersCache
    ? matchStats2025BySlug
    : liveLeadersBundle
      ? liveLeadersBundle.matchStats2025MainOnlyBySlug
      : matchStatsBySlug;
  const matchStats2026BySlug =
    trustLeadersCache && statsCacheMaps
      ? toMatchStatsMap(statsCacheMaps["2026"])
      : liveLeadersBundle
        ? liveLeadersBundle.matchStats2026BySlug
        : matchStatsBySlug;
  const matchStats2026MainOnlyBySlug = trustLeadersCache
    ? matchStats2026BySlug
    : liveLeadersBundle
      ? liveLeadersBundle.matchStats2026MainOnlyBySlug
      : matchStatsBySlug;
  const matchStatsAllTimeBySlug =
    trustLeadersCache && statsCacheMaps
      ? toMatchStatsMap(statsCacheMaps.all_time)
      : liveLeadersBundle!.matchStatsAllTimeBySlug;
  const matchStatsAllTimeMainOnlyBySlug = trustLeadersCache
    ? matchStatsAllTimeBySlug
    : liveLeadersBundle!.matchStatsAllTimeMainOnlyBySlug;
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
  const endOfMonthBeltPoints2025 = computeHybridBeltHoldBySlugForCalendarYear(reigns, 2025);
  const endOfMonthBeltPoints2026 = computeHybridBeltHoldBySlugForCalendarYear(reigns, 2026);
  const currentChampionsBySlug = getCurrentChampionsBySlug(reigns);

  error = wrestlersResult.error ? { message: wrestlersResult.error.message ?? "Unknown error" } : null;
  rows = wrestlersFiltered.map((w) => {
    const slugKey = w.id;
    const nameKey = w.name ? normalizeWrestlerName(w.name) : "";
    const idKey = normalizeWrestlerName(String(w.id));
    const canonicalKey = nameKey || (slugKey ? normalizeWrestlerName(String(slugKey)) : "") || slugKey;
    // Use slugKey (stable id/slug) first so points match when display name changed (e.g. Natalya → Nattie, slug still natalya)
    const pointsAll = mergeGetPointsForWrestler(pointsBySlug, slugKey, nameKey);
    const pointsMainOnly = mergeGetPointsForWrestler(pointsBySlugMainRosterOnly, slugKey, nameKey);
    const points = pointsAll;
    const isNxtRoster = wrestlerRosterFromBrand(w.brand ?? null) === "NXT";
    const useMainOnlyForDisplay = enforceNxtPendingOnlyForRts && isNxtRoster;
    const extraBelt = mergeGetMonthlyBeltForWrestler(endOfMonthBeltPoints, slugKey, nameKey);
    const beltPoints = points.beltPoints + extraBelt;
    const beltPointsAll = pointsAll.beltPoints + extraBelt;
    const totalPoints = points.rsPoints + points.plePoints + beltPoints;
    const totalPointsAll = pointsAll.rsPoints + pointsAll.plePoints + beltPointsAll;
    const nxtPointsPending = Math.max(0, totalPointsAll - (pointsMainOnly.rsPoints + pointsMainOnly.plePoints + (pointsMainOnly.beltPoints + extraBelt)));
    const matchStats = mergeGetMatchStatsForWrestler(matchStatsBySlug, slugKey, nameKey);

    const points2025 = mergeGetPointsForWrestler(points2025BySlug, slugKey, nameKey);
    const points2025MainOnly = mergeGetPointsForWrestler(pointsBySlugMainRosterOnly2025, slugKey, nameKey);
    const points2026 = mergeGetPointsForWrestler(points2026BySlug, slugKey, nameKey);
    const points2026MainOnly = mergeGetPointsForWrestler(pointsBySlugMainRosterOnly2026, slugKey, nameKey);
    const matchStats2025 = mergeGetMatchStatsForWrestler(matchStats2025BySlug, slugKey, nameKey);
    const matchStats2025MainOnly = mergeGetMatchStatsForWrestler(matchStats2025MainOnlyBySlug, slugKey, nameKey);
    const matchStats2026 = mergeGetMatchStatsForWrestler(matchStats2026BySlug, slugKey, nameKey);
    const matchStats2026MainOnly = mergeGetMatchStatsForWrestler(matchStats2026MainOnlyBySlug, slugKey, nameKey);
    const matchStatsAllTime = mergeGetMatchStatsForWrestler(matchStatsAllTimeBySlug, slugKey, nameKey);
    const matchStatsMainOnly = mergeGetMatchStatsForWrestler(matchStatsMainOnlyBySlug, slugKey, nameKey);
    const matchStatsAllTimeMainOnly = mergeGetMatchStatsForWrestler(matchStatsAllTimeMainOnlyBySlug, slugKey, nameKey);
    const allTimeParts =
      trustLeadersCache && pointsAllTimeFromCache
        ? (() => {
            const p = mergeGetPointsForWrestler(pointsAllTimeFromCache, slugKey, nameKey);
            return {
              rs: p.rsPoints,
              ple: p.plePoints,
              beltCombined: p.beltPoints,
              total: p.rsPoints + p.plePoints + p.beltPoints,
            };
          })()
        : allTimeLeadersStylePointBreakdown(
            liveLeadersBundle!.pointsAllTimeBySlug,
            liveLeadersBundle!.endOfMonthBeltPointsAllTime,
            slugKey,
            nameKey
          );
    const allTimeMainOnlyParts = trustLeadersCache
      ? allTimeParts
      : allTimeLeadersStylePointBreakdown(
          liveLeadersBundle!.pointsAllTimeMainOnlyBySlug,
          liveLeadersBundle!.endOfMonthBeltPointsAllTime,
          slugKey,
          nameKey
        );
    const beltPointsAllTime = allTimeParts.beltCombined;
    const totalPointsAllTime = allTimeParts.total;
    const extraBelt2025 = mergeGetMonthlyBeltForWrestler(endOfMonthBeltPoints2025, slugKey, nameKey);
    const extraBelt2026 = mergeGetMonthlyBeltForWrestler(endOfMonthBeltPoints2026, slugKey, nameKey);
    const beltPoints2025 = trustLeadersCache ? points2025.beltPoints : points2025.beltPoints + extraBelt2025;
    const beltPoints2026 = trustLeadersCache ? points2026.beltPoints : points2026.beltPoints + extraBelt2026;
    const totalPoints2025Row = points2025.rsPoints + points2025.plePoints + beltPoints2025;
    const totalPoints2025MainOnly =
      points2025MainOnly.rsPoints +
      points2025MainOnly.plePoints +
      (trustLeadersCache ? points2025MainOnly.beltPoints : points2025MainOnly.beltPoints + extraBelt2025);
    const totalPoints2026Row = points2026.rsPoints + points2026.plePoints + beltPoints2026;
    const totalPoints2026MainOnly =
      points2026MainOnly.rsPoints +
      points2026MainOnly.plePoints +
      (trustLeadersCache ? points2026MainOnly.beltPoints : points2026MainOnly.beltPoints + extraBelt2026);
    const fromTable =
      currentFromTable[idKey] ?? mergeGetCurrentChampionFromMap(currentFromTable, slugKey, nameKey) ?? null;
    const fromChanges =
      currentFromChanges[idKey] ?? mergeGetCurrentChampionFromMap(currentFromChanges, slugKey, nameKey) ?? null;
    const directChampTitles =
      currentChampionsBySlug[canonicalKey] ?? currentChampionsBySlug[idKey] ?? null;
    const aliasChampTitles = mergeCurrentChampionTitleStrings(
      currentChampionsBySlug,
      slugKey,
      nameKey
    );
    const titlesFromHistory: string[] = (() => {
      const seen = new Set<string>();
      const out: string[] = [];
      for (const list of [directChampTitles, aliasChampTitles]) {
        if (!list) continue;
        for (const t of list) {
          if (t && !seen.has(t)) {
            seen.add(t);
            out.push(t);
          }
        }
      }
      return out;
    })();
    const primaryTitle = (fromTable ?? fromChanges) ? (fromTable ?? fromChanges)!.title : (titlesFromHistory[0] ?? null);
    const titles = primaryTitle ? [primaryTitle] : titlesFromHistory;
    const raw = w as Record<string, unknown>;
    const unparsedCount = mergeUnparsedMatchCount(unparsedBySlug, slugKey, nameKey);
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
      rsPointsAllTime: allTimeParts.rs,
      plePointsAllTime: allTimeParts.ple,
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
      hasNxtPointsSinceStart: Math.abs(totalPoints - (pointsMainOnly.rsPoints + pointsMainOnly.plePoints + (pointsMainOnly.beltPoints + extraBelt))) > 0.0001,
      hasNxtPoints2025: Math.abs(totalPoints2025Row - totalPoints2025MainOnly) > 0.0001,
      hasNxtPoints2026: Math.abs(totalPoints2026Row - totalPoints2026MainOnly) > 0.0001,
      hasNxtPointsAllTime: Math.abs(allTimeParts.total - allTimeMainOnlyParts.total) > 0.0001,
      hasNxtStatsSinceStart:
        matchStats.mw !== matchStatsMainOnly.mw ||
        matchStats.win !== matchStatsMainOnly.win ||
        matchStats.loss !== matchStatsMainOnly.loss ||
        matchStats.nc !== matchStatsMainOnly.nc ||
        matchStats.dqw !== matchStatsMainOnly.dqw ||
        matchStats.dql !== matchStatsMainOnly.dql,
      hasNxtStats2025:
        matchStats2025.mw !== matchStats2025MainOnly.mw ||
        matchStats2025.win !== matchStats2025MainOnly.win ||
        matchStats2025.loss !== matchStats2025MainOnly.loss ||
        matchStats2025.nc !== matchStats2025MainOnly.nc ||
        matchStats2025.dqw !== matchStats2025MainOnly.dqw ||
        matchStats2025.dql !== matchStats2025MainOnly.dql,
      hasNxtStats2026:
        matchStats2026.mw !== matchStats2026MainOnly.mw ||
        matchStats2026.win !== matchStats2026MainOnly.win ||
        matchStats2026.loss !== matchStats2026MainOnly.loss ||
        matchStats2026.nc !== matchStats2026MainOnly.nc ||
        matchStats2026.dqw !== matchStats2026MainOnly.dqw ||
        matchStats2026.dql !== matchStats2026MainOnly.dql,
      hasNxtStatsAllTime:
        matchStatsAllTime.mw !== matchStatsAllTimeMainOnly.mw ||
        matchStatsAllTime.win !== matchStatsAllTimeMainOnly.win ||
        matchStatsAllTime.loss !== matchStatsAllTimeMainOnly.loss ||
        matchStatsAllTime.nc !== matchStatsAllTimeMainOnly.nc ||
        matchStatsAllTime.dqw !== matchStatsAllTimeMainOnly.dqw ||
        matchStatsAllTime.dql !== matchStatsAllTimeMainOnly.dql,
      personaDisplay: getListPersonaFootnote(w.id) ?? null,
      status: (raw.Status ?? raw.status) != null ? String(raw.Status ?? raw.status) : null,
      currentChampionship: titles.length > 0 ? titles.join(", ") : null,
      championBeltImageUrl: primaryTitle ? getBeltImageUrlForTitle(primaryTitle, w.gender) : null,
      unparsedCount,
    };
  });
  } catch (err) {
    console.error("[league-leaders] aggregation failed", err);
    computeFailed = true;
    rows = [];
    rosterByWrestler = {};
    error = null;
  }

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
      {rows.some((r) => r.hasNxtPointsSinceStart || r.hasNxtPoints2025 || r.hasNxtPoints2026 || r.hasNxtPointsAllTime) && (
        <p style={{ color: "#8a6d00", marginBottom: 16, fontSize: 13 }}>
          (<strong>*</strong>) indicates the selected period includes NXT-earned points for that wrestler.
        </p>
      )}
      <WrestlerMatchStatsDisclaimer style={{ marginBottom: 24 }} />

      {computeFailed && (
        <p style={{ color: "var(--color-red)", marginBottom: 16, fontSize: 14 }}>
          Statistics didn&apos;t finish loading in time (server timeout or a temporary error).{" "}
          <Link href={`/leagues/${slug}/wrestlers/league-leaders`} prefetch={false} className="app-link">
            Try this page again
          </Link>{" "}
          or open League Leaders from the Statistics menu once more.
        </p>
      )}

      {error && (
        <p style={{ color: "var(--color-red)", marginBottom: 16 }}>
          Error loading wrestlers: {error.message}
        </p>
      )}

      {rows.length === 0 && !error && !computeFailed && (
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
          includeNxtInDefaultRosterFilter={Boolean(league.include_nxt)}
        />
      )}
    </main>
  );
}
