import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import {
  getLeagueBySlug,
  getLeagueMembers,
  getRostersForLeague,
  getEffectiveLeagueStartDate,
} from "@/lib/leagues";
import { getPointsByOwnerForLeagueWithBonuses } from "@/lib/leagueMatchups";
import { getTradeProposalsForLeague, getWrestlerIdsLockedByPendingTrades } from "@/lib/leagueOwner";
import { formatRecipientRosterCutsLine } from "@/lib/tradeDisplay";
import { getRosterRulesForLeague, leagueUsesWeeklyPstBeltHold } from "@/lib/leagueStructure";
import { ProposeTradeForm } from "../ProposeTradeForm";
import { ProposeReleaseForm } from "../ProposeReleaseForm";
import { ProposeFreeAgentForm } from "../ProposeFreeAgentForm";
import { TradeProposalRespond } from "../TradeProposalRespond";
import { CancelTradeButton } from "../CancelTradeButton";
import { RosterCardGrid } from "../RosterCardGrid";
import type { WrestlerRow } from "@/app/wrestlers/WrestlerList";
import { aggregateWrestlerPoints, getPointsForWrestler } from "@/lib/scoring/aggregateWrestlerPoints.js";
import { aggregateWrestlerMatchStats, getMatchStatsForWrestler } from "@/lib/scoring/aggregateWrestlerMatchStats.js";
import {
  computeEndOfMonthBeltPoints,
  computeWeeklyBeltHoldPointsAccumulated,
  firstLegacyCalendarMonthEndEligibleForLeagueStart,
  getCurrentChampionsBySlug,
  getMonthlyBeltForWrestler,
  inferReignsFromEvents,
  mergeReigns,
} from "@/lib/scoring/endOfMonthBeltPoints.js";
import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";
import { getPersonasForDisplay } from "@/lib/scoring/personaResolution.js";
import { getBeltImageUrlForTitle } from "@/lib/championshipBeltOverlay";
import type { CurrentChampionFromChanges } from "@/lib/championshipCurrentFromChanges";
import {
  CHAMPIONSHIP_CHANGES_TABLE_NAME,
  getCurrentChampionsFromChanges,
  inferReignsFromChampionshipChanges,
} from "@/lib/championshipCurrentFromChanges";
import { getCurrentChampionsFromChampionshipsTable } from "@/lib/championshipCurrentFromTable";
import { getTeamScoringAudit } from "@/lib/teamScoring";
import { factionDisplayName } from "@/lib/factionName";
import { getTodayTomorrowYmdET } from "@/lib/home/hubHomeEvents";
import type { LeagueEventDayRow } from "@/lib/league/eventDayRosterMatches";
import { buildFactionUpcomingRosterCards, enrichFactionCardsWithLiveScores } from "@/lib/league/factionUpcomingMatchCards";
import { ManagerAvatar } from "@/app/components/ManagerAvatar";
import { resolvedManagerAvatarUrl } from "@/lib/managerAvatarBucket";
import { FactionSimpleRoster } from "../FactionSimpleRoster";
import {
  adjustRts2026LeagueAggregateBeltPoints,
  beltScoringLastMonthEndInclusive,
} from "@/lib/beltRts2026JulyDeferral";
import {
  beltScoringLastWeekEndSundayInclusive,
  firstEligibleWeekEndSundayForLeagueStart,
} from "@/lib/beltWeeklyHold";
import { EVENT_STATUSES_FOR_SCORING } from "@/lib/eventsScoring";

const ALL_TIME_EVENTS_FROM = "2020-01-01";
const ALL_TIME_EVENTS_LIMIT = 10000;

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

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string; userId: string }>;
  searchParams?: Promise<{ proposeTradeTo?: string; addFa?: string; view?: string; layout?: string }>;
};

export async function generateMetadata({ params }: Props) {
  try {
    const { slug, userId } = await params;
    const league = await getLeagueBySlug(slug);
    if (!league) return { title: "Faction — Draftastic Fantasy" };
    const members = await getLeagueMembers(league.id);
    const m = members.find((x) => x.user_id === userId);
    const name = factionDisplayName(m, "Faction");
    return {
      title: `${name} — ${league.name} — Draftastic Fantasy`,
      description: `Roster and points for ${name}`,
    };
  } catch {
    return { title: "Faction — Draftastic Fantasy" };
  }
}

export default async function TeamUserIdPage({ params, searchParams }: Props) {
  const { slug, userId } = await params;
  const sp = searchParams ? await searchParams : {};
  const proposeTradeTo = typeof sp.proposeTradeTo === "string" ? sp.proposeTradeTo.trim() : undefined;
  const addFa = typeof sp.addFa === "string" ? sp.addFa.trim() : undefined;
  const view = typeof sp.view === "string" ? sp.view.trim().toLowerCase() : "";
  const layoutParam = typeof sp.layout === "string" ? sp.layout.trim().toLowerCase() : "";
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const { supabase, user: currentUser } = await getServerAuth();
  if (!currentUser) notFound();

  const [members, rosters, pointsWithBonuses, teamScoringAudit] = await Promise.all([
    getLeagueMembers(league.id),
    getRostersForLeague(league.id),
    getPointsByOwnerForLeagueWithBonuses(league.id),
    getTeamScoringAudit(league.id, userId),
  ]);
  const isMember = members.some((m) => m.user_id === currentUser.id);
  if (!isMember) notFound();

  const targetMember = members.find((m) => m.user_id === userId);
  if (!targetMember) notFound();

  const isOwnTeam = currentUser.id === userId;
  const simpleFactionView = view === "simple";
  const teamLabel = factionDisplayName(targetMember, "Unknown");

  const factionNavUserIds = members.map((m) => m.user_id);
  const factionNavIndex = factionNavUserIds.indexOf(userId);
  const canNavigateFactions = factionNavUserIds.length > 1 && factionNavIndex >= 0;
  const prevFactionUserId = canNavigateFactions
    ? factionNavUserIds[(factionNavIndex - 1 + factionNavUserIds.length) % factionNavUserIds.length]
    : null;
  const nextFactionUserId = canNavigateFactions
    ? factionNavUserIds[(factionNavIndex + 1) % factionNavUserIds.length]
    : null;
  function labelForFactionNav(uid: string): string {
    const m = members.find((x) => x.user_id === uid);
    return factionDisplayName(m, "Faction");
  }
  const rosterEntries = rosters[userId] ?? [];
  const totalPoints = pointsWithBonuses[userId] ?? 0;

  const wrestlers =
    (
      await supabase
        .from("wrestlers")
        .select('id, name, gender, brand, image_url, dob, "Status", "2K26 rating", "2K25 rating"')
        .order("name", { ascending: true })
    ).data ?? [];
  const wrestlerNamesMap = Object.fromEntries(wrestlers.map((w) => [w.id, w.name ?? w.id]));
  const wrestlerImageUrl: Record<string, string | null> = Object.fromEntries(
    wrestlers.map((w) => [w.id, w.image_url ?? null])
  );
  const rosterAcquiredAtById: Record<string, string | null> = Object.fromEntries(
    teamScoringAudit.activeStints.map((s) => [s.wrestler_id, s.acquired_at ?? null])
  );

  const rosterRules = getRosterRulesForLeague(members.length, league.season_slug ?? null);
  const rosterWrestlers = rosterEntries.map((e) => {
    const w = wrestlers.find((x) => x.id === e.wrestler_id) as { id: string; name: string | null; gender?: string | null } | undefined;
    return { id: e.wrestler_id, name: w?.name ?? e.wrestler_id, gender: w?.gender ?? null };
  });

  const rosterIds = rosterEntries.map((e) => e.wrestler_id);
  let rosterTableRows: WrestlerRow[] = [];
  if (rosterIds.length > 0) {
    const supabaseTable = supabase;
    const startDate = getEffectiveLeagueStartDate(league);
    const [
      { data: eventsSinceStart },
      { data: eventsAll },
      { data: rawReigns },
      { data: rawChangeRows, error: changeRowsError },
      currentFromTable,
      currentFromChanges,
    ] = await Promise.all([
      supabaseTable.from("events").select("id, name, date, matches").in("status", [...EVENT_STATUSES_FOR_SCORING]).gte("date", startDate).order("date", { ascending: true }),
      supabaseTable.from("events").select("id, name, date, matches").in("status", [...EVENT_STATUSES_FOR_SCORING]).gte("date", ALL_TIME_EVENTS_FROM).order("date", { ascending: true }).limit(ALL_TIME_EVENTS_LIMIT),
      supabaseTable.from("championship_history").select("champion_slug, champion, champion_name, title, title_name, won_date, start_date, lost_date, end_date").order("won_date", { ascending: true }),
      supabaseTable
        .from(CHAMPIONSHIP_CHANGES_TABLE_NAME)
        .select("championship_type, champion, champion_slug, date")
        .order("date", { ascending: true }),
      getCurrentChampionsFromChampionshipsTable(supabaseTable).catch((): Record<string, CurrentChampionFromChanges> => ({})),
      getCurrentChampionsFromChanges(supabaseTable).catch((): Record<string, CurrentChampionFromChanges> => ({})),
    ]);
    const fullWrestlers = wrestlers.filter((w) => rosterIds.includes(w.id));
    const tableReigns = (rawReigns ?? []) as ChampionshipReign[];
    const changesReigns = inferReignsFromChampionshipChanges(
      changeRowsError ? [] : (rawChangeRows ?? [])
    );
    const inferredReigns = inferReignsFromEvents(eventsAll ?? []);
    const reigns = mergeReigns(tableReigns, [...inferredReigns, ...changesReigns]) as ChampionshipReign[];
    const pointsBySlugSinceStart = aggregateWrestlerPoints(eventsSinceStart ?? []);
    const pointsBySlugAllTime = aggregateWrestlerPoints(eventsAll ?? []);
    const matchStatsBySlugSinceStart = aggregateWrestlerMatchStats(eventsSinceStart ?? []);
    const matchStatsBySlugAllTime = aggregateWrestlerMatchStats(eventsAll ?? []);
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
    const currentChampionsBySlug = getCurrentChampionsBySlug(reigns);
    rosterTableRows = fullWrestlers.map((w: { id: string; name: string | null; gender: string | null; brand: string | null; image_url?: string | null; dob?: string | null; Status?: string | null; "2K26 rating"?: number | null; "2K25 rating"?: number | null }) => {
      const slugKey = w.id;
      const nameKey = w.name ? normalizeWrestlerName(w.name) : "";
      const idKey = normalizeWrestlerName(String(w.id));
      const canonicalKey = nameKey || (slugKey ? normalizeWrestlerName(String(slugKey)) : "") || slugKey;
      const points = getPointsForWrestler(pointsBySlugSinceStart, slugKey, nameKey);
      const pointsAllTime = getPointsForWrestler(pointsBySlugAllTime, slugKey, nameKey);
      const matchStats = getMatchStatsForWrestler(matchStatsBySlugSinceStart, slugKey, nameKey);
      const matchStatsAllTime = getMatchStatsForWrestler(matchStatsBySlugAllTime, slugKey, nameKey);
      const extraBelt = getMonthlyBeltForWrestler(endOfMonthBeltPoints, slugKey, w.name ?? undefined);
      const beltPoints = points.beltPoints + extraBelt;
      const totalPoints = points.rsPoints + points.plePoints + beltPoints;
      const beltPointsAllTime = pointsAllTime.beltPoints + extraBelt;
      const totalPointsAllTime = pointsAllTime.rsPoints + pointsAllTime.plePoints + beltPointsAllTime;
      const fromTable =
        currentFromTable[idKey] ?? currentFromTable[slugKey] ?? (nameKey ? currentFromTable[nameKey] : null);
      const fromChanges =
        currentFromChanges[idKey] ?? currentFromChanges[slugKey] ?? (nameKey ? currentFromChanges[nameKey] : null);
      const titlesFromHistory = currentChampionsBySlug[canonicalKey] ?? currentChampionsBySlug[slugKey] ?? (nameKey ? currentChampionsBySlug[nameKey] : null) ?? [];
      const primaryTitle = (fromTable ?? fromChanges) ? (fromTable ?? fromChanges)!.title : (titlesFromHistory[0] ?? null);
      const titles = primaryTitle ? [primaryTitle] : titlesFromHistory;
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
        rsPoints2025: 0,
        plePoints2025: 0,
        beltPoints2025: 0,
        totalPoints2025: 0,
        rsPoints2026: 0,
        plePoints2026: 0,
        beltPoints2026: 0,
        totalPoints2026: 0,
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
        mw2025: 0,
        win2025: 0,
        loss2025: 0,
        nc2025: 0,
        dqw2025: 0,
        dql2025: 0,
        mw2026: 0,
        win2026: 0,
        loss2026: 0,
        nc2026: 0,
        dqw2026: 0,
        dql2026: 0,
        mwAllTime: matchStatsAllTime.mw,
        winAllTime: matchStatsAllTime.win,
        lossAllTime: matchStatsAllTime.loss,
        ncAllTime: matchStatsAllTime.nc,
        dqwAllTime: matchStatsAllTime.dqw,
        dqlAllTime: matchStatsAllTime.dql,
        personaDisplay: getPersonasForDisplay(w.id) ?? null,
        status: (raw.Status ?? raw.status) != null ? String(raw.Status ?? raw.status) : null,
        currentChampionship: titles.length > 0 ? titles.join(", ") : null,
        championBeltImageUrl: titles.length > 0 ? getBeltImageUrlForTitle(titles[0], w.gender) : null,
      };
    });
  }

  let tradeLockedWrestlerIds: string[] = [];
  if (isOwnTeam) {
    try {
      tradeLockedWrestlerIds = await getWrestlerIdsLockedByPendingTrades(league.id, currentUser.id);
    } catch {
      tradeLockedWrestlerIds = [];
    }
  }

  if (simpleFactionView) {
    const initialLayout = layoutParam === "list" || layoutParam === "cards" || layoutParam === "matches" ? layoutParam : null;
    const rosterCardWrestlers = rosterTableRows.map((w) => {
      const a = teamScoringAudit.totalsByWrestler[w.id];
      const rsPoints = a?.rsPoints ?? w.rsPoints ?? 0;
      const plePoints = a?.plePoints ?? w.plePoints ?? 0;
      const beltPoints = Math.max(a?.beltPoints ?? 0, w.beltPoints ?? 0);
      const totalPoints = rsPoints + plePoints + beltPoints;
      return {
        id: w.id,
        name: w.name,
        brand: w.brand,
        acquiredAt: rosterAcquiredAtById[w.id] ?? null,
        rsPoints,
        plePoints,
        beltPoints,
        totalPoints,
        mw: w.mw ?? 0,
        rating_2k26: w.rating_2k26,
        rating_2k25: w.rating_2k25,
        championBeltImageUrl: w.championBeltImageUrl,
        image_url: w.image_url,
      };
    });
    const wrestlerNameByIdForSimple = Object.fromEntries(
      wrestlers.map((w) => [w.id, (w.name ?? w.id).trim()])
    );
    const wrestlerImageByIdForSimple = Object.fromEntries(wrestlers.map((w) => [w.id, w.image_url ?? null]));
    const targetRosterWrestlerIdsForSimple = rosterEntries.map((e) => e.wrestler_id);
    const todayYmdEtSimple = getTodayTomorrowYmdET().today;
    const { data: upcomingEventsRowsSimple } = await supabase
      .from("events")
      .select("id, name, date, location, matches, status")
      .gte("date", todayYmdEtSimple)
      .order("date", { ascending: true })
      .order("name", { ascending: true })
      .limit(36);

    const upcomingCandidatesSimple = ((upcomingEventsRowsSimple ?? []) as LeagueEventDayRow[]).filter((e) => {
      const s = String(e.status ?? "").toLowerCase().trim();
      const d = String(e.date ?? "").trim().slice(0, 10);
      if (d === todayYmdEtSimple && s === "completed") return true;
      return s !== "completed";
    });
    const eventByIdForSimple = new Map<string, LeagueEventDayRow>();
    for (const ev of upcomingCandidatesSimple) eventByIdForSimple.set(ev.id, ev);
    let upcomingFactionCardsSimple = upcomingCandidatesSimple.flatMap((ev) =>
      buildFactionUpcomingRosterCards(
        ev,
        targetRosterWrestlerIdsForSimple,
        wrestlerNameByIdForSimple,
        wrestlerImageByIdForSimple
      )
    );
    if (upcomingFactionCardsSimple.length > 24) {
      upcomingFactionCardsSimple = upcomingFactionCardsSimple.slice(0, 24);
    }
    upcomingFactionCardsSimple = enrichFactionCardsWithLiveScores(eventByIdForSimple, upcomingFactionCardsSimple);

    return (
      <main
        style={{
          fontFamily: "system-ui, sans-serif",
          padding: 24,
          maxWidth: 1200,
          margin: "0 auto",
          fontSize: 16,
          lineHeight: 1.5,
        }}
      >
        <FactionSimpleRoster
          leagueSlug={slug}
          leagueName={league.name}
          teamUserId={userId}
          viewerUserId={currentUser.id}
          isOwnFaction={isOwnTeam}
          factionOptions={members.map((m) => ({
            userId: m.user_id,
            label: factionDisplayName(m, "Faction"),
          }))}
          teamLabel={teamLabel}
          totalPoints={totalPoints}
          rosterSize={rosterEntries.length}
          rosterCap={rosterRules?.rosterSize ?? 0}
          minFemale={rosterRules?.minFemale ?? 0}
          minMale={rosterRules?.minMale ?? 0}
          wrestlers={rosterCardWrestlers}
          tradeLockedWrestlerIds={tradeLockedWrestlerIds}
          upcomingMatches={upcomingFactionCardsSimple.map((c) => ({
            key: c.key,
            eventName: c.eventName,
            eventDateLabel: c.eventDateLabel,
            eventHref: c.eventHref,
            wrestlerName: c.wrestlerName,
            matchLabel: c.matchLabel,
            isChampionship: c.isChampionship,
            isSpecialStipulation: c.isSpecialStipulation,
            matchPoints: c.matchPoints,
          }))}
          initialLayout={initialLayout}
        />
      </main>
    );
  }

  const rosterByWrestlerForTable: Record<string, { ownerName: string; ownerUserId: string }> = {};
  if (rosterTableRows.length > 0) {
    for (const w of rosterTableRows) {
      rosterByWrestlerForTable[w.id] = {
        ownerName: factionDisplayName(targetMember, "My faction"),
        ownerUserId: userId,
      };
    }
  }

  const draftedIds = new Set<string>();
  for (const entries of Object.values(rosters)) for (const e of entries) draftedIds.add(e.wrestler_id);
  const freeAgents = wrestlers.filter((w) => !draftedIds.has(w.id));
  const otherMembers = members.filter((m) => m.user_id !== currentUser.id);
  const memberByUserId = Object.fromEntries(members.map((m) => [m.user_id, m]));

  let tradeProposals: Awaited<ReturnType<typeof getTradeProposalsForLeague>> = [];
  try {
    tradeProposals = await getTradeProposalsForLeague(league.id);
  } catch {
    // Tables may not exist
  }
  const tradesForMe = tradeProposals.filter(
    (p) => p.status === "pending" && p.to_user_id === currentUser.id
  );

  const wrestlerNameByIdForRecent = Object.fromEntries(
    wrestlers.map((w) => [w.id, (w.name ?? w.id).trim()])
  );
  const wrestlerImageById = Object.fromEntries(wrestlers.map((w) => [w.id, w.image_url ?? null]));
  const targetRosterWrestlerIds = rosterEntries.map((e) => e.wrestler_id);
  const todayYmdEt = getTodayTomorrowYmdET().today;

  const { data: upcomingEventsRows } = await supabase
    .from("events")
    .select("id, name, date, location, matches, status")
    .gte("date", todayYmdEt)
    .order("date", { ascending: true })
    .order("name", { ascending: true })
    .limit(48);

  // Keep non-completed (upcoming / live) plus **today’s completed** shows so boxes + scores stay for the full ET
  // calendar day after the event finishes; they drop off once the date rolls to tomorrow.
  const upcomingCandidates = ((upcomingEventsRows ?? []) as LeagueEventDayRow[]).filter((e) => {
    const s = String(e.status ?? "").toLowerCase().trim();
    const d = String(e.date ?? "").trim().slice(0, 10);
    if (d === todayYmdEt && s === "completed") return true;
    return s !== "completed";
  });

  const eventByIdForFactionCards = new Map<string, LeagueEventDayRow>();
  for (const ev of upcomingCandidates) eventByIdForFactionCards.set(ev.id, ev);

  const MAX_UPCOMING_CARDS = 48;
  let upcomingFactionCards = upcomingCandidates.flatMap((ev) =>
    buildFactionUpcomingRosterCards(ev, targetRosterWrestlerIds, wrestlerNameByIdForRecent, wrestlerImageById)
  );
  if (upcomingFactionCards.length > MAX_UPCOMING_CARDS) {
    upcomingFactionCards = upcomingFactionCards.slice(0, MAX_UPCOMING_CARDS);
  }

  let upcomingMatchesSource: "upcoming" | "completed" = "upcoming";
  if (upcomingFactionCards.length === 0) {
    upcomingMatchesSource = "completed";
    const { data: completedRows } = await supabase
      .from("events")
      .select("id, name, date, location, matches, status")
      .eq("status", "completed")
      .order("date", { ascending: false })
      .order("name", { ascending: true })
      .limit(24);
    for (const ev of (completedRows ?? []) as LeagueEventDayRow[]) {
      eventByIdForFactionCards.set(ev.id, ev);
      const chunk = buildFactionUpcomingRosterCards(
        ev,
        targetRosterWrestlerIds,
        wrestlerNameByIdForRecent,
        wrestlerImageById
      );
      upcomingFactionCards.push(...chunk);
      if (upcomingFactionCards.length >= MAX_UPCOMING_CARDS) break;
    }
  }

  upcomingFactionCards.sort((a, b) => {
    const da = (a.eventDateYmd || "").localeCompare(b.eventDateYmd || "");
    if (da !== 0) return da;
    return a.wrestlerName.localeCompare(b.wrestlerName);
  });

  upcomingFactionCards = enrichFactionCardsWithLiveScores(eventByIdForFactionCards, upcomingFactionCards);

  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: 24,
        maxWidth: 1200,
        margin: "0 auto",
        fontSize: 16,
        lineHeight: 1.5,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          marginBottom: 6,
          flexWrap: "wrap",
        }}
      >
        {prevFactionUserId != null && (
          <Link
            href={`/leagues/${slug}/team/${encodeURIComponent(prevFactionUserId)}`}
            aria-label={`Previous faction: ${labelForFactionNav(prevFactionUserId)}`}
            title={`Previous: ${labelForFactionNav(prevFactionUserId)}`}
            style={{
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              borderRadius: 10,
              color: "#1a73e8",
              textDecoration: "none",
              fontSize: "1.75rem",
              fontWeight: 700,
              lineHeight: 1,
              border: "1px solid rgba(26, 115, 232, 0.35)",
              background: "rgba(26, 115, 232, 0.06)",
            }}
          >
            ‹
          </Link>
        )}
        <div style={{ flex: "1 1 auto" }} />
        {nextFactionUserId != null && (
          <Link
            href={`/leagues/${slug}/team/${encodeURIComponent(nextFactionUserId)}`}
            aria-label={`Next faction: ${labelForFactionNav(nextFactionUserId)}`}
            title={`Next: ${labelForFactionNav(nextFactionUserId)}`}
            style={{
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              borderRadius: 10,
              color: "#1a73e8",
              textDecoration: "none",
              fontSize: "1.75rem",
              fontWeight: 700,
              lineHeight: 1,
              border: "1px solid rgba(26, 115, 232, 0.35)",
              background: "rgba(26, 115, 232, 0.06)",
            }}
          >
            ›
          </Link>
        )}
      </div>
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(280px, 420px) minmax(0, 1fr)",
          gap: 20,
          alignItems: "start",
          marginBottom: 28,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 14,
            alignItems: "center",
            padding: "10px 6px",
          }}
        >
          <ManagerAvatar
            avatarUrl={resolvedManagerAvatarUrl(targetMember)}
            fallbackLetter={(teamLabel.trim().charAt(0) || "?").toUpperCase()}
            size={132}
            radius="14px"
            alt={`${teamLabel} avatar`}
            variant="sidebar"
          />
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: "0 0 6px", fontSize: "2rem", fontWeight: 700 }}>{teamLabel}</h1>
            {targetMember.manager_catchphrase?.trim() ? (
              <p
                style={{
                  margin: "0 0 8px",
                  fontSize: 17,
                  fontStyle: "italic",
                  color: "#6b4f1d",
                  fontWeight: 600,
                }}
              >
                "{targetMember.manager_catchphrase.trim()}"
              </p>
            ) : null}
            <p style={{ margin: "0 0 10px" }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "6px 16px",
                  borderRadius: 999,
                  background: "linear-gradient(135deg, #c00 0%, #7a0000 100%)",
                  color: "#fff",
                  fontWeight: 800,
                  letterSpacing: 0.5,
                  fontSize: 20,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
                }}
              >
                {totalPoints} pts
              </span>
            </p>
            <p style={{ margin: 0 }}>
              <Link
                href={`/leagues/${slug}/team/${encodeURIComponent(userId)}/scoreboard`}
                style={{ color: "#1a73e8", textDecoration: "none", fontWeight: 700 }}
              >
                View Faction Scoreboard
              </Link>
            </p>
          </div>
        </div>
        <div>
          <h2 style={{ fontSize: "1.3rem", margin: "0 0 6px", fontWeight: 700 }}>Upcoming Matches</h2>
          {upcomingMatchesSource === "completed" && upcomingFactionCards.length > 0 ? (
            <p style={{ margin: "0 0 10px", fontSize: 12, color: "#666" }}>
              No upcoming schedule found — showing this faction’s most recent completed appearances instead.
            </p>
          ) : null}
          {upcomingFactionCards.length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: 10,
                maxHeight: 340,
                overflowY: "auto",
                paddingRight: 4,
              }}
            >
              {upcomingFactionCards.map((c) => (
                <div
                  key={c.key}
                  style={{
                    border: "1px solid #d8dee8",
                    borderRadius: 10,
                    background: "#fff",
                    minHeight: 0,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#f8fafc",
                      background: "linear-gradient(90deg, #1e40af, #2563eb)",
                      padding: "6px 10px",
                      lineHeight: 1.25,
                    }}
                  >
                    {c.eventDateLabel}
                    {" · "}
                    {c.eventName}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                      padding: c.matchPoints !== undefined ? "8px 10px 30px 10px" : "8px 10px",
                      position: "relative",
                    }}
                  >
                    <div style={{ flexShrink: 0 }}>
                      {c.imageUrl ? (
                        <Image
                          src={c.imageUrl}
                          alt=""
                          width={40}
                          height={40}
                          sizes="40px"
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            objectFit: "cover",
                            border: "1px solid #e5e7eb",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            background: "#e5e7eb",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 18,
                            color: "#9ca3af",
                          }}
                          aria-hidden
                        >
                          &#128100;
                        </div>
                      )}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: 13, color: "#111827", lineHeight: 1.25 }}>
                        {c.wrestlerName}
                      </div>
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3, lineHeight: 1.3 }}>
                        {c.matchLabel}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                        {c.isChampionship ? (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                              color: "#92400e",
                              background: "#fef3c7",
                              border: "1px solid #fcd34d",
                              borderRadius: 999,
                              padding: "2px 8px",
                            }}
                          >
                            Title
                          </span>
                        ) : null}
                        {c.isSpecialStipulation ? (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                              color: "#1e40af",
                              background: "#dbeafe",
                              border: "1px solid #93c5fd",
                              borderRadius: 999,
                              padding: "2px 8px",
                            }}
                          >
                            Stipulation
                          </span>
                        ) : null}
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <Link
                          href={c.eventHref}
                          style={{ fontSize: 11, color: "#1a73e8", textDecoration: "none", fontWeight: 700 }}
                        >
                          Event details →
                        </Link>
                      </div>
                    </div>
                    {c.matchPoints !== undefined ? (
                      <div
                        style={{
                          position: "absolute",
                          right: 8,
                          bottom: 6,
                          fontSize: 14,
                          fontWeight: 800,
                          color: c.matchPoints === null ? "#9ca3af" : "#111827",
                          lineHeight: 1,
                          pointerEvents: "none",
                        }}
                        aria-label={
                          c.matchPoints === null
                            ? "Fantasy points not available yet for this match"
                            : `Fantasy points: ${c.matchPoints}`
                        }
                      >
                        {c.matchPoints === null ? "—" : `${c.matchPoints >= 0 ? "+" : ""}${c.matchPoints}`}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 14, color: "#666" }}>
              No upcoming scheduled matches were found for this faction, and no completed matches with this roster are
              available yet.
            </p>
          )}
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: 8 }}>
          {isOwnTeam ? "My faction roster" : "Roster"}
        </h2>
        {rosterRules && (
          <p style={{ fontSize: 14, color: "#666", marginBottom: 24 }}>
            {rosterEntries.length} / {rosterRules.rosterSize} wrestlers (min {rosterRules.minFemale} female, min {rosterRules.minMale} male).
          </p>
        )}
        {rosterTableRows.length > 0 ? (
          <RosterCardGrid
            wrestlers={rosterTableRows.map((w) => {
              const a = teamScoringAudit.totalsByWrestler[w.id];
              const rsPoints = a?.rsPoints ?? w.rsPoints ?? 0;
              const plePoints = a?.plePoints ?? w.plePoints ?? 0;
              // Audit uses the same belt rules but can lag behind row math (e.g. tag member expansion); show the higher BELT value.
              const beltPoints = Math.max(a?.beltPoints ?? 0, w.beltPoints ?? 0);
              const totalPoints = rsPoints + plePoints + beltPoints;
              return {
                id: w.id,
                name: w.name,
                brand: w.brand,
                acquiredAt: rosterAcquiredAtById[w.id] ?? null,
                rsPoints,
                plePoints,
                beltPoints,
                totalPoints,
                mw: w.mw ?? 0,
                rating_2k26: w.rating_2k26,
                rating_2k25: w.rating_2k25,
                championBeltImageUrl: w.championBeltImageUrl,
                image_url: w.image_url,
              };
            })}
            leagueSlug={slug}
            teamUserId={userId}
            viewerUserId={currentUser.id}
            showDrop={isOwnTeam}
            showTrade
            isOwnTeam={isOwnTeam}
            tradeLockedWrestlerIds={isOwnTeam ? tradeLockedWrestlerIds : undefined}
          />
        ) : (
          <p style={{ color: "#666", fontSize: 14 }}>
            {isOwnTeam
              ? "No wrestlers on your roster yet. Add wrestlers via the draft or free agent signings."
              : "This faction has no wrestlers on the roster yet."}
          </p>
        )}
      </section>

      {teamScoringAudit.formerStints.length > 0 && (() => {
        const allFormer = teamScoringAudit.formerStints;
        const formerWithPoints = allFormer.filter((s) => s.points.total > 0);
        const formerLogHref = `/leagues/${slug}/team/${encodeURIComponent(userId)}/former-roster`;
        return (
          <section style={{ marginBottom: 32 }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "baseline",
                gap: "8px 16px",
                marginBottom: 12,
              }}
            >
              <h2 style={{ fontSize: "1.1rem", margin: 0 }}>Former {teamLabel}</h2>
              <Link
                href={formerLogHref}
                style={{ fontSize: 14, color: "#1a73e8", textDecoration: "none", fontWeight: 600 }}
              >
                See full log of former {teamLabel}
              </Link>
            </div>
            <p style={{ fontSize: 14, color: "#666", marginBottom: 12 }}>
              Past roster stints where this faction earned fantasy points. Zero-point stays are hidden here but kept in
              the full log.
            </p>
            {formerWithPoints.length > 0 ? (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {formerWithPoints.map((stint) => (
                  <li
                    key={`${stint.wrestlerId}-${stint.acquiredAt}-${stint.releasedAt}`}
                    style={{
                      padding: "10px 0",
                      borderBottom: "1px solid #eee",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: "#1f2937" }}>
                        {wrestlerNamesMap[stint.wrestlerId] ?? stint.wrestlerId}
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        {stint.acquiredAt} - {stint.releasedAt}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, color: "#111827" }}>
                      {stint.points.total} pts
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
                No former roster members scored points while on this faction yet.{" "}
                <Link href={formerLogHref} style={{ color: "#1a73e8", fontWeight: 600 }}>
                  See full log
                </Link>{" "}
                for every add and drop.
              </p>
            )}
          </section>
        );
      })()}

      {isOwnTeam && (
        <>
          <section id="propose-trade" style={{ marginBottom: 32, scrollMarginTop: 16 }}>
            <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>Propose trade</h2>
            {proposeTradeTo && (() => {
              const target = otherMembers.find((m) => m.user_id === proposeTradeTo);
              if (!target) return null;
              const name = factionDisplayName(target, "this manager");
              return (
                <p style={{ fontSize: 14, color: "var(--color-blue)", fontWeight: 600, marginBottom: 12 }}>
                  Propose a trade with {name} (selected below).
                </p>
              );
            })()}
            <p style={{ fontSize: 14, color: "#666", marginBottom: 12 }}>
              Offer wrestlers to another manager and request wrestlers in return. They can accept, decline, or counter. If both agree, the GM must approve the trade.
            </p>
            {otherMembers.length === 0 ? (
              <p style={{ color: "#666" }}>No other members in the league.</p>
            ) : (
              <ProposeTradeForm
                leagueSlug={slug}
                myRosterWrestlers={rosterWrestlers}
                otherMembers={otherMembers.map((m) => ({
                  id: m.user_id,
                  name: factionDisplayName(m, "Unknown"),
                }))}
                otherRosters={Object.fromEntries(
                  otherMembers.map((m) => [
                    m.user_id,
                    (rosters[m.user_id] ?? []).map((e) => e.wrestler_id),
                  ])
                )}
                wrestlerNames={wrestlerNamesMap}
                initialToUserId={proposeTradeTo}
              />
            )}
          </section>

          <section id="request-release" style={{ marginBottom: 32, scrollMarginTop: 16 }}>
            <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>Drop wrestler</h2>
            <p style={{ fontSize: 14, color: "#666", marginBottom: 12 }}>
              Drop a wrestler from your roster. Takes effect immediately (first come, first serve).
            </p>
            {tradeLockedWrestlerIds.length > 0 && (
              <p
                style={{
                  fontSize: 14,
                  color: "#9a3412",
                  background: "rgba(251, 191, 36, 0.15)",
                  border: "1px solid rgba(217, 119, 6, 0.45)",
                  borderRadius: 8,
                  padding: "10px 12px",
                  marginBottom: 12,
                }}
              >
                <strong>Pending trade:</strong> wrestlers involved in a trade that isn’t finished yet (including
                someone you picked to drop to make room for a trade you accepted) can’t be dropped until that
                trade is cancelled or completes.
              </p>
            )}
            {rosterWrestlers.length === 0 ? (
              <p style={{ color: "#666" }}>Your roster is empty.</p>
            ) : (
              <ProposeReleaseForm
                leagueSlug={slug}
                rosterWrestlers={rosterWrestlers}
                rosterRules={rosterRules}
                freeAgents={freeAgents.map((w) => ({ id: w.id, name: w.name ?? w.id }))}
                pendingReleaseIds={[]}
                tradeLockedWrestlerIds={tradeLockedWrestlerIds}
              />
            )}
          </section>

          <section id="sign-free-agent" style={{ marginBottom: 32, scrollMarginTop: 16 }}>
            <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>Add free agent</h2>
            <p style={{ fontSize: 14, color: "#666", marginBottom: 12 }}>
              Add a wrestler who isn’t on any roster. If your roster is full, drop one to make room. Takes effect immediately (first come, first serve).
            </p>
            {tradeLockedWrestlerIds.length > 0 && rosterRules && rosterWrestlers.length >= rosterRules.rosterSize && (
              <p style={{ fontSize: 13, color: "#92400e", marginBottom: 10 }}>
                If you need to drop someone to sign a free agent, you can’t choose wrestlers that are tied to a pending
                trade (see note under Drop wrestler).
              </p>
            )}
            {freeAgents.length === 0 ? (
              <p style={{ color: "#666" }}>No free agents available.</p>
            ) : (
              <ProposeFreeAgentForm
                leagueSlug={slug}
                freeAgents={freeAgents}
                myRosterWrestlers={rosterWrestlers}
                rosterSize={rosterRules?.rosterSize ?? 0}
                pendingFaIds={[]}
                initialWrestlerId={addFa}
                tradeLockedWrestlerIds={tradeLockedWrestlerIds}
              />
            )}
          </section>
        </>
      )}

      {tradesForMe.length > 0 && (
        <section
          style={{
            marginBottom: 32,
            padding: 16,
            borderRadius: 16,
            background: "linear-gradient(180deg, rgba(34,197,94,0.16) 0%, rgba(34,197,94,0.06) 100%)",
            border: "1px solid rgba(34,197,94,0.35)",
          }}
        >
          <h2
            style={{
              fontSize: "1.1rem",
              marginBottom: 12,
              color: "rgba(16,185,129,1)",
            }}
          >
            Trade proposals for you
          </h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {tradesForMe.map((p) => (
              <li
                key={p.id}
                style={{
                  padding: "12px 0",
                  borderBottom: "1px solid #eee",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <span>
                  {factionDisplayName(memberByUserId[p.from_user_id], "Unknown")} offers: you give{" "}
                  {p.items
                    .filter((i) => i.direction === "receive")
                    .map((i) => wrestlerNamesMap[i.wrestler_id] ?? i.wrestler_id)
                    .join(", ")}{" "}
                  and receive{" "}
                  {p.items
                    .filter((i) => i.direction === "give")
                    .map((i) => wrestlerNamesMap[i.wrestler_id] ?? i.wrestler_id)
                    .join(", ")}
                </span>
                {(() => {
                  const rosterRules = getRosterRulesForLeague(members.length, league.season_slug ?? null);
                  const myRosterIds = (rosters[currentUser.id] ?? []).map((e) => e.wrestler_id);
                  const giveCount = p.items.filter((i) => i.direction === "give").length; // recipient receives
                  const receiveCount = p.items.filter((i) => i.direction === "receive").length; // recipient gives
                  const delta = giveCount - receiveCount;
                  const rosterSize = rosterRules?.rosterSize ?? myRosterIds.length;
                  const requiredDropCount = Math.max(0, myRosterIds.length + delta - rosterSize);
                  const outgoing = new Set(p.items.filter((i) => i.direction === "receive").map((i) => i.wrestler_id));
                  const dropChoices = myRosterIds
                    .filter((id) => !outgoing.has(id))
                    .map((id) => ({ id, name: wrestlerNamesMap[id] ?? id }));
                  return (
                    <TradeProposalRespond
                      leagueSlug={slug}
                      proposalId={p.id}
                      proposalFromUserId={p.from_user_id}
                      requiredDropCount={requiredDropCount}
                      dropChoices={dropChoices}
                    />
                  );
                })()}
              </li>
            ))}
          </ul>
        </section>
      )}

      {isOwnTeam && tradeProposals.filter((p) => p.from_user_id === currentUser.id).length > 0 && (
        <section>
          <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>Your trade proposals</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 14 }}>
            {tradeProposals
              .filter((p) => p.from_user_id === currentUser.id)
              .map((p) => (
                <li key={p.id} style={{ padding: "8px 0", color: "#666", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <span>
                    Trade to {factionDisplayName(memberByUserId[p.to_user_id], "another manager")}:{" "}
                    {p.status === "pending" && "Pending"}
                    {p.status === "cancelled" && "Cancelled"}
                    {p.status === "expired" && "Expired"}
                    {p.status === "rejected" && "Cancelled"}
                    {p.status === "awaiting_gm_approval" && "Accepted — awaiting GM approval"}
                    {p.status === "gm_approved" && "Approved"}
                    {p.status === "gm_rejected" && "Rejected by GM"}
                    {p.status === "accepted" && "Completed"}
                    {!["pending", "cancelled", "expired", "rejected", "awaiting_gm_approval", "gm_approved", "gm_rejected", "accepted"].includes(p.status) && p.status}
                    {(() => {
                      const dropIds = (p.to_user_drop_ids ?? []).map((x) => String(x).trim()).filter(Boolean);
                      if (dropIds.length === 0) return null;
                      const toName = factionDisplayName(memberByUserId[p.to_user_id], "Recipient");
                      const line = formatRecipientRosterCutsLine(
                        toName,
                        dropIds.map((id) => wrestlerNamesMap[id] ?? id)
                      );
                      return line ? (
                        <span style={{ display: "block", marginTop: 4, fontSize: 12, color: "#64748b" }}>{line}</span>
                      ) : null;
                    })()}
                  </span>
                  {p.status === "pending" && (
                    <CancelTradeButton leagueSlug={slug} proposalId={p.id} />
                  )}
                </li>
              ))}
          </ul>
        </section>
      )}
    </main>
  );
}
