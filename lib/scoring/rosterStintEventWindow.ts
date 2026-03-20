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
 * @param eventMs - for legacy mode: end-of-event-day UTC; for broadcast mode: broadcast start instant (unused when useBroadcastStart)
 * @param rosterStintDateOffsetDays - typically -1 for legacy UTC drift fix
 */
export function rosterStintActiveForEvent(params: {
  eventDate: string;
  eventMs: number;
  useBroadcastStart: boolean;
  stint: RosterStintWindowInput;
  rosterStintDateOffsetDays: number;
}): boolean {
  const { eventDate, eventMs, useBroadcastStart, stint, rosterStintDateOffsetDays } = params;

  if (useBroadcastStart) {
    return stintCoversEventCalendarDate(eventDate, stint);
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

export type StintWithUser = RosterStintWindowInput & { user_id: string };

/**
 * When two stints could both score the same wrestler for one event, pick one deterministically.
 * Broadcast mode: earliest acquired_at wins (team that had them first on the calendar).
 * Legacy: earlier effective release wins; if tie, earlier acquisition wins.
 */
export function compareStintsForEventTieBreak(
  a: StintWithUser,
  b: StintWithUser,
  useBroadcastStart: boolean,
  rosterStintDateOffsetDays: number
): number {
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
