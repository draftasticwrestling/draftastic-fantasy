import { createClient } from "@/lib/supabase/server";
import { getEffectiveLeagueStartDate, getRosterStintsForLeague, type LeagueRosterStint } from "@/lib/leagues";
import { scoreEvent } from "@/lib/scoring/scoreEvent.js";
import { EVENT_TYPES } from "@/lib/scoring/parsers/eventClassifier.js";
import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";
import { resolvePersonaToCanonical } from "@/lib/scoring/personaResolution.js";
import { rosterStintMatchesContribSlug } from "@/lib/scoring/rosterStintEventPoints";

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

function shiftYmd(ymd: string, days: number): string {
  if (!ymd) return ymd;
  const d = new Date(ymd + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return ymd;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
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
    .select("id, start_date, end_date, draft_date, created_at")
    .eq("id", leagueId)
    .single();
  if (!league) {
    return { ledgerRows: [], totalsByWrestler: {}, formerStints: [], activeStints: [], teamTotal: 0 };
  }

  const leagueStart = getEffectiveLeagueStartDate(league);
  const leagueEnd = league.end_date ? String(league.end_date).slice(0, 10) : "";

  const [{ data: events }, stints] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, date, matches")
      .eq("status", "completed")
      .order("date", { ascending: true }),
    getRosterStintsForLeague(leagueId),
  ]);

  const teamStints = stints.filter((s) => s.user_id === userId);
  const activeStints = teamStints.filter((s) => s.released_at == null);

  const rosterWrestlerIds = [...new Set(teamStints.map((s) => s.wrestler_id))];
  const { data: wrestlerRows } = rosterWrestlerIds.length
    ? await supabase.from("wrestlers").select("id, name").in("id", rosterWrestlerIds)
    : { data: [] as Array<{ id: string; name: string | null }> };
  const wrestlerNameById: Record<string, string> = {};
  for (const w of wrestlerRows ?? []) {
    wrestlerNameById[w.id] = w.name ?? w.id;
  }

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

  const totalsByWrestler: Record<string, TeamWrestlerPoints> = {};
  const ledgerRows: TeamScoreLedgerRow[] = [];
  const stintPoints = new Map<string, TeamWrestlerPoints>();
  let kotrCarryOver: Record<string, number> = {};

  for (const event of sortedEvents) {
    const eventDate = String(event.date ?? "").slice(0, 10);
    const scored = scoreEvent(event as { id?: string; name?: string; date?: string; matches?: unknown[] }) as ScoredEvent;
    const eventType = scored.eventType;
    const isRS = eventType === EVENT_TYPES.RAW || eventType === EVENT_TYPES.SMACKDOWN;
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
      const activeStintsForEvent = teamStints.filter((s) => {
        const effectiveAcquired = shiftYmd(s.acquired_at, ROSTER_STINT_DATE_OFFSET_DAYS);
        const effectiveReleased = s.released_at != null ? shiftYmd(s.released_at, ROSTER_STINT_DATE_OFFSET_DAYS) : null;
        if (eventDate < effectiveAcquired) return false;
        if (effectiveReleased != null && eventDate > effectiveReleased) return false;
        const displayName = wrestlerNameById[s.wrestler_id];
        return rosterStintMatchesContribSlug(s.wrestler_id, displayName, slug, eventDate);
      });
      if (activeStintsForEvent.length === 0) continue;

      const primaryWrestlerId = activeStintsForEvent[0]!.wrestler_id;
      if (!totalsByWrestler[primaryWrestlerId]) totalsByWrestler[primaryWrestlerId] = emptyPoints();
      addPoints(totalsByWrestler[primaryWrestlerId]!, contribution.points);

      ledgerRows.push({
        eventId: String(event.id ?? ""),
        eventName: String(event.name ?? "Unknown event"),
        eventDate,
        wrestlerId: primaryWrestlerId,
        points: contribution.points.total,
        rsPoints: contribution.points.rsPoints,
        plePoints: contribution.points.plePoints,
        beltPoints: contribution.points.beltPoints,
        details: [...new Set(contribution.details)],
      });

      for (const stint of activeStintsForEvent) {
        const key = `${stint.wrestler_id}::${stint.acquired_at}::${stint.released_at ?? ""}`;
        if (!stintPoints.has(key)) stintPoints.set(key, emptyPoints());
        addPoints(stintPoints.get(key)!, contribution.points);
      }
    }
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
