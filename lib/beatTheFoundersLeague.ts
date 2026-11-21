import { leagueIsSalaryCapHeadToHead } from "@/lib/leagueStructure";
import { FOUNDERS_LEAGUE_SLUG } from "@/lib/salaryCapWeeklyLimits";

/** Managers who run founder teams. They do not play each other until the playoffs. */
export const BEAT_THE_FOUNDERS_MANAGER_IDS = [
  "e0efc9d7-4cb7-4226-aac9-6d21a222bc02", // KM Punk
  "a7d23655-163c-4726-9435-fee99693d51f", // Kayfabe King
  "427d44a2-018c-469d-977d-df63bdaf9b99", // Dillster
] as const;

export const BEAT_THE_FOUNDERS_PLAYOFF_TEAMS = 8;

/**
 * Won a public league before the deadline, but cannot enter.
 * B-Dawg Steven is a family member of a founder.
 */
export const BEAT_THE_FOUNDERS_DISQUALIFIED_USER_IDS = [
  "9ab535e2-3ff6-4120-a1d1-ecfcd75ef618",
] as const;

export const BEAT_THE_FOUNDERS_INELIGIBLE_MESSAGE =
  "This account isn't eligible to join Beat the Founders.";

/** Last Pacific civil day the login invite popup is shown. Inclusive. */
export const BEAT_THE_FOUNDERS_INVITE_NOTICE_THROUGH = "2026-11-30";

const FOUNDER_ID_SET = new Set<string>(BEAT_THE_FOUNDERS_MANAGER_IDS);
const DISQUALIFIED_ID_SET = new Set<string>(BEAT_THE_FOUNDERS_DISQUALIFIED_USER_IDS);

export function isBeatTheFoundersLeagueSlug(slug: string | null | undefined): boolean {
  return String(slug ?? "").trim() === FOUNDERS_LEAGUE_SLUG;
}

export function isBeatTheFoundersManager(userId: string | null | undefined): boolean {
  return FOUNDER_ID_SET.has(String(userId ?? ""));
}

export function isBeatTheFoundersDisqualified(userId: string | null | undefined): boolean {
  return DISQUALIFIED_ID_SET.has(String(userId ?? ""));
}

/** Public salary-cap head-to-head breaks a tied week with season points. This contest records the tie. */
export function salaryCapHeadToHeadBreaksTiesWithSeasonPoints(
  leagueType: string | null | undefined,
  leagueSlug: string | null | undefined
): boolean {
  if (isBeatTheFoundersLeagueSlug(leagueSlug)) return false;
  return leagueIsSalaryCapHeadToHead(leagueType);
}
