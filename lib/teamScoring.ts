import { createClient } from "@/lib/supabase/server";
import { getEffectiveLeagueStartDate, getRosterStintsForLeague, type LeagueRosterStint } from "@/lib/leagues";
import { scoreEvent } from "@/lib/scoring/scoreEvent.js";
import { EVENT_TYPES } from "@/lib/scoring/parsers/eventClassifier.js";
import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";
import { resolvePersonaToCanonical } from "@/lib/scoring/personaResolution.js";
import { rosterStintMatchesContribSlug, sumMonthlyBeltPointsForStint } from "@/lib/scoring/rosterStintEventPoints";
import {
  compareStintsForEventTieBreak,
  rosterStintActiveForEvent,
  rosterStintActiveForMonthEndBelt,
  rosterStintActiveForWeeklyBeltHold,
} from "@/lib/scoring/rosterStintEventWindow";
import {
  BELT_REIGN_INFERENCE_EVENTS_FROM,
  computeEndOfMonthBeltPointsForSingleMonth,
  computeWeeklyBeltHoldPointsForWeekEndSunday,
  firstLegacyCalendarMonthEndEligibleForLeagueStart,
  getCompletedMonthEndsForBeltScoring,
  inferReignsFromEvents,
  mergeReigns,
} from "@/lib/scoring/endOfMonthBeltPoints.js";
import {
  CHAMPIONSHIP_CHANGES_TABLE_NAME,
  inferReignsFromChampionshipChanges,
} from "@/lib/championshipCurrentFromChanges";
import {
  beltScoringLastWeekEndSundayInclusive,
  firstEligibleWeekEndSundayForLeagueStart,
  getCompletedWeekEndSundaysForBeltScoring,
  weekEndSundayContaining,
} from "@/lib/beltWeeklyHold";
import { EVENT_STATUSES_FOR_SCORING } from "@/lib/eventsScoring";
import { leagueUsesWeeklyPstBeltHold, ROAD_TO_SUMMERSLAM_SEASON_SLUG } from "@/lib/leagueStructure";
import { wrestlerRosterFromBrand } from "@/lib/wrestlerRosterFromBrand";
import { getCurrentChampionsMonthlyBeltBySlug } from "@/lib/scoring/currentChampionsBeltSnapshot";
import {
  beltScoringLastMonthEndInclusive,
  legacySeasonEndBeltSnapshotYmd,
  shouldSkipJulyMonthEndBeltForRts2026,
} from "@/lib/beltRts2026JulyDeferral";
import { isPastEndOfDayPst } from "@/lib/pstCivilTime";

export type TeamScoreLedgerRow = {
  eventId: string;
  eventName: string;
  eventDate: string;
  wrestlerId: string;
  points: number;
  rsPoints: number;
  plePoints: number;
  beltPoints: number;
  details: string[];
};

export type TeamWrestlerPoints = {
  total: number;
  rsPoints: number;
  plePoints: number;
  beltPoints: number;
};

export type FormerTeamStint = {
  wrestlerId: string;
  acquiredAt: string;
  releasedAt: string;
  points: TeamWrestlerPoints;
};

export type TeamScoringAudit = {
  ledgerRows: TeamScoreLedgerRow[];
  totalsByWrestler: Record<string, TeamWrestlerPoints>;
  formerStints: FormerTeamStint[];
  activeStints: LeagueRosterStint[];
  teamTotal: number;
};

const ZERO_POINTS: TeamWrestlerPoints = { total: 0, rsPoints: 0, plePoints: 0, beltPoints: 0 };

// Roster acquired/released dates are stored as UTC dates, but event dates are treated as local.
// In practice this yields a consistent +1 day drift for the events/league you're testing.
// We apply a -1 day offset for stint window comparisons so points attribute to the intended event day.
const ROSTER_STINT_DATE_OFFSET_DAYS = -1;

/** Week-ending Sunday YYYY-MM-DD → short label for ledger (civil date). */
function beltHoldLedgerLabel(weekEndSundayYmd: string): string {
  const d = new Date(weekEndSundayYmd + "T12:00:00.000Z");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function addPoints(target: TeamWrestlerPoints, src: TeamWrestlerPoints) {
  target.total += src.total;
  target.rsPoints += src.rsPoints;
  target.plePoints += src.plePoints;
  target.beltPoints += src.beltPoints;
}

function emptyPoints(): TeamWrestlerPoints {
  return { ...ZERO_POINTS };
}

type EventContribution = {
  points: TeamWrestlerPoints;
  details: string[];
};

/** Return shape of scoreEvent() — JS module has no TS types, so we assert locally. */
type ScoredEventMatch = {
  isPromo?: boolean;
  wrestlerPoints?: Array<{
    wrestler?: string;
    matchPoints?: number;
    titlePoints?: number;
    mainEventPoints?: number;
    battleRoyalPoints?: number;
    specialPoints?: number;
    breakdown?: unknown[];
    kotrTowardNOC?: number;
  }>;
};

type ScoredEvent = {
  eventType: string;
  matches?: ScoredEventMatch[];
};

/**
 * Team-attributed scoring audit:
 * - Per-event ledger rows (who scored, when, and why)
 * - Totals by wrestler while on this team only
 * - Former roster stint summaries with stint-only points
 */
export async function getTeamScoringAudit(leagueId: string, userId: string): Promise<TeamScoringAudit> {
  const supabase = await createClient();
  const { data: league } = await supabase
    .from("leagues")
    .select("id, start_date, end_date, draft_date, created_at, season_slug")
    .eq("id", leagueId)
    .single();
  if (!league) {
    return { ledgerRows: [], totalsByWrestler: {}, formerStints: [], activeStints: [], teamTotal: 0 };
  }

  const leagueStart = getEffectiveLeagueStartDate(league);
  const leagueEnd = league.end_date ? String(league.end_date).slice(0, 10) : "";

  const stints = await getRosterStintsForLeague(leagueId);

  const eventsSelectWithStart = supabase
    .from("events")
    .select("id, name, date, broadcast_start_ts, matches")
    .in("status", [...EVENT_STATUSES_FOR_SCORING])
    .order("date", { ascending: true });

  const { data: eventsWithStart, error: eventsErr } = await eventsSelectWithStart;
  const events =
    eventsWithStart ??
    (eventsErr && /column.*broadcast_start_ts does not exist/i.test(eventsErr.message ?? "")
      ? (
          await supabase
            .from("events")
            .select("id, name, date, matches")
            .in("status", [...EVENT_STATUSES_FOR_SCORING])
            .order("date", { ascending: true })
        ).data ?? []
      : []);

  const teamStints = stints.filter((s) => s.user_id === userId);
  const activeStints = teamStints.filter((s) => s.released_at == null);

  // We need wrestler display names for ALL stints so scoring slug aliases
  // can match correctly across team transitions.
  const rosterWrestlerIds = [...new Set(stints.map((s) => s.wrestler_id))];
  const { data: wrestlerRows } = rosterWrestlerIds.length
    ? await supabase.from("wrestlers").select("id, name, brand").in("id", rosterWrestlerIds)
    : { data: [] as Array<{ id: string; name: string | null; brand?: string | null }> };
  const wrestlerNameById: Record<string, string> = {};
  const nxtRosterByWrestlerId: Record<string, boolean> = {};
  for (const w of wrestlerRows ?? []) {
    wrestlerNameById[w.id] = w.name ?? w.id;
    nxtRosterByWrestlerId[w.id] = wrestlerRosterFromBrand((w as { brand?: string | null }).brand ?? null) === "NXT";
  }
  const enforceMainRosterOnlyForNxt = (league as { season_slug?: string | null }).season_slug === ROAD_TO_SUMMERSLAM_SEASON_SLUG;

  const filteredEvents = (events ?? []).filter((e) => {
    const d = String(e.date ?? "").slice(0, 10);
    if (!d) return false;
    if (leagueStart && d < leagueStart) return false;
    if (leagueEnd && d > leagueEnd) return false;
    return true;
  });

  const sortedEvents = [...filteredEvents].sort((a, b) =>
    String(a.date ?? "").localeCompare(String(b.date ?? ""))
  );
  const useBroadcastForMonthlyBelt = sortedEvents.some(
    (e) => !!(e as { broadcast_start_ts?: string | null }).broadcast_start_ts
  );

  const totalsByWrestler: Record<string, TeamWrestlerPoints> = {};
  const ledgerRows: TeamScoreLedgerRow[] = [];
  const stintPoints = new Map<string, TeamWrestlerPoints>();
  let kotrCarryOver: Record<string, number> = {};

  for (const event of sortedEvents) {
    const eventDate = String(event.date ?? "").slice(0, 10);
    const eventEndOfDayMs = Date.parse(`${eventDate}T23:59:59.999Z`);
    const eventStartMs = (event as { broadcast_start_ts?: string | null }).broadcast_start_ts
      ? Date.parse(String((event as { broadcast_start_ts?: string | null }).broadcast_start_ts))
      : NaN;
    const useBroadcastStart = Number.isFinite(eventStartMs);
    const eventMs = eventEndOfDayMs;
    const broadcastStartMs = useBroadcastStart ? eventStartMs : undefined;
    const scored = scoreEvent(event as { id?: string; name?: string; date?: string; matches?: unknown[] }) as ScoredEvent;
    const eventType = scored.eventType;
    const isRS =
      eventType === EVENT_TYPES.RAW ||
      eventType === EVENT_TYPES.SMACKDOWN ||
      eventType === EVENT_TYPES.NXT;
    const isKOTRPLE =
      eventType === EVENT_TYPES.NIGHT_OF_CHAMPIONS ||
      eventType === EVENT_TYPES.KING_QUEEN_OF_THE_RING;

    const contribBySlug: Record<string, EventContribution> = {};

    for (const m of scored.matches ?? []) {
      if (m.isPromo || !m.wrestlerPoints) continue;
      for (const wp of m.wrestlerPoints) {
        const participant = wp.wrestler;
        if (!participant) continue;
        const rawSlug = normalizeWrestlerName(participant);
        if (!rawSlug) continue;
        const slug = resolvePersonaToCanonical(rawSlug, eventDate) ?? rawSlug;

        let rsPoints = 0;
        let plePoints = 0;
        let beltPoints = Number(wp.titlePoints || 0);
        const details = Array.isArray(wp.breakdown)
          ? wp.breakdown.filter((x): x is string => typeof x === "string")
          : [];

        if (isRS) {
          rsPoints =
            Number(wp.matchPoints || 0) +
            Number(wp.mainEventPoints || 0) +
            Number(wp.battleRoyalPoints || 0);
          const toward = Number(wp.kotrTowardNOC || 0);
          if (toward > 0) {
            kotrCarryOver[slug] = (kotrCarryOver[slug] || 0) + toward;
          }
        } else {
          const carry = isKOTRPLE ? Number(kotrCarryOver[slug] || 0) : 0;
          if (isKOTRPLE && carry > 0) {
            kotrCarryOver[slug] = 0;
            details.push(`KOTR carryover: +${carry}`);
          }
          plePoints =
            carry +
            Number(wp.matchPoints || 0) +
            Number(wp.mainEventPoints || 0) +
            Number(wp.specialPoints || 0) +
            Number(wp.battleRoyalPoints || 0);
        }

        const total = rsPoints + plePoints + beltPoints;
        if (!contribBySlug[slug]) {
          contribBySlug[slug] = {
            points: { total: 0, rsPoints: 0, plePoints: 0, beltPoints: 0 },
            details: [],
          };
        }
        addPoints(contribBySlug[slug]!.points, { total, rsPoints, plePoints, beltPoints });
        if (details.length > 0) {
          contribBySlug[slug]!.details.push(...details);
        }
      }
    }

    for (const [slug, contribution] of Object.entries(contribBySlug)) {
      // Choose a single "best" active stint globally for this slug at this eventDate,
      // so overlapping roster windows don't double-count points across teams.
      let selectedStint: (typeof stints)[number] | null = null;

      for (const s of stints) {
        if (
          !rosterStintActiveForEvent({
            eventDate,
            eventMs,
            broadcastStartMs,
            useBroadcastStart,
            stint: s,
            rosterStintDateOffsetDays: ROSTER_STINT_DATE_OFFSET_DAYS,
          })
        ) {
          continue;
        }

        const displayName = wrestlerNameById[s.wrestler_id];
        if (!rosterStintMatchesContribSlug(s.wrestler_id, displayName, slug, eventDate)) continue;

        if (!selectedStint) {
          selectedStint = s;
          continue;
        }

        if (
          compareStintsForEventTieBreak(
            { ...s, user_id: s.user_id, wrestler_id: s.wrestler_id },
            { ...selectedStint, user_id: selectedStint.user_id, wrestler_id: selectedStint.wrestler_id },
            useBroadcastStart,
            ROSTER_STINT_DATE_OFFSET_DAYS,
            slug,
            eventDate
          ) < 0
        ) {
          selectedStint = s;
        }
      }

      if (!selectedStint) continue;
      if (selectedStint.user_id !== userId) continue;
      if (
        enforceMainRosterOnlyForNxt &&
        nxtRosterByWrestlerId[selectedStint.wrestler_id] &&
        (eventType === EVENT_TYPES.NXT || String(eventType).startsWith("nxt-"))
      ) {
        continue;
      }

      const wrestlerId = selectedStint.wrestler_id;
      if (!totalsByWrestler[wrestlerId]) totalsByWrestler[wrestlerId] = emptyPoints();
      addPoints(totalsByWrestler[wrestlerId]!, contribution.points);

      ledgerRows.push({
        eventId: String(event.id ?? ""),
        eventName: String(event.name ?? "Unknown event"),
        eventDate,
        wrestlerId,
        points: contribution.points.total,
        rsPoints: contribution.points.rsPoints,
        plePoints: contribution.points.plePoints,
        beltPoints: contribution.points.beltPoints,
        details: [...new Set(contribution.details)],
      });

      const key = `${selectedStint.wrestler_id}::${selectedStint.acquired_at}::${selectedStint.released_at ?? ""}`;
      if (!stintPoints.has(key)) stintPoints.set(key, emptyPoints());
      addPoints(stintPoints.get(key)!, contribution.points);
    }
  }

  // Title-hold belt points: weekly PST (RTS) or legacy month-end rows on the calendar month-end date.
  try {
    const [histResult, changesResult] = await Promise.all([
      supabase
        .from("championship_history")
        .select(
          "champion_slug, champion, champion_name, title, title_name, won_date, start_date, lost_date, end_date"
        )
        .order("won_date", { ascending: true }),
      supabase
        .from(CHAMPIONSHIP_CHANGES_TABLE_NAME)
        .select("championship_type, champion, champion_slug, date")
        .order("date", { ascending: true }),
    ]);
    const histRows = histResult.data;
    const changesRows = changesResult.error ? [] : (changesResult.data ?? []);
    const leagueEndYmd = leagueEnd ? String(leagueEnd).slice(0, 10) : "";
    const eventsForBeltReignInference = (events ?? []).filter((e) => {
      const d = String(e.date ?? "").slice(0, 10);
      if (!d || d < BELT_REIGN_INFERENCE_EVENTS_FROM) return false;
      if (leagueEndYmd && d > leagueEndYmd) return false;
      return true;
    });
    const inferredReigns = inferReignsFromEvents(eventsForBeltReignInference);
    const changesReigns = inferReignsFromChampionshipChanges(changesRows);
    const reigns = mergeReigns(histRows ?? [], [...inferredReigns, ...changesReigns]);
    const seasonSlug = (league as { season_slug?: string | null }).season_slug ?? null;
    const useWeeklyBelt = leagueUsesWeeklyPstBeltHold(seasonSlug);

    if (useWeeklyBelt) {
      const beltFirstWeekEnd = firstEligibleWeekEndSundayForLeagueStart(leagueStart);
      const lastWeekCap = beltScoringLastWeekEndSundayInclusive(leagueEndYmd || undefined);
      const beltLockEvents = eventsForBeltReignInference.map((e) => ({
        id: String((e as { id?: string }).id ?? ""),
        name: (e as { name?: string | null }).name ?? null,
        date: (e as { date?: string | null }).date ?? null,
      }));
      const weekEnds = getCompletedWeekEndSundaysForBeltScoring(beltFirstWeekEnd, lastWeekCap, Date.now(), {
        leagueStartYmd: leagueStart,
        leagueEndYmd: leagueEndYmd || "2099-12-31",
        events: beltLockEvents,
      });
      for (const lockYmd of weekEnds) {
        const weekEndSun = weekEndSundayContaining(lockYmd);
        const beltBySlug = computeWeeklyBeltHoldPointsForWeekEndSunday(
          reigns,
          lockYmd,
          beltFirstWeekEnd,
          weekEndSun
        );
        const eventName =
          lockYmd === weekEndSun
            ? `Weekly belt hold (${beltHoldLedgerLabel(lockYmd)} PT week close, Los Angeles time)`
            : `Weekly belt hold (${beltHoldLedgerLabel(lockYmd)} PT lock after last PLE this week; week ends ${beltHoldLedgerLabel(weekEndSun)})`;
        for (const pick of teamStints) {
          if (
            !rosterStintActiveForWeeklyBeltHold({
              stint: pick,
              weekEndYmd: lockYmd,
              useBroadcastStart: useBroadcastForMonthlyBelt,
            })
          ) {
            continue;
          }
          const name = wrestlerNameById[pick.wrestler_id];
          const pts = sumMonthlyBeltPointsForStint(beltBySlug, pick.wrestler_id, name, lockYmd);
          if (pts <= 0) continue;
          const wrestlerId = pick.wrestler_id;
          if (!totalsByWrestler[wrestlerId]) totalsByWrestler[wrestlerId] = emptyPoints();
          const beltContrib: TeamWrestlerPoints = { total: pts, rsPoints: 0, plePoints: 0, beltPoints: pts };
          addPoints(totalsByWrestler[wrestlerId]!, beltContrib);
          ledgerRows.push({
            eventId: `weekly-belt-hold-${lockYmd}-${wrestlerId}`,
            eventName,
            eventDate: lockYmd,
            wrestlerId,
            points: pts,
            rsPoints: 0,
            plePoints: 0,
            beltPoints: pts,
            details: [],
          });
          const stintKey = `${pick.wrestler_id}::${pick.acquired_at}::${pick.released_at ?? ""}`;
          if (!stintPoints.has(stintKey)) stintPoints.set(stintKey, emptyPoints());
          addPoints(stintPoints.get(stintKey)!, beltContrib);
        }
      }
    } else {
      const firstM = firstLegacyCalendarMonthEndEligibleForLeagueStart(leagueStart);
      const lastM = beltScoringLastMonthEndInclusive(leagueEndYmd || undefined);
      const monthEnds = getCompletedMonthEndsForBeltScoring(firstM, lastM, Date.now());
      const seasonEndSnapshot = legacySeasonEndBeltSnapshotYmd(leagueEndYmd || undefined);
      if (
        seasonEndSnapshot &&
        seasonEndSnapshot >= firstM &&
        isPastEndOfDayPst(seasonEndSnapshot) &&
        !monthEnds.includes(seasonEndSnapshot)
      ) {
        monthEnds.push(seasonEndSnapshot);
        monthEnds.sort((a, b) => a.localeCompare(b));
      }
      const currentChampionsSnapshotBySlug =
        seasonEndSnapshot && monthEnds.includes(seasonEndSnapshot)
          ? await getCurrentChampionsMonthlyBeltBySlug(supabase)
          : null;
      for (const monthEnd of monthEnds) {
        if (shouldSkipJulyMonthEndBeltForRts2026(monthEnd, leagueEndYmd)) continue;
        const beltBySlug = computeEndOfMonthBeltPointsForSingleMonth(reigns, monthEnd, firstM);
        if (seasonEndSnapshot && monthEnd === seasonEndSnapshot && currentChampionsSnapshotBySlug) {
          for (const [slug, pts] of Object.entries(currentChampionsSnapshotBySlug)) {
            if (!Number.isFinite(pts) || pts <= 0) continue;
            beltBySlug[slug] = Math.max(beltBySlug[slug] ?? 0, pts);
          }
        }
        const eventName = `Title hold (month-end ${beltHoldLedgerLabel(monthEnd)})`;
        for (const pick of teamStints) {
          if (
            !rosterStintActiveForMonthEndBelt({
              stint: pick,
              monthEndYmd: monthEnd,
              useBroadcastStart: useBroadcastForMonthlyBelt,
            })
          ) {
            continue;
          }
          const name = wrestlerNameById[pick.wrestler_id];
          const pts = sumMonthlyBeltPointsForStint(beltBySlug, pick.wrestler_id, name, monthEnd);
          if (pts <= 0) continue;
          const wrestlerId = pick.wrestler_id;
          if (!totalsByWrestler[wrestlerId]) totalsByWrestler[wrestlerId] = emptyPoints();
          const beltContrib: TeamWrestlerPoints = { total: pts, rsPoints: 0, plePoints: 0, beltPoints: pts };
          addPoints(totalsByWrestler[wrestlerId]!, beltContrib);
          ledgerRows.push({
            eventId: `monthly-belt-hold-${monthEnd}-${wrestlerId}`,
            eventName,
            eventDate: monthEnd,
            wrestlerId,
            points: pts,
            rsPoints: 0,
            plePoints: 0,
            beltPoints: pts,
            details: [],
          });
          const stintKey = `${pick.wrestler_id}::${pick.acquired_at}::${pick.released_at ?? ""}`;
          if (!stintPoints.has(stintKey)) stintPoints.set(stintKey, emptyPoints());
          addPoints(stintPoints.get(stintKey)!, beltContrib);
        }
      }
    }
  } catch {
    /* championship_history may be missing */
  }

  const formerStints: FormerTeamStint[] = teamStints
    .filter((s) => s.released_at != null)
    .map((s) => {
      const key = `${s.wrestler_id}::${s.acquired_at}::${s.released_at ?? ""}`;
      return {
        wrestlerId: s.wrestler_id,
        acquiredAt: s.acquired_at,
        releasedAt: s.released_at!,
        points: stintPoints.get(key) ?? emptyPoints(),
      };
    })
    .sort((a, b) => b.releasedAt.localeCompare(a.releasedAt));

  const teamTotal = Object.values(totalsByWrestler).reduce((sum, p) => sum + p.total, 0);

  return {
    ledgerRows: ledgerRows.sort((a, b) => b.eventDate.localeCompare(a.eventDate)),
    totalsByWrestler,
    formerStints,
    activeStints,
    teamTotal,
  };
}
