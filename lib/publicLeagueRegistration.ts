import { addWeeks, setHours, setMinutes, setSeconds, startOfWeek } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { MIN_LEAGUE_TEAMS } from "@/lib/leagueStructure";
import { BELT_HOLD_TIMEZONE, getCivilYmdInPst } from "@/lib/pstCivilTime";
import { PUBLIC_SALARY_CAP_SEASON_WEEKS, addDaysToYmd } from "@/lib/publicLeagueSchedule";

/** Public leagues need at least three factions before scoring begins. */
export const PUBLIC_LEAGUE_MIN_TEAMS = MIN_LEAGUE_TEAMS;

/** RAW typically starts at 5:00 PM Pacific on Mondays. */
export const PUBLIC_LEAGUE_RAW_START_HOUR_PT = 17;

export type PublicLeagueRegistrationSchedule = {
  /** ISO timestamp when enrollment closes (Monday 5 PM PT). */
  registration_closes_at: string;
  /** First scoring Monday (YYYY-MM-DD, Pacific calendar). */
  season_start_ymd: string;
  /** Last day of week 12 (Sunday YYYY-MM-DD). */
  season_end_ymd: string;
};

/** Next Monday 5:00 PM PT on or after `fromMs`. Season starts that instant. */
export function computePublicLeagueRegistrationSchedule(
  fromMs: number = Date.now()
): PublicLeagueRegistrationSchedule {
  const laNow = toZonedTime(new Date(fromMs), BELT_HOLD_TIMEZONE);
  let mondayLa = startOfWeek(laNow, { weekStartsOn: 1 });
  let closeLa = setSeconds(setMinutes(setHours(mondayLa, PUBLIC_LEAGUE_RAW_START_HOUR_PT), 0), 0);

  if (laNow >= closeLa) {
    mondayLa = addWeeks(mondayLa, 1);
    closeLa = setSeconds(setMinutes(setHours(mondayLa, PUBLIC_LEAGUE_RAW_START_HOUR_PT), 0), 0);
  }

  const closesAtUtc = fromZonedTime(closeLa, BELT_HOLD_TIMEZONE);
  const season_start_ymd = getCivilYmdInPst(fromZonedTime(mondayLa, BELT_HOLD_TIMEZONE).getTime());
  const season_end_ymd = addDaysToYmd(season_start_ymd, PUBLIC_SALARY_CAP_SEASON_WEEKS * 7 - 1);

  return {
    registration_closes_at: closesAtUtc.toISOString(),
    season_start_ymd,
    season_end_ymd,
  };
}

/** Push enrollment + season dates forward one week when fewer than 3 teams at RAW close. */
export function extendPublicLeagueRegistrationOneWeek(
  currentClosesAtIso: string
): PublicLeagueRegistrationSchedule {
  const closeMs = Date.parse(currentClosesAtIso);
  if (!Number.isFinite(closeMs)) {
    return computePublicLeagueRegistrationSchedule();
  }
  const nextCloseUtc = addWeeks(new Date(closeMs), 1);
  const season_start_ymd = getCivilYmdInPst(nextCloseUtc.getTime());
  const season_end_ymd = addDaysToYmd(season_start_ymd, PUBLIC_SALARY_CAP_SEASON_WEEKS * 7 - 1);
  return {
    registration_closes_at: nextCloseUtc.toISOString(),
    season_start_ymd,
    season_end_ymd,
  };
}

export function publicLeagueStatusForMemberCount(memberCount: number): "open" | "awaiting_minimum" {
  return memberCount >= PUBLIC_LEAGUE_MIN_TEAMS ? "open" : memberCount > 0 ? "awaiting_minimum" : "open";
}

export function isPublicLeagueRegistrationOpen(
  league: {
    visibility_type?: string | null;
    public_status?: string | null;
    registration_closes_at?: string | null;
  },
  nowMs: number = Date.now()
): boolean {
  if (String(league.visibility_type ?? "").toLowerCase() !== "public") return false;
  const status = String(league.public_status ?? "").toLowerCase();
  if (status === "active" || status === "full") return false;
  const closesAt = league.registration_closes_at;
  if (closesAt) {
    const closeMs = Date.parse(closesAt);
    if (Number.isFinite(closeMs) && nowMs >= closeMs) return false;
  }
  return true;
}

export function formatPublicLeagueRegistrationClosePt(isoTs: string): string {
  const d = new Date(isoTs);
  if (Number.isNaN(d.getTime())) return "Monday 5:00 PM PT";
  return (
    new Intl.DateTimeFormat("en-US", {
      timeZone: BELT_HOLD_TIMEZONE,
      weekday: "long",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d) + " PT"
  );
}
