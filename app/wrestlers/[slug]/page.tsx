import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { notFound } from "next/navigation";

/** Supabase client created with env read at request time (avoids module-load singleton issues). */
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !key) return supabase;
  return createClient(url, key);
}

function slugNorm(s: string): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, "-").replace(/-+/g, "-");
}
import { getLeagueBySlug, getEffectiveLeagueStartDate, getRostersForLeague, getLeagueMembers } from "@/lib/leagues";
import { scoreEvent } from "@/lib/scoring/scoreEvent.js";
import type { ScoredEvent } from "@/lib/scoring/types";
import { aggregateWrestlerPoints } from "@/lib/scoring/aggregateWrestlerPoints.js";
import {
  computeEndOfMonthBeltPoints,
  FIRST_END_OF_MONTH_POINTS_DATE,
  firstMonthEndOnOrAfter,
  getCurrentChampionsBySlug,
  getMonthlyBeltForWrestler,
  inferReignsFromEvents,
  mergeReigns,
} from "@/lib/scoring/endOfMonthBeltPoints.js";
import { normalizeChampionshipHistoryRow } from "@/lib/championshipHistoryNormalize";
import type { ChampionshipReignRow } from "@/lib/championshipTitleHistory";
import {
  buildWrestlerProfileReignLines,
  collectWrestlerChampionshipHistoryForProfile,
  formatMonthEndLabel,
  formatProfileTitleHistoryTail,
  parseWrestlerAccomplishmentsColumn,
} from "@/lib/wrestlerProfileChampionships";
import { getBeltImageUrlForTitle } from "@/lib/championshipBeltOverlay";
import { factionDisplayName } from "@/lib/factionName";
import { getCurrentChampionsFromChampionshipsTable } from "@/lib/championshipCurrentFromTable";
import {
  CHAMPIONSHIP_CHANGES_TABLE_NAME,
  getCurrentChampionsFromChanges,
  inferReignsFromChampionshipChanges,
} from "@/lib/championshipCurrentFromChanges";
import { getPointsForWrestler } from "@/lib/scoring/aggregateWrestlerPoints.js";
import { aggregateWrestlerMatchStats, getMatchStatsForWrestler, getUnparsedMatchesByWrestler, getUnparsedMatchesForWrestler } from "@/lib/scoring/aggregateWrestlerMatchStats.js";
import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";
import { resolvePersonaToCanonical } from "@/lib/scoring/personaResolution.js";
import { buildWrestlerMap, type WrestlerRow } from "@/lib/boxscore/normalizeWrestlerForCard";
import { eventResultsHref } from "@/lib/event-results/eventResultsRoute";
import { EVENT_TYPES } from "@/lib/scoring/parsers/eventClassifier.js";
import {
  buildPwbsWrestlerMap,
  enrichProfileWrestlerMap,
  getLastMatchesForWrestler,
  getMatchOutcomeForProfile,
  getProfileParticipationSlugs,
  type TimelineEvent,
} from "@/lib/wrestlerMatchTimeline";
import { WrestlerPointsPeriodSelector, type PointsPeriod } from "./WrestlerPointsPeriodSelector";
import WrestlerProfileEventsPanel from "./WrestlerProfileEventsPanel";
import { isMarketingHostRequest } from "@/lib/marketingSurface";
import { WrestlerProfileBackLink } from "./WrestlerProfileBackLink";
import { WrestlerProfileImage } from "./WrestlerProfileImage";
import { getWrestlerFullImageUrl } from "@/lib/wrestlerImages";
import { Suspense } from "react";

/** True if URL looks like a full-body image (e.g. .../cody-rhodes-full.png). */
function isFullBodyImageUrl(url: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  return /-full\.(png|jpg|jpeg|webp)/i.test(url);
}

export const dynamic = "force-dynamic";

const EVENTS_FROM_DATE = "2020-01-01";

function filterEventsByPeriod(
  events: { id: string; name: string | null; date: string | null; matches: unknown }[],
  period: PointsPeriod,
  leagueStartDate: string | null
): { id: string; name: string | null; date: string | null; matches: unknown }[] {
  if (period === "allTime") return events;
  if (period === "2025") return events.filter((e) => e.date && e.date >= "2025-01-01" && e.date <= "2025-12-31");
  if (period === "2026") return events.filter((e) => e.date && e.date >= "2026-01-01" && e.date <= "2026-12-31");
  if (period === "sinceStart") return leagueStartDate ? events.filter((e) => e.date && e.date >= leagueStartDate) : [];
  return events;
}

function getFirstMonthEndForPeriod(period: PointsPeriod, leagueStartDate: string | null): string {
  if (period === "sinceStart" && leagueStartDate) return firstMonthEndOnOrAfter(leagueStartDate);
  if (period === "2025") return "2025-01-31";
  if (period === "2026") return "2026-01-31";
  return FIRST_END_OF_MONTH_POINTS_DATE;
}

function getPeriodLabel(period: PointsPeriod): string {
  if (period === "allTime") return "all-time";
  if (period === "2025") return "2025";
  if (period === "2026") return "2026";
  return "since league start";
}
const BOXSCORE_WRESTLER_BASE = "https://prowrestlingboxscore.com/wrestler";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = (dateStr || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split("-");
    const month = new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-US", { month: "long" });
    return `${month} ${day}, ${y}`;
  }
  return dateStr;
}

function calculateAge(dob: string | null | undefined): number | null {
  if (!dob || !dob.trim()) return null;
  const date = new Date(dob);
  if (isNaN(date.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const m = today.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < date.getDate())) age--;
  return age >= 0 ? age : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const db = getSupabase();
  const { data: wrestler } = await db.from("wrestlers").select("name").eq("id", slug).single();
  const name =
    wrestler?.name ??
    (await (async () => {
      const { data: rows } = await db.from("wrestlers").select("id, name");
      const n = slugNorm(slug);
      const match = (rows ?? []).find(
        (r) => slugNorm(String(r.id)) === n || (r.name && slugNorm(String(r.name)) === n)
      );
      return match?.name ?? slug.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
    })());
  return {
    title: `${name} — Wrestler — Draftastic Fantasy`,
    description: `Fantasy stats and match history for ${name}.`,
  };
}

export default async function WrestlerProfilePage({
  params,
  searchParams: searchParamsPromise,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ period?: string; league?: string; from?: string }>;
}) {
  const { slug } = await params;
  const searchParams = searchParamsPromise ? await searchParamsPromise : {};
  const isMarketingPublic = await isMarketingHostRequest();
  const periodParam = (searchParams.period ?? "").trim() as PointsPeriod | "";
  const leagueSlugFromQuery = (searchParams.league ?? "").trim() || null;
  const leagueSlugParam = isMarketingPublic ? null : leagueSlugFromQuery;
  const fromParam = (searchParams.from ?? "").trim() || null;

  const league = leagueSlugParam ? await getLeagueBySlug(leagueSlugParam) : null;
  const leagueStartDate = league ? getEffectiveLeagueStartDate(league) : null;

  let rosterOwner: { userId: string; label: string } | null = null;
  if (league) {
    const [rosters, members] = await Promise.all([getRostersForLeague(league.id), getLeagueMembers(league.id)]);
    for (const [uid, entries] of Object.entries(rosters ?? {})) {
      const hasWrestler = (entries ?? []).some((e) => String(e.wrestler_id).toLowerCase() === String(slug).toLowerCase());
      if (hasWrestler) {
        const m = members?.find((x) => x.user_id === uid);
        rosterOwner = {
          userId: uid,
          label: factionDisplayName(m, "Unknown"),
        };
        break;
      }
    }
  }
  const currentPeriod: PointsPeriod =
    periodParam && (periodParam === "allTime" || periodParam === "2025" || periodParam === "2026" || periodParam === "sinceStart")
      ? periodParam
      : leagueSlugParam
        ? "sinceStart"
        : "allTime";

  const db = getSupabase();
  let wrestler: {
    id: string;
    name: string | null;
    gender: string | null;
    brand: string | null;
    image_url: string | null;
    dob: string | null;
    accomplishments?: string | null;
    status?: string | null;
    Status?: string | null;
    "2K26 rating"?: unknown;
    "2K25 rating"?: unknown;
  } | null = null;
  const { data: direct, error: directError } = await db
    .from("wrestlers")
    .select('id, name, gender, brand, image_url, dob, accomplishments, "Status", "2K26 rating", "2K25 rating"')
    .eq("id", slug)
    .maybeSingle();
  if (direct && !directError) wrestler = direct;
  if (!wrestler) {
    const { data: rows } = await db.from("wrestlers").select("id, name");
    const n = slugNorm(slug);
    const match = (rows ?? []).find(
      (r) => slugNorm(String(r.id)) === n || (r.name && slugNorm(String(r.name)) === n)
    );
    if (match) {
      const { data: full } = await db
        .from("wrestlers")
        .select('id, name, gender, brand, image_url, dob, accomplishments, "Status", "2K26 rating", "2K25 rating"')
        .eq("id", match.id)
        .single();
      if (full) wrestler = full;
    }
  }
  if (!wrestler) notFound();

  const { data: eventsBase } = await db
    .from("events")
    .select("id, name, date, matches, location, status")
    .or("status.eq.completed,status.eq.live")
    .gte("date", EVENTS_FROM_DATE)
    .order("date", { ascending: true })
    .limit(10000);

  const knownEventIds = ["raw-20250714-1753144554675"];
  const knownKotrPriorIds = ["smackdown-20250620", "raw-20250623"];
  const existingIds = new Set((eventsBase ?? []).map((e) => e.id));
  const toFetch = knownEventIds.filter((id) => !existingIds.has(id));
  const toFetchKotr = knownKotrPriorIds.filter((id) => !existingIds.has(id));
  let extra: { id: string; name: string | null; date: string | null; matches: unknown; location?: string | null; status?: string | null }[] = [];
  if (toFetch.length > 0) {
    const res = await db
      .from("events")
      .select("id, name, date, matches, location, status")
      .in("id", toFetch)
      .or("status.eq.completed,status.eq.live");
    extra = (res.data ?? []) as typeof extra;
  }
  let kotrPriorEvents: { id: string; name: string | null; date: string | null; matches: unknown; location?: string | null; status?: string | null }[] = [];
  if (toFetchKotr.length > 0) {
    const res = await db
      .from("events")
      .select("id, name, date, matches, location, status")
      .in("id", toFetchKotr);
    kotrPriorEvents = (res.data ?? []) as typeof kotrPriorEvents;
  }
  const allEvents = [...(eventsBase ?? []), ...extra, ...kotrPriorEvents].sort(
    (a, b) => (a.date ?? "").localeCompare(b.date ?? "")
  );
  const events = filterEventsByPeriod(allEvents, currentPeriod, leagueStartDate);
  const firstMonthEnd = getFirstMonthEndForPeriod(currentPeriod, leagueStartDate);
  // Monthly belt points and title reigns display always from Jan 2025 so all profiles show/count Jan 2025 onward
  const firstMonthEndForBelt = FIRST_END_OF_MONTH_POINTS_DATE;

  const wrestlerSlugsForTagTeams = [...new Set([slug, wrestler.id].map((s) => String(s).trim()).filter(Boolean))];
  const tagTeamMembersQuery =
    wrestlerSlugsForTagTeams.length === 0
      ? Promise.resolve({ data: [] as { tag_team_id: string }[], error: null as null })
      : db.from("tag_team_members").select("tag_team_id").in("wrestler_slug", wrestlerSlugsForTagTeams);

  const [reignsResult, tagTeamResult, changeRowsResult, currentFromTable, currentFromChanges] = await Promise.all([
    db.from("championship_history").select("*"),
    tagTeamMembersQuery,
    db
      .from(CHAMPIONSHIP_CHANGES_TABLE_NAME)
      .select("championship_type, champion, champion_slug, date")
      .order("date", { ascending: true }),
    getCurrentChampionsFromChampionshipsTable(db).catch(() => ({}) as Record<string, { title: string; wonDate: string }>),
    getCurrentChampionsFromChanges(db).catch(() => ({}) as Record<string, { title: string; wonDate: string }>),
  ]);
  const tagTeamIds = tagTeamResult.error
    ? []
    : [
        ...new Set(
          (tagTeamResult.data ?? [])
            .map((m) => (m.tag_team_id != null ? String(m.tag_team_id).trim() : ""))
            .filter((id) => id !== "")
        ),
      ];
  const { data: rawReigns } = reignsResult;
  const tableReigns = (rawReigns ?? [])
    .map((row) => normalizeChampionshipHistoryRow(row as Record<string, unknown>))
    .sort((a, b) => {
      const ax = (a.won_date ?? a.start_date ?? "").slice(0, 10);
      const bx = (b.won_date ?? b.start_date ?? "").slice(0, 10);
      return ax.localeCompare(bx);
    }) as ChampionshipReignRow[];
  const changeRows = changeRowsResult.error ? [] : (changeRowsResult.data ?? []);
  const changesReigns = inferReignsFromChampionshipChanges(changeRows);
  // Belt / reign merge: use full event history (same idea as league scoring), not period-filtered `events`,
  // so monthly belt and current-title logic match when viewing "since league start".
  const eventsWithDateForBelt = (allEvents ?? []).filter((e): e is typeof e & { date: string } => e.date != null);
  const inferredReigns = inferReignsFromEvents(
    eventsWithDateForBelt as { date: string; matches?: Array<{ title?: string; titleOutcome?: string; result?: string; participants?: string }> }[]
  );
  const reigns = mergeReigns(tableReigns, [...inferredReigns, ...changesReigns]) as ChampionshipReignRow[];

  const pointsBySlug = aggregateWrestlerPoints(
    (events ?? []) as { id: string; name: string; date: string; matches?: object[] }[]
  );
  const matchStatsBySlug = aggregateWrestlerMatchStats(
    (events ?? []) as { id: string; name: string; date: string; matches?: object[] }[]
  );
  const endOfMonthBySlug = computeEndOfMonthBeltPoints(reigns, firstMonthEndForBelt);
  const nameKey = wrestler.name ? normalizeWrestlerName(wrestler.name) : "";
  const wrestlerHistoryRows = collectWrestlerChampionshipHistoryForProfile(tableReigns, {
    urlSlug: slug,
    wrestlerId: wrestler.id,
    wrestlerName: wrestler.name,
    tagTeamIds,
  });
  const profileTitleLines = buildWrestlerProfileReignLines(wrestlerHistoryRows, {
    firstMonthEnd: firstMonthEndForBelt,
    wrestlerId: wrestler.id,
    urlSlug: slug,
  });
  const accomplishmentLines = parseWrestlerAccomplishmentsColumn(wrestler.accomplishments);
  const extraBelt = getMonthlyBeltForWrestler(
    endOfMonthBySlug,
    wrestler.id,
    wrestler.name ?? undefined,
    undefined,
    slug && slug !== wrestler.id ? [slug] : []
  );

  const pointsById = getPointsForWrestler(pointsBySlug, wrestler.id, nameKey);
  const pointsBySlugParam = slug && slug !== wrestler.id ? getPointsForWrestler(pointsBySlug, slug, nameKey) : pointsById;
  const total = (p: { rsPoints: number; plePoints: number; beltPoints: number }) => p.rsPoints + p.plePoints + p.beltPoints;
  const points = total(pointsBySlugParam) >= total(pointsById) ? pointsBySlugParam : pointsById;
  const beltPoints = points.beltPoints + extraBelt;
  const totalPoints = points.rsPoints + points.plePoints + beltPoints;

  const matchStatsById = getMatchStatsForWrestler(matchStatsBySlug, wrestler.id, nameKey);
  const matchStatsBySlugParam = slug && slug !== wrestler.id ? getMatchStatsForWrestler(matchStatsBySlug, slug, nameKey) : matchStatsById;
  const matchStats = (matchStatsBySlugParam.mw >= matchStatsById.mw) ? matchStatsBySlugParam : matchStatsById;

  const unparsedBySlug = getUnparsedMatchesByWrestler(
    (events ?? []) as { id: string; name: string; date: string; matches?: object[] }[]
  );
  const unparsedById = getUnparsedMatchesForWrestler(unparsedBySlug, wrestler.id, nameKey);
  const unparsedBySlugParam = slug && slug !== wrestler.id ? getUnparsedMatchesForWrestler(unparsedBySlug, slug, nameKey) : unparsedById;
  const unparsedMatches = unparsedBySlugParam.length >= unparsedById.length ? unparsedBySlugParam : unparsedById;

  const currentChampionsBySlug = getCurrentChampionsBySlug(reigns);
  // Keys in currentChampionsBySlug are canonical (normalizeWrestlerName); use same normalization for lookup
  const idKey = normalizeWrestlerName(String(wrestler.id));
  const slugKey = slug ? normalizeWrestlerName(slug) : "";
  const currentTitles =
    currentChampionsBySlug[idKey] ??
    currentChampionsBySlug[wrestler.id] ??
    (slugKey ? currentChampionsBySlug[slugKey] : null) ??
    (slug ? currentChampionsBySlug[slug] : null) ??
    (nameKey ? currentChampionsBySlug[nameKey] : null) ??
    [];

  const fromTable =
    currentFromTable[idKey] ?? currentFromTable[slugKey] ?? (nameKey ? currentFromTable[nameKey] : null);
  const fromChanges =
    currentFromChanges[idKey] ?? currentFromChanges[slugKey] ?? (nameKey ? currentFromChanges[nameKey] : null);

  const primaryCurrentTitle = (fromTable ?? fromChanges)
    ? (fromTable ?? fromChanges)!.title
    : (currentTitles[0] ?? null);
  const championBeltImageUrl = primaryCurrentTitle
    ? getBeltImageUrlForTitle(primaryCurrentTitle, wrestler.gender)
    : null;

  const today = new Date().toISOString().slice(0, 10);
  let reignWonDate: string | null;
  const fromSource = fromTable ?? fromChanges;
  if (fromSource?.wonDate) {
    reignWonDate = fromSource.wonDate.slice(0, 10);
  } else {
    const currentReign =
      primaryCurrentTitle && reigns?.length
        ? reigns.find((r) => {
            const lost = (r.lost_date ?? r.end_date) ? String(r.lost_date ?? r.end_date).slice(0, 10) : null;
            if (lost != null && lost <= today) return false;
            const titleName = (r.title ?? r.title_name ?? "").trim();
            if (titleName !== primaryCurrentTitle) return false;
            const champName = r.champion ?? r.champion_name ?? "";
            const raw =
              r.champion_slug ?? r.champion_id ?? (champName ? normalizeWrestlerName(champName) : null);
            if (!raw) return false;
            const won = (r.won_date ?? r.start_date)?.slice(0, 10) ?? "";
            const resolved = resolvePersonaToCanonical(raw, won) ?? raw;
            const key = normalizeWrestlerName(resolved) || resolved.toLowerCase().trim();
            return key === idKey || key === slugKey || (nameKey !== "" && key === nameKey);
          })
        : null;
    reignWonDate = currentReign ? (currentReign.won_date ?? currentReign.start_date)?.slice(0, 10) ?? null : null;
  }
  const daysHeld =
    reignWonDate
      ? Math.floor(
          (new Date().setHours(0, 0, 0, 0) - new Date(reignWonDate).setHours(0, 0, 0, 0)) / (24 * 60 * 60 * 1000)
        )
      : null;

  const { data: wrestlersList } = await db.from("wrestlers").select("id, name, image_url");
  const slugToCanonical = new Map<string, string>();
  for (const w of wrestlersList ?? []) {
    const id = (w.id ?? "").toString().trim();
    const name = (w.name ?? "").toString().trim();
    if (id) {
      const normId = normalizeWrestlerName(id);
      const normName = normalizeWrestlerName(name);
      if (normId) slugToCanonical.set(normId, id);
      if (normName) slugToCanonical.set(normName, id);
    }
  }
  function toCanonicalSlug(s: string): string {
    return slugToCanonical.get(s) ?? s;
  }
  const canonicalSlug = toCanonicalSlug(slug) || toCanonicalSlug(nameKey) || slug;

  /** PWBS-style: `wrestlerMap[id] = { name }` only; timeline uses enriched alias for URL slug ≠ id. */
  const pwbsIdWrestlerMap = buildPwbsWrestlerMap((wrestlersList ?? []) as { id: string; name?: string | null }[]);
  const timelineWrestlerMap = enrichProfileWrestlerMap(pwbsIdWrestlerMap, wrestler.id, slug, wrestler.name);
  const participationSlugs = getProfileParticipationSlugs(wrestler.id, slug);
  const lastFiveItems = getLastMatchesForWrestler(
    allEvents as TimelineEvent[],
    participationSlugs,
    timelineWrestlerMap,
    5
  );
  const matchCardWrestlerMap = buildWrestlerMap((wrestlersList ?? []) as WrestlerRow[]);
  const lastFivePayload = {
    outcomes: lastFiveItems.map((item) =>
      getMatchOutcomeForProfile(item.match, wrestler.id, slug, wrestler.name, pwbsIdWrestlerMap)
    ),
    items: lastFiveItems.map(({ event, match, matchIndex }) => ({
      eventId: event.id,
      eventName: event.name ?? "",
      eventDate: (event.date || "").slice(0, 10),
      location: (event as { location?: string | null }).location ?? null,
      eventStatus: (event as { status?: string | null }).status ?? null,
      matchIndex,
      eventHref: eventResultsHref({ id: event.id, name: event.name ?? "", date: event.date ?? null }),
      match: { ...match } as Record<string, unknown>,
    })),
  };

  type KotrBreakdown = { qualifier: number; semi: number };
  const emptyBreakdown = (): KotrBreakdown => ({ qualifier: 0, semi: 0 });
  const kingFromPriorBreakdown: Record<string, KotrBreakdown> = {};
  const queenFromPriorBreakdown: Record<string, KotrBreakdown> = {};
  let nocEventId: string | null = null;
  let nocDateMs = 0;
  for (const ev of events ?? []) {
    const s = scoreEvent(ev) as ScoredEvent;
    const isNOC =
      s.eventType === EVENT_TYPES.NIGHT_OF_CHAMPIONS ||
      s.eventType === EVENT_TYPES.KING_QUEEN_OF_THE_RING;
    if (isNOC && ev.date) {
      nocEventId = ev.id;
      nocDateMs = new Date(ev.date).getTime();
      break;
    }
  }
  if (nocEventId && nocDateMs > 0) {
    for (const ev of events ?? []) {
      const d = ev.date ? new Date(ev.date).getTime() : 0;
      if (d >= nocDateMs) continue;
      const forceScored = scoreEvent(ev) as ScoredEvent;
      const isRS =
        forceScored.eventType === EVENT_TYPES.RAW ||
        forceScored.eventType === EVENT_TYPES.SMACKDOWN;
      if (!isRS) continue;
      for (const m of forceScored.matches ?? []) {
        if ((m as { isPromo?: boolean }).isPromo || !m.wrestlerPoints) continue;
        for (const wp of m.wrestlerPoints) {
          const toward = (wp as { kotrTowardNOC?: number }).kotrTowardNOC ?? 0;
          const bracket = (wp as { kotrBracket?: string | null }).kotrBracket ?? "king";
          const round = (wp as { kotrRound?: string | null }).kotrRound ?? (toward === 7 ? "semi" : "first");
          if (toward <= 0) continue;
          const participantSlug = wp.wrestler ? normalizeWrestlerName(wp.wrestler) : "";
          if (!participantSlug) continue;
          const eventDate = (ev as { date?: string }).date ? String((ev as { date?: string }).date).slice(0, 10) : "";
          const canon = resolvePersonaToCanonical(participantSlug, eventDate) ?? toCanonicalSlug(participantSlug);
          if (bracket === "queen") {
            const bd = queenFromPriorBreakdown[canon] ?? emptyBreakdown();
            queenFromPriorBreakdown[canon] = bd;
            const atQualifierCap = bd.qualifier >= 3;
            const atSemiCap = bd.semi >= 7;
            if (round === "first" && !atQualifierCap) {
              bd.qualifier += 3;
            } else if (round === "semi" && !atSemiCap) {
              bd.semi += 7;
            }
          } else {
            const bd = kingFromPriorBreakdown[canon] ?? emptyBreakdown();
            kingFromPriorBreakdown[canon] = bd;
            const atQualifierCap = bd.qualifier >= 3;
            const atSemiCap = bd.semi >= 7;
            if (round === "first" && !atQualifierCap) {
              bd.qualifier += 3;
            } else if (round === "semi" && !atSemiCap) {
              bd.semi += 7;
            }
          }
        }
      }
    }
  }

  type MatchRow = {
    eventId: string;
    eventName: string;
    date: string;
    result: string | null;
    title: string | null;
    titleOutcome: string | null;
    total: number;
    breakdown: string[];
    personaName: string | null;
  };
  const eventToRow = new Map<
    string,
    { eventName: string; date: string; total: number; result: string | null; title: string | null; titleOutcome: string | null; personaName: string | null }
  >();

  function participantMatchesWrestler(participantSlug: string, eventDate: string): boolean {
    if (!participantSlug) return false;
    const resolved = resolvePersonaToCanonical(participantSlug, eventDate);
    if (resolved && (resolved === slug || resolved === nameKey)) return true;
    if (participantSlug === slug || participantSlug === nameKey) return true;
    const slugNorm = slug.replace(/-/g, "");
    const partNorm = participantSlug.replace(/-/g, "");
    if (slugNorm && partNorm && slugNorm === partNorm) return true;
    if (participantSlug.includes(slug) && (participantSlug === slug || participantSlug.startsWith(slug + "-") || participantSlug.endsWith("-" + slug))) return true;
    if (slug.includes(participantSlug) && (slug === participantSlug || slug.startsWith(participantSlug + "-") || slug.endsWith("-" + participantSlug))) return true;
    return false;
  }

  for (const event of events ?? []) {
    const scored = scoreEvent(event) as ScoredEvent;
    const eventId = event.id;
    const eventName = scored.eventName ?? event.name ?? "";
    const date = (event.date || "").slice(0, 10);
    const isRS =
      scored.eventType === EVENT_TYPES.RAW ||
      scored.eventType === EVENT_TYPES.SMACKDOWN;
    const isKOTRPLE =
      scored.eventType === EVENT_TYPES.NIGHT_OF_CHAMPIONS ||
      scored.eventType === EVENT_TYPES.KING_QUEEN_OF_THE_RING;
    let eventTotal = 0;
    let firstResult: string | null = null;
    let firstTitle: string | null = null;
    let firstTitleOutcome: string | null = null;
    let firstPersonaName: string | null = null;
    for (const m of scored.matches ?? []) {
      if (m.isPromo || !m.wrestlerPoints) continue;
        for (const wp of m.wrestlerPoints) {
        const participantSlug = wp.wrestler ? normalizeWrestlerName(wp.wrestler) : "";
        if (!participantMatchesWrestler(participantSlug, date)) continue;
        const resolved = resolvePersonaToCanonical(participantSlug, date);
        const earnedAsPersona = resolved && (resolved === slug || resolved === nameKey) && participantSlug !== slug && participantSlug !== nameKey;
        if (earnedAsPersona && wp.wrestler && !firstPersonaName) {
          firstPersonaName = String(wp.wrestler).trim();
        }
        const matchPt = (wp as { matchPoints?: number }).matchPoints ?? 0;
        const mainPt = (wp as { mainEventPoints?: number }).mainEventPoints ?? 0;
        const titlePt = (wp as { titlePoints?: number }).titlePoints ?? 0;
        const specialPt = (wp as { specialPoints?: number }).specialPoints ?? 0;
        const brPt = (wp as { battleRoyalPoints?: number }).battleRoyalPoints ?? 0;
        if (isRS) {
          eventTotal += matchPt + mainPt + titlePt + brPt;
        } else {
          eventTotal += matchPt + mainPt + titlePt + specialPt + brPt;
        }
        if (firstResult === null && (wp.total ?? 0) > 0) {
          firstResult = m.result ?? null;
          firstTitle = m.title ?? null;
          firstTitleOutcome = m.titleOutcome ?? null;
        }
      }
    }
    let total = eventTotal;
    if (eventId === nocEventId) {
      const k = kingFromPriorBreakdown[canonicalSlug] ?? emptyBreakdown();
      const q = queenFromPriorBreakdown[canonicalSlug] ?? emptyBreakdown();
      total = eventTotal + k.qualifier + k.semi + q.qualifier + q.semi;
    }
    if (total > 0) {
      eventToRow.set(eventId, {
        eventName,
        date,
        total,
        result: firstResult,
        title: firstTitle,
        titleOutcome: firstTitleOutcome,
        personaName: firstPersonaName,
      });
    }
  }

  const matchesWithPoints: MatchRow[] = [...eventToRow.entries()].map(([eventId, row]) => ({
    eventId,
    eventName: row.eventName,
    date: row.date,
    result: row.result,
    title: row.title,
    titleOutcome: row.titleOutcome,
    total: row.total,
    breakdown: [],
    personaName: row.personaName,
  }));
  matchesWithPoints.sort((a, b) => b.date.localeCompare(a.date));

  const displayName = wrestler.name ?? slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  const age = calculateAge(wrestler.dob);
  const boxscoreUrl = `${BOXSCORE_WRESTLER_BASE}/${slug}`;
  const rawStatus = (wrestler as Record<string, unknown>).Status ?? (wrestler as Record<string, unknown>).status;
  const isInjured =
    rawStatus != null &&
    (String(rawStatus).trim().toLowerCase() === "injured" || String(rawStatus).trim().toLowerCase() === "inj");

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 900, margin: "0 auto", fontSize: 16, lineHeight: 1.5 }}>
      <p style={{ marginBottom: 20 }}>
        <Suspense fallback={<Link href="/wrestlers" style={{ color: "#1a73e8", textDecoration: "none" }}>← Wrestlers</Link>}>
          <WrestlerProfileBackLink marketingPublicSite={isMarketingPublic} />
        </Suspense>
      </p>

      <div style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "8px 16px" }}>
        <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
          {displayName}
          {isInjured && (
            <span style={{ color: "#c00", fontWeight: 600, fontSize: "0.85em" }}>INJ</span>
          )}
        </h1>
        <a
          href={boxscoreUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#1a73e8", textDecoration: "none", fontSize: 15 }}
        >
          View profile on Pro Wrestling Boxscore →
        </a>
        <p style={{ margin: 0, color: "#555", width: "100%" }}>
          {wrestler.brand ?? "—"} · {wrestler.gender ? (String(wrestler.gender).toLowerCase() === "male" || wrestler.gender === "M" ? "Male" : "Female") : "—"}
          {age != null ? ` · ${age} years old` : ""}
          {(() => {
            const r26 = (wrestler as Record<string, unknown>)["2K26 rating"];
            const r25 = (wrestler as Record<string, unknown>)["2K25 rating"];
            const n26 = r26 != null && r26 !== "" ? Number(r26) : null;
            const n25 = r25 != null && r25 !== "" ? Number(r25) : null;
            const val = n26 ?? n25;
            if (val == null || Number.isNaN(val)) return null;
            return (
              <>
                {" "}
                · 2K Rating: <span style={{ color: "#c00", fontWeight: 700 }}>{val}</span>
                {n26 != null ? " (2K26)" : " (2K25)"}
              </>
            );
          })()}
        </p>
      </div>

      <section style={{ display: "flex", gap: 24, alignItems: "stretch", marginBottom: 32, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <WrestlerProfileImage
            fullImageUrl={
              (isFullBodyImageUrl(wrestler.image_url)
                ? wrestler.image_url
                : getWrestlerFullImageUrl(slug)) || getWrestlerFullImageUrl(slug) || ""
            }
            fallbackImageUrl={
              isFullBodyImageUrl(wrestler.image_url)
                ? getWrestlerFullImageUrl(slug)
                : wrestler.image_url
            }
            alt={displayName}
            variant="full"
            beltImageUrl={championBeltImageUrl}
          />
          {isInjured && (
            <span
              title="Injured"
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
              }}
              aria-label="Injured"
            >
              <svg width={16} height={16} viewBox="0 0 12 12" fill="none" stroke="#c00" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                <path d="M6 2v8M3 5h6" />
              </svg>
            </span>
          )}
        </div>
        <div
          style={{
            flex: "1 1 320px",
            minWidth: 0,
            minHeight: 280,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            justifyContent: "flex-start",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            {rosterOwner && leagueSlugParam ? (
              <Link
                href={`/leagues/${encodeURIComponent(leagueSlugParam)}/team?proposeTradeTo=${encodeURIComponent(rosterOwner.userId)}#propose-trade`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  padding: "5px 10px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#1a1a1a",
                  background: "#e5e5e5",
                  border: "1px solid #ccc",
                  borderRadius: 4,
                  textDecoration: "none",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M13 5H4M4 5L6 3M4 5l2 2" />
                  <path d="M3 11h9M12 11l-2-2M12 11l-2 2" />
                </svg>
                Trade with {rosterOwner.label}
              </Link>
            ) : (
              <>
                {leagueSlugParam && (
                  <Link
                    href={`/leagues/${encodeURIComponent(leagueSlugParam)}/team?addFa=${encodeURIComponent(wrestler.id)}#sign-free-agent`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "5px 10px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#fff",
                      background: "var(--color-blue)",
                      border: "none",
                      borderRadius: 4,
                      textDecoration: "none",
                    }}
                  >
                    + Add
                  </Link>
                )}
                {!isMarketingPublic && (
                  <Link
                    href={
                      leagueSlugParam
                        ? `/leagues/${encodeURIComponent(leagueSlugParam)}/watchlist?add=${encodeURIComponent(wrestler.id)}`
                        : `/wrestlers/watch?add=${encodeURIComponent(wrestler.id)}`
                    }
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "5px 10px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--color-text)",
                      background: "transparent",
                      border: "1px solid var(--color-border)",
                      borderRadius: 4,
                      textDecoration: "none",
                    }}
                  >
                    ⚑ Watchlist
                  </Link>
                )}
              </>
            )}
            <WrestlerPointsPeriodSelector currentPeriod={currentPeriod} leagueSlug={leagueSlugParam} compact />
          </div>
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            <h2 style={{ fontSize: "0.95rem", fontWeight: 700, margin: 0 }}>
              Points ({getPeriodLabel(currentPeriod)})
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 300, flex: 1, minHeight: 0 }}>
              <div style={{ padding: "6px 10px", background: "#1a1a1a", color: "#fff", borderRadius: 4, textAlign: "center" }}>
                <span style={{ opacity: 0.9, fontSize: 10 }}>Total Points</span>
                <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{totalPoints}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, flexShrink: 0 }}>
                <div style={{ padding: "4px 8px", background: "#f5f5f5", borderRadius: 4, textAlign: "center" }}>
                  <span style={{ color: "#666", fontSize: 10 }}>R/S Points</span>
                  <div style={{ fontSize: "0.9rem", fontWeight: 700 }}>{points.rsPoints}</div>
                </div>
                <div style={{ padding: "4px 8px", background: "#f5f5f5", borderRadius: 4, textAlign: "center" }}>
                  <span style={{ color: "#666", fontSize: 10 }}>PLE Points</span>
                  <div style={{ fontSize: "0.9rem", fontWeight: 700 }}>{points.plePoints}</div>
                </div>
                <div style={{ padding: "4px 8px", background: "#f5f5f5", borderRadius: 4, textAlign: "center" }}>
                  <span style={{ color: "#666", fontSize: 10 }}>Belt Points</span>
                  <div style={{ fontSize: "0.9rem", fontWeight: 700 }}>{beltPoints}</div>
                  {extraBelt > 0 && (
                    <span style={{ fontSize: 9, color: "#666" }}>(+{extraBelt} mo)</span>
                  )}
                </div>
                <div style={{ padding: "4px 8px", background: "#f5f5f5", borderRadius: 4, textAlign: "center" }}>
                  <span style={{ color: "#666", fontSize: 10 }}>PPM</span>
                  <div style={{ fontSize: "0.9rem", fontWeight: 700 }}>
                    {matchStats.mw > 0 ? ((points.rsPoints + points.plePoints) / matchStats.mw).toFixed(1) : "—"}
                  </div>
                  <span style={{ fontSize: 9, color: "#666" }}>per match</span>
                </div>
              </div>
              <p
                style={{
                  marginTop: 8,
                  marginBottom: 0,
                  fontSize: 11,
                  color: "#666",
                  lineHeight: 1.45,
                  flexShrink: 0,
                }}
              >
                R/S = Raw & SmackDown · PLE = Premium Live Events · Belt = title points · PPM = points per match · Total = R/S + PLE + Belt
              </p>
            </div>
          </div>
        </div>
      </section>

      {primaryCurrentTitle && (
        <section style={{ marginBottom: 32 }}>
          <div style={{ marginTop: 0, padding: "12px 16px", background: "linear-gradient(135deg, #f4e4bc 0%, #e8d08a 50%, #d4af37 100%)", borderRadius: 8, border: "1px solid #b8860b", boxShadow: "0 1px 3px rgba(184, 134, 11, 0.3)", textAlign: "center" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: 8, color: "#5c4a1a" }}>
              Current championship
            </h3>
            <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "#3d3511", marginBottom: 10, lineHeight: 1.2 }}>
              {primaryCurrentTitle}
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 14, color: "#3d3511", justifyContent: "center" }}>
              {reignWonDate && (
                <span><strong>Won</strong> {formatDate(reignWonDate)}</span>
              )}
              {daysHeld != null && (
                <span><strong>Days held</strong> {daysHeld}</span>
              )}
            </div>
          </div>
        </section>
      )}

      <section style={{ marginBottom: 32 }}>
        <div style={{ marginTop: 0, padding: "12px 16px", background: "var(--color-bg-elevated, #f8f9fa)", borderRadius: 8, border: "1px solid var(--color-border, #e9ecef)" }}>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: 10, color: "var(--color-text-muted, #555)" }}>
            Match record ({getPeriodLabel(currentPeriod)})
          </h3>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 14 }}>
            <span><strong>MW</strong> {matchStats.mw}</span>
            <span><strong>Win</strong> {matchStats.win}</span>
            <span><strong>W%</strong> {matchStats.mw > 0 ? ((matchStats.win / matchStats.mw) * 100).toFixed(1) : "—"}</span>
            <span><strong>Loss</strong> {matchStats.loss}</span>
            <span><strong>L%</strong> {matchStats.mw > 0 ? ((matchStats.loss / matchStats.mw) * 100).toFixed(1) : "—"}</span>
            <span><strong>NC</strong> {matchStats.nc}</span>
            <span><strong>DQW</strong> {matchStats.dqw}</span>
            <span><strong>DQL</strong> {matchStats.dql}</span>
            <span><strong>DQ%</strong> {matchStats.mw > 0 ? (((matchStats.dqw + matchStats.dql) / matchStats.mw) * 100).toFixed(1) : "—"}</span>
          </div>
          <p style={{ marginTop: 8, marginBottom: 0, fontSize: 12, color: "var(--color-text-muted, #666)" }}>
            MW = Matches wrestled · Win/Loss = standard · NC = No contest · DQW/DQL = Win/Loss via DQ · W%/L%/DQ% = percentages of matches
          </p>
        </div>

        {unparsedMatches.length > 0 && (
          <div style={{ marginTop: 16, padding: "12px 16px", background: "#fff8e6", borderRadius: 8, border: "1px solid #e6d9b8" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: 8, color: "#8b6914" }}>
              Matches needing review ({unparsedMatches.length})
            </h3>
            <p style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
              These events include matches where this wrestler participated but winner/loser could not be parsed. Fix the event data or parser so outcomes are clear.
            </p>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>
              {unparsedMatches.map((u, i) => (
                <li key={i} style={{ marginBottom: 4 }}>
                  <Link
                    href={eventResultsHref({ id: u.eventId, name: u.eventName, date: u.eventDate })}
                    style={{ color: "#1a73e8", textDecoration: "none" }}
                  >
                    {u.eventName}
                  </Link>
                  <span style={{ color: "#666", marginLeft: 8 }}>{formatDate(u.eventDate)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section style={{ marginBottom: 32 }}>
        <div
          style={{
            padding: "16px 18px",
            background: "#121418",
            borderRadius: 8,
            border: "1px solid #2a2d35",
            color: "#e8eaed",
          }}
        >
          <h3
            style={{
              fontSize: "0.95rem",
              fontWeight: 700,
              margin: "0 0 10px 0",
              color: "#d0ac56",
              paddingBottom: 8,
              borderBottom: "1px solid #d0ac56",
            }}
          >
            Accomplishments
          </h3>
          {accomplishmentLines.length === 0 ? (
            <p style={{ margin: 0, fontSize: 14, color: "#9aa0a6", fontStyle: "italic" }}>No accomplishments added yet.</p>
          ) : (
            <ul style={{ margin: "8px 0 0 0", paddingLeft: 22, fontSize: 15, lineHeight: 1.5 }}>
              {accomplishmentLines.map((line, i) => (
                <li key={i} style={{ marginBottom: 4 }}>
                  {line}
                </li>
              ))}
            </ul>
          )}

          <h3
            style={{
              fontSize: "0.95rem",
              fontWeight: 700,
              margin: "24px 0 6px 0",
              color: "#d0ac56",
              paddingBottom: 8,
              borderBottom: "1px solid #d0ac56",
            }}
          >
            Title Reigns
          </h3>
          <p style={{ margin: "0 0 10px 0", fontSize: 12, color: "#9aa0a6", lineHeight: 1.45 }}>
            When this reign overlaps a scored month-end, we list the months that count toward fantasy belt hold points
            (same rules as the rest of the app), starting from {formatMonthEndLabel(FIRST_END_OF_MONTH_POINTS_DATE)}{" "}
            through the last completed calendar month.
          </p>
          {profileTitleLines.length === 0 ? (
            <p style={{ margin: 0, fontSize: 14, color: "#9aa0a6" }}>No title reigns on record for this wrestler.</p>
          ) : (
            <ul style={{ margin: "8px 0 0 0", paddingLeft: 22, fontSize: 15, lineHeight: 1.55, listStyleType: "disc" }}>
              {profileTitleLines.map((line) => (
                <li key={line.rowKey} style={{ marginBottom: 12 }}>
                  {isMarketingPublic ? (
                    <span style={{ fontWeight: 700, color: "#d0ac56" }}>{line.displayTitle}</span>
                  ) : (
                    <Link
                      href={`/championship/${encodeURIComponent(line.routeSlug)}`}
                      style={{
                        fontWeight: 700,
                        color: "#d0ac56",
                        textDecoration: "none",
                      }}
                    >
                      {line.displayTitle}
                    </Link>
                  )}
                  <span style={{ color: "#e8eaed" }}> — {formatProfileTitleHistoryTail(line)}</span>
                  {line.beltMonthEndsFormatted.length > 0 && (
                    <div style={{ marginTop: 4, fontSize: 12, color: "#b0b8c4", lineHeight: 1.4 }}>
                      <span style={{ color: "#8f9a9e" }}>Belt points months: </span>
                      {line.beltMonthEndsFormatted.join(", ")}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <WrestlerProfileEventsPanel
        lastFive={lastFivePayload}
        matchTimelineEvents={
          allEvents as {
            id: string;
            name?: string | null;
            date?: string | null;
            location?: string | null;
            status?: string | null;
            matches?: unknown[] | null;
          }[]
        }
        matchCardWrestlerMap={matchCardWrestlerMap as Record<string, Record<string, unknown>>}
        pointsRows={matchesWithPoints.map(({ eventId, eventName, date, result, title, titleOutcome, total, personaName }) => ({
          eventId,
          eventName,
          date,
          result,
          title,
          titleOutcome,
          total,
          personaName,
        }))}
      />
    </main>
  );
}
