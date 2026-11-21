import "server-only";

import {
  isBeatTheFoundersDisqualified,
  isBeatTheFoundersManager,
} from "@/lib/beatTheFoundersLeague";
import { getAdminClient } from "@/lib/supabase/admin";

/** Contest rules: a public-league win on or before this date earns an invitation. */
export const BEAT_THE_FOUNDERS_QUALIFICATION_DEADLINE = "2026-11-15";

export type BeatTheFoundersQualifierWin = {
  leagueName: string;
  leagueSlug: string;
  leagueType: string;
  endDate: string;
  points: number;
};

export type BeatTheFoundersQualifier = {
  userId: string;
  displayName: string;
  alreadyMember: boolean;
  /** Won a public league, but a contest rule bars this account from entering. */
  disqualified: boolean;
  /** Won a rolling Public League (salary cap), not only a Road to SummerSlam public league. */
  wonPublicSalaryCapLeague: boolean;
  wins: BeatTheFoundersQualifierWin[];
};

/**
 * Champions of every public league whose season ended on or before the qualification deadline.
 * One row per manager. Does not decide which of those wins were "designated" — the admin chooses
 * who to email.
 */
export async function listBeatTheFoundersQualifiers(
  foundersLeagueId: string
): Promise<BeatTheFoundersQualifier[]> {
  const admin = getAdminClient();
  if (!admin) return [];

  const { data: leagues, error: leagueError } = await admin
    .from("leagues")
    .select("id, name, slug, league_type, end_date")
    .eq("visibility_type", "public")
    .lte("end_date", BEAT_THE_FOUNDERS_QUALIFICATION_DEADLINE);
  if (leagueError) throw new Error(leagueError.message);

  const leagueRows = leagues ?? [];
  if (leagueRows.length === 0) return [];

  const leagueById = new Map(leagueRows.map((row) => [row.id as string, row]));
  const leagueIds = [...leagueById.keys()];

  const [{ data: placements, error: placementError }, { data: members, error: memberError }] =
    await Promise.all([
      admin
        .from("league_season_placements")
        .select("league_id, user_id, points")
        .in("league_id", leagueIds)
        .eq("placement", 1),
      admin.from("league_members").select("user_id").eq("league_id", foundersLeagueId),
    ]);
  if (placementError) throw new Error(placementError.message);
  if (memberError) throw new Error(memberError.message);

  const memberIds = new Set((members ?? []).map((row) => row.user_id as string));
  const userIds = [...new Set((placements ?? []).map((row) => row.user_id as string))];
  const nameById = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles, error: profileError } = await admin
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds);
    if (profileError) throw new Error(profileError.message);
    for (const profile of profiles ?? []) {
      const name = String(profile.display_name ?? "").trim();
      if (name) nameById.set(profile.id as string, name);
    }
  }

  const byUser = new Map<string, BeatTheFoundersQualifier>();
  for (const placement of placements ?? []) {
    const league = leagueById.get(placement.league_id as string);
    if (!league) continue;
    const userId = placement.user_id as string;
    const leagueType = String(league.league_type ?? "");
    const win: BeatTheFoundersQualifierWin = {
      leagueName: String(league.name ?? league.slug ?? "Public league"),
      leagueSlug: String(league.slug ?? ""),
      leagueType,
      endDate: String(league.end_date ?? ""),
      points: Number(placement.points ?? 0),
    };
    const existing = byUser.get(userId);
    if (existing) {
      existing.wins.push(win);
      if (leagueType === "salary_cap") existing.wonPublicSalaryCapLeague = true;
      continue;
    }
    byUser.set(userId, {
      userId,
      displayName: nameById.get(userId) ?? "Manager",
      alreadyMember: memberIds.has(userId),
      disqualified: isBeatTheFoundersDisqualified(userId),
      wonPublicSalaryCapLeague: leagueType === "salary_cap",
      wins: [win],
    });
  }

  return [...byUser.values()]
    .map((row) => ({
      ...row,
      wins: [...row.wins].sort((a, b) => a.endDate.localeCompare(b.endDate) || a.leagueName.localeCompare(b.leagueName)),
    }))
    .sort((a, b) => {
      if (a.wonPublicSalaryCapLeague !== b.wonPublicSalaryCapLeague) {
        return a.wonPublicSalaryCapLeague ? -1 : 1;
      }
      if (a.disqualified !== b.disqualified) return a.disqualified ? 1 : -1;
      if (a.alreadyMember !== b.alreadyMember) return a.alreadyMember ? 1 : -1;
      return a.displayName.localeCompare(b.displayName);
    });
}

/** Founders, or a public-league champion by the deadline who is not disqualified. */
export async function canUserJoinBeatTheFounders(userId: string): Promise<boolean> {
  if (isBeatTheFoundersDisqualified(userId)) return false;
  if (isBeatTheFoundersManager(userId)) return true;

  const admin = getAdminClient();
  if (!admin) return false;

  const { data: leagues, error: leagueError } = await admin
    .from("leagues")
    .select("id")
    .eq("visibility_type", "public")
    .lte("end_date", BEAT_THE_FOUNDERS_QUALIFICATION_DEADLINE);
  if (leagueError || !leagues?.length) return false;

  const { data: wins, error: winError } = await admin
    .from("league_season_placements")
    .select("league_id")
    .eq("user_id", userId)
    .eq("placement", 1)
    .in(
      "league_id",
      leagues.map((league) => league.id as string)
    )
    .limit(1);
  if (winError) return false;
  return (wins?.length ?? 0) > 0;
}
