import { normalizeWrestlerName } from "./parsers/participantParser.js";
import { resolvePersonaToCanonical } from "./personaResolution.js";

/**
 * Decide if a roster stint receives fantasy points for an event.
 *
 * When `events.broadcast_start_ts` exists we compare the event's **calendar date** to
 * `acquired_at` / `released_at` only (YYYY-MM-DD). That matches the product rule:
 * "you get points for a show if you had the wrestler on that **show date**" and avoids a
 * bug where RAW 8pm ET (often 00:00+ UTC the next calendar day) is compared to
 * `released_at` end-of-day UTC, which wrongly excludes drops dated the day *after* the show.
 *
 * When broadcast start is absent, we keep legacy behavior: compare `eventMs` (end of event
 * date UTC) to shifted day boundaries for acquisition/release.
 */

export type RosterStintWindowInput = {
  acquired_at: string;
  released_at: string | null;
  acquired_at_ts?: string | null;
  released_at_ts?: string | null;
};

function ymdFromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function shiftYmd(ymd: string, days: number): string {
  if (!ymd) return ymd;
  const d = new Date(ymd + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return ymd;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Plain date: event counts if acquired on or before event day and not released before event day. */
export function stintCoversEventCalendarDate(
  eventDate: string,
  stint: RosterStintWindowInput
): boolean {
  const acq = String(stint.acquired_at ?? "").slice(0, 10);
  const rel = stint.released_at ? String(stint.released_at).slice(0, 10) : null;
  if (!acq || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return false;
  if (eventDate < acq) return false;
  if (rel != null && eventDate > rel) return false;
  return true;
}

/**
 * @param eventMs - for legacy mode: end-of-event-day UTC; for broadcast mode ignored when useBroadcastStart + broadcastStartMs
 * @param broadcastStartMs - when set with useBroadcastStart, compares roster acquired_at_ts / released_at_ts to show start so same-day drops/trades before airtime don't score for the wrong team
 * @param rosterStintDateOffsetDays - typically -1 for legacy UTC drift fix
 */
export function rosterStintActiveForEvent(params: {
  eventDate: string;
  eventMs: number;
  broadcastStartMs?: number;
  useBroadcastStart: boolean;
  stint: RosterStintWindowInput;
  rosterStintDateOffsetDays: number;
}): boolean {
  const { eventDate, eventMs, useBroadcastStart, stint, rosterStintDateOffsetDays, broadcastStartMs } = params;

  if (useBroadcastStart) {
    if (!stintCoversEventCalendarDate(eventDate, stint)) return false;
    if (broadcastStartMs != null && Number.isFinite(broadcastStartMs)) {
      const off = rosterStintDateOffsetDays;
      const expectedAcqYmd = shiftYmd(String(stint.acquired_at ?? "").slice(0, 10), off);
      let acqMs = Date.parse(`${expectedAcqYmd}T00:00:00.000Z`);
      if (stint.acquired_at_ts) {
        const tsMs = Date.parse(String(stint.acquired_at_ts));
        if (Number.isFinite(tsMs) && ymdFromMs(tsMs) === expectedAcqYmd) acqMs = tsMs;
      }
      let relMs: number | null = null;
      if (stint.released_at != null) {
        const expectedRelYmd = shiftYmd(String(stint.released_at).slice(0, 10), off);
        relMs = Date.parse(`${expectedRelYmd}T23:59:59.999Z`);
        if (stint.released_at_ts != null) {
          const tsMs = Date.parse(String(stint.released_at_ts));
          if (Number.isFinite(tsMs) && ymdFromMs(tsMs) === expectedRelYmd) relMs = tsMs;
        }
      }
      if (!Number.isFinite(acqMs)) return true;
      if (acqMs > broadcastStartMs) return false;
      if (relMs != null && Number.isFinite(relMs) && relMs <= broadcastStartMs) return false;
      return true;
    }
    return true;
  }

  const off = rosterStintDateOffsetDays;
  function effectiveAcquiredMs(): number {
    const expectedYmd = shiftYmd(String(stint.acquired_at ?? "").slice(0, 10), off);
    if (stint.acquired_at_ts) {
      const tsMs = Date.parse(String(stint.acquired_at_ts));
      if (Number.isFinite(tsMs) && ymdFromMs(tsMs) === expectedYmd) return tsMs;
    }
    return Date.parse(`${expectedYmd}T00:00:00.000Z`);
  }
  function effectiveReleasedMs(): number | null {
    if (stint.released_at == null) return null;
    const expectedYmd = shiftYmd(String(stint.released_at).slice(0, 10), off);
    if (stint.released_at_ts != null) {
      const tsMs = Date.parse(String(stint.released_at_ts));
      if (Number.isFinite(tsMs) && ymdFromMs(tsMs) === expectedYmd) return tsMs;
    }
    return Date.parse(`${expectedYmd}T23:59:59.999Z`);
  }

  const acquiredMs = effectiveAcquiredMs();
  const releasedMs = effectiveReleasedMs();
  if (!Number.isFinite(acquiredMs) || eventMs < acquiredMs) return false;
  if (releasedMs != null && Number.isFinite(releasedMs) && eventMs > releasedMs) return false;
  return true;
}

/** For tie-breaking: lower = earlier acquisition (prefer original team on ambiguous data). */
export function rosterStintSortKeyForTieBreak(
  stint: RosterStintWindowInput,
  rosterStintDateOffsetDays: number
): { acquiredMs: number; releasedMs: number } {
  const off = rosterStintDateOffsetDays;
  const expectedAcq = shiftYmd(String(stint.acquired_at ?? "").slice(0, 10), off);
  let acquiredMs = Date.parse(`${expectedAcq}T00:00:00.000Z`);
  if (stint.acquired_at_ts) {
    const tsMs = Date.parse(String(stint.acquired_at_ts));
    if (Number.isFinite(tsMs) && ymdFromMs(tsMs) === expectedAcq) acquiredMs = tsMs;
  }
  let releasedMs = Number.POSITIVE_INFINITY;
  if (stint.released_at != null) {
    const expectedRel = shiftYmd(String(stint.released_at).slice(0, 10), off);
    releasedMs = Date.parse(`${expectedRel}T23:59:59.999Z`);
    if (stint.released_at_ts != null) {
      const tsMs = Date.parse(String(stint.released_at_ts));
      if (Number.isFinite(tsMs) && ymdFromMs(tsMs) === expectedRel) releasedMs = tsMs;
    }
  }
  return { acquiredMs, releasedMs };
}

export type StintWithUser = RosterStintWindowInput & { user_id: string; wrestler_id: string };

/**
 * When the same event points are keyed under a canonical slug (e.g. chad-gable) but multiple
 * roster rows match (e.g. original-el-grande-americano → chad-gable), prefer the **persona /
 * alias roster id** over the plain canonical id so the team that drafted "Original El Grande
 * Americano" is not beaten by another team that drafted "Chad Gable" for the same points bucket.
 * Lower rank wins.
 */
function personaAliasTieRank(stint: StintWithUser, contribSlug: string, eventDate: string): number {
  const wid = normalizeWrestlerName(String(stint.wrestler_id || ""));
  if (!wid) return 2;
  const resolved = resolvePersonaToCanonical(wid, eventDate) ?? wid;
  if (resolved !== contribSlug) return 99;
  if (wid === contribSlug) return 1;
  return 0;
}

/**
 * When two stints could both score the same wrestler for one event, pick one deterministically.
 * If contribSlug + eventDate are passed (team scoreboard / slug-level attribution), persona rows
 * beat canonical ids when both map to the same scoring slug.
 * Broadcast mode: earliest acquired_at wins (team that had them first on the calendar).
 * Legacy: earlier effective release wins; if tie, earlier acquisition wins.
 */
export function compareStintsForEventTieBreak(
  a: StintWithUser,
  b: StintWithUser,
  useBroadcastStart: boolean,
  rosterStintDateOffsetDays: number,
  contribSlug?: string,
  eventDate?: string
): number {
  if (contribSlug && eventDate) {
    const ra = personaAliasTieRank(a, contribSlug, eventDate);
    const rb = personaAliasTieRank(b, contribSlug, eventDate);
    if (ra !== rb) return ra - rb;
  }
  if (useBroadcastStart) {
    const acqCmp = String(a.acquired_at).slice(0, 10).localeCompare(String(b.acquired_at).slice(0, 10));
    if (acqCmp !== 0) return acqCmp;
    return a.user_id.localeCompare(b.user_id);
  }
  const ka = rosterStintSortKeyForTieBreak(a, rosterStintDateOffsetDays);
  const kb = rosterStintSortKeyForTieBreak(b, rosterStintDateOffsetDays);
  if (ka.releasedMs !== kb.releasedMs) return ka.releasedMs - kb.releasedMs;
  return ka.acquiredMs - kb.acquiredMs;
}
