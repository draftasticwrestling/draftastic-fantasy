import { getMonthlyBeltForWrestler } from "./endOfMonthBeltPoints.js";
import { scoringSlugCandidatesForWrestler, wrestlerMatchesBeltMapKey } from "./beltSlugMatch.js";

/** Whether a roster stint should receive points stored under contribSlug for this event date. */
export function rosterStintMatchesContribSlug(
  wrestlerId: string,
  displayName: string | undefined,
  contribSlug: string,
  eventDate: string
): boolean {
  return wrestlerMatchesBeltMapKey(wrestlerId, displayName, contribSlug, eventDate);
}

/**
 * Sum end-of-month title-holder points from a slug map for one roster row (persona / display name / id aliases).
 */
export function sumMonthlyBeltPointsForStint(
  beltBySlug: Record<string, number>,
  wrestlerId: string,
  displayName: string | undefined,
  monthEndYmd: string
): number {
  return getMonthlyBeltForWrestler(beltBySlug, wrestlerId, displayName, monthEndYmd);
}

/**
 * Points from a single event's pointsBySlug map for one roster row (handles personas / display names).
 */
export function eventPointsForRosterStint(
  eventPoints: Record<string, number>,
  wrestlerId: string,
  displayName: string | undefined,
  eventDate: string
): number {
  for (const k of scoringSlugCandidatesForWrestler(wrestlerId, displayName, eventDate)) {
    const v = eventPoints[k];
    if (v != null && v > 0) return v;
  }
  return 0;
}
