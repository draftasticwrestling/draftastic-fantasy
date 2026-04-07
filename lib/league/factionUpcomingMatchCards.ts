import { getSortedMatchesForEvent } from "@/components/boxscore-port/utils/eventMatchesOrder.js";
import { eventResultsHref } from "@/lib/event-results/eventResultsRoute";
import { extractMatchParticipants, normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";
import { scoreEvent } from "@/lib/scoring/scoreEvent.js";
import type { ScoredEvent, ScoredMatch } from "@/lib/scoring/types";

import type { LeagueEventDayRow } from "@/lib/league/eventDayRosterMatches";

export type FactionUpcomingRosterCard = {
  key: string;
  eventId: string;
  /** Index into sorted matches (same order as {@link scoreEvent} on sorted matches). */
  matchIndex: number;
  wrestlerId: string;
  wrestlerName: string;
  imageUrl: string | null;
  /** YYYY-MM-DD for sorting */
  eventDateYmd: string | null;
  eventDateLabel: string;
  eventName: string;
  eventHref: string;
  isChampionship: boolean;
  isSpecialStipulation: boolean;
  matchLabel: string;
  /**
   * Fantasy points for this wrestler in this match when the event is live or completed.
   * `undefined` = event still upcoming (hide score).
   * `null` = scored row exists but no points yet (e.g. match not finished on a live show).
   */
  matchPoints?: number | null;
};

const SPECIAL_MATCH_TYPE_RE =
  /ladder|cage|hell\s+in\s+a\s+cell|street\s+fight|elimination|war\s+games|last\s+man|i\s+quit|ambulance|inferno|boneyard|submissions?\s+only|no\s+disqualification|falls?\s+count\s+anywhere/i;

function isMatchPromo(raw: Record<string, unknown>): boolean {
  const mt = String(raw.matchType || "").toLowerCase();
  const st = String(raw.stipulation || "").toLowerCase();
  return mt === "promo" || st === "promo";
}

function matchLabelShort(raw: Record<string, unknown>): string {
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (title && title.toLowerCase() !== "none") return title;
  const mt = String(raw.matchType || "").trim();
  return mt || "Match";
}

function isChampionshipMatch(raw: Record<string, unknown>): boolean {
  const title = String(raw.title ?? "").trim();
  if (title && title.toLowerCase() !== "none") return true;
  const to = String(raw.titleOutcome ?? raw.title_outcome ?? "").trim();
  if (to) return true;
  const mt = String(raw.matchType ?? "").toLowerCase();
  if (mt.includes("championship")) return true;
  const st = String(raw.stipulation ?? "").toLowerCase();
  if (st.includes("championship") || st.includes("title match")) return true;
  return false;
}

function isSpecialStipulationMatch(raw: Record<string, unknown>): boolean {
  const mt = String(raw.matchType ?? "");
  if (SPECIAL_MATCH_TYPE_RE.test(mt)) return true;
  const st = String(raw.stipulation ?? "").trim();
  if (!st || st.toLowerCase() === "none") return false;
  return true;
}

function formatEventDateBar(dateStr: string | null): string {
  if (!dateStr) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split("-");
    const month = new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-US", { month: "short" });
    return `${month} ${Number(d)}, ${y}`;
  }
  return dateStr;
}

/**
 * One small card per roster wrestler per match (upcoming-style events only in the caller’s list).
 */
export function buildFactionUpcomingRosterCards(
  event: LeagueEventDayRow,
  rosterWrestlerIds: string[],
  wrestlerNameById: Record<string, string>,
  wrestlerImageById: Record<string, string | null | undefined>
): FactionUpcomingRosterCard[] {
  const rosterIdSet = new Set(rosterWrestlerIds.map((id) => String(id).trim()).filter(Boolean));
  const normToId = new Map<string, string>();
  for (const id of rosterIdSet) {
    const name = wrestlerNameById[id];
    if (!name) continue;
    const k = normalizeWrestlerName(name);
    if (k) normToId.set(k, id);
  }

  const out: FactionUpcomingRosterCard[] = [];
  const sorted = getSortedMatchesForEvent(event);
  const eventHref = eventResultsHref(event);
  const eventDateYmd = event.date ? String(event.date).trim().slice(0, 10) : null;
  const eventDateLabel = formatEventDateBar(event.date);
  const eventName = (event.name ?? "Event").trim() || "Event";

  for (let i = 0; i < sorted.length; i++) {
    const raw = sorted[i] as Record<string, unknown>;
    if (isMatchPromo(raw)) continue;
    let participantsForScoring: string[] = [];
    try {
      const md = extractMatchParticipants(raw as never);
      participantsForScoring = md.participantsForScoring ?? [];
    } catch {
      continue;
    }
    const order = Number((raw.order as number) ?? i + 1);
    const seenWrestler = new Set<string>();
    for (const p of participantsForScoring) {
      const pk = normalizeWrestlerName(String(p));
      const wid = pk ? normToId.get(pk) : undefined;
      if (!wid || seenWrestler.has(wid)) continue;
      seenWrestler.add(wid);
      const name = (wrestlerNameById[wid] ?? String(p)).trim();
      out.push({
        key: `${event.id}-${order}-${wid}`,
        eventId: event.id,
        matchIndex: i,
        wrestlerId: wid,
        wrestlerName: name,
        imageUrl: wrestlerImageById[wid] ?? null,
        eventDateYmd,
        eventDateLabel,
        eventName,
        eventHref,
        isChampionship: isChampionshipMatch(raw),
        isSpecialStipulation: isSpecialStipulationMatch(raw),
        matchLabel: matchLabelShort(raw),
      });
    }
  }
  return out;
}

function pointsForWrestlerInScoredMatch(
  sm: ScoredMatch | undefined,
  wrestlerDisplayName: string
): number | null {
  if (!sm || sm.isPromo) return null;
  const wps = sm.wrestlerPoints ?? [];
  if (wps.length === 0) return null;
  const target = normalizeWrestlerName(wrestlerDisplayName);
  const row = wps.find((wp) => normalizeWrestlerName(String(wp.wrestler ?? "")) === target);
  if (!row) return null;
  const n = Number(row.total ?? 0);
  return Number.isNaN(n) ? null : n;
}

/**
 * Fills {@link FactionUpcomingRosterCard.matchPoints} for live/completed events using {@link scoreEvent}
 * on the same sorted match list as card generation.
 */
export function enrichFactionCardsWithLiveScores(
  eventById: Map<string, LeagueEventDayRow>,
  cards: FactionUpcomingRosterCard[]
): FactionUpcomingRosterCard[] {
  const scoredByEventId = new Map<string, ScoredEvent>();
  return cards.map((card) => {
    const ev = eventById.get(card.eventId);
    if (!ev) return card;
    const st = String(ev.status ?? "").toLowerCase().trim();
    if (st !== "live" && st !== "completed") {
      return { ...card };
    }

    let scored = scoredByEventId.get(card.eventId);
    if (!scored) {
      const sortedMatches = getSortedMatchesForEvent(ev);
      scored = scoreEvent({ ...ev, matches: sortedMatches }) as ScoredEvent;
      scoredByEventId.set(card.eventId, scored);
    }

    const sm = scored.matches[card.matchIndex] as ScoredMatch | undefined;
    const pts = pointsForWrestlerInScoredMatch(sm, card.wrestlerName);
    return { ...card, matchPoints: pts };
  });
}
