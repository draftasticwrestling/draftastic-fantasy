import type { SupabaseClient } from "@supabase/supabase-js";
import { leagueUsesSalaryCap, isRoadToWarGamesSeasonSlug } from "@/lib/leagueStructure";
import { getDraftPreferences } from "@/lib/leagueDraft";

export type LeagueOnboardingContext = {
  season_slug?: string | null;
  league_type?: string | null;
  slug: string;
};

/** Salary cap (admin testing now) and Road to War Games leagues use per-league onboarding. */
export function leagueUsesMemberOnboarding(league: {
  season_slug?: string | null;
  league_type?: string | null;
}): boolean {
  if (leagueUsesSalaryCap(league.league_type)) return true;
  if (isRoadToWarGamesSeasonSlug(league.season_slug)) return true;
  return false;
}

export function leagueOnboardingPath(slug: string): string {
  return `/leagues/${slug}/onboarding`;
}

/** Where to send a member right after create/join when onboarding is not required. */
export function leaguePostJoinPath(
  slug: string,
  league: { league_type?: string | null; season_slug?: string | null }
): string {
  if (leagueUsesMemberOnboarding(league)) return leagueOnboardingPath(slug);
  if (leagueUsesSalaryCap(league.league_type)) return `/leagues/${slug}/salary-cap`;
  return `/leagues/${slug}`;
}

export function leagueDestinationAfterOnboarding(
  league: {
    slug: string;
    league_type?: string | null;
    commissioner_id?: string | null;
  },
  userId: string,
  opts?: { showInviteModal?: boolean }
): string {
  const base = leagueUsesSalaryCap(league.league_type)
    ? `/leagues/${league.slug}/salary-cap`
    : `/leagues/${league.slug}`;
  if (opts?.showInviteModal && league.commissioner_id === userId) {
    return `${base}${base.includes("?") ? "&" : "?"}invite=1`;
  }
  return base;
}

export async function hasSavedDraftPreferences(leagueId: string, userId: string): Promise<boolean> {
  const prefs = await getDraftPreferences(leagueId, userId);
  return prefs != null;
}

export type LeagueMemberOnboardingRow = {
  team_name?: string | null;
  manager_avatar_url?: string | null;
  manager_catchphrase?: string | null;
  onboarding_completed_at?: string | null;
  role?: string;
};

/** True when this member should complete the league onboarding wizard. */
export async function resolveMemberOnboardingState(
  supabase: SupabaseClient,
  leagueId: string,
  league: LeagueOnboardingContext,
  userId: string
): Promise<{ needsOnboarding: boolean; member: LeagueMemberOnboardingRow | null }> {
  const { data: row, error } = await supabase
    .from("league_members")
    .select("team_name, manager_avatar_url, manager_catchphrase, onboarding_completed_at, role")
    .eq("league_id", leagueId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !row) {
    return { needsOnboarding: false, member: null };
  }

  const member = row as LeagueMemberOnboardingRow;

  if (member.onboarding_completed_at) {
    return { needsOnboarding: false, member };
  }

  if (!leagueUsesMemberOnboarding(league)) {
    return { needsOnboarding: false, member };
  }

  const teamName = member.team_name?.trim() ?? "";
  if (teamName && leagueUsesSalaryCap(league.league_type)) {
    return { needsOnboarding: false, member };
  }
  if (teamName && !leagueUsesSalaryCap(league.league_type)) {
    const hasPrefs = await hasSavedDraftPreferences(leagueId, userId);
    if (hasPrefs) return { needsOnboarding: false, member };
  }

  return { needsOnboarding: true, member };
}

/** Per-member salary cap roster setup complete (clicked "Complete setup"). */
export async function getSalaryCapRosterSetupCompleteByUserId(
  supabase: SupabaseClient,
  leagueId: string
): Promise<Record<string, boolean>> {
  const { data, error } = await supabase
    .from("league_members")
    .select("user_id, onboarding_completed_at")
    .eq("league_id", leagueId);

  if (error) return {};
  const out: Record<string, boolean> = {};
  for (const row of data ?? []) {
    const r = row as { user_id: string; onboarding_completed_at?: string | null };
    out[r.user_id] = Boolean(r.onboarding_completed_at?.trim());
  }
  return out;
}

export async function isSalaryCapRosterSetupComplete(
  supabase: SupabaseClient,
  leagueId: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("league_members")
    .select("onboarding_completed_at")
    .eq("league_id", leagueId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return false;
  return Boolean((data as { onboarding_completed_at?: string | null }).onboarding_completed_at?.trim());
}

export function filterRostersForSalaryCapSetupVisibility<
  T extends Record<string, unknown[]>,
>(
  rosters: T,
  leagueType: string | null | undefined,
  setupCompleteByUserId: Record<string, boolean>,
  viewerUserId: string | null | undefined,
  isSiteAdmin: boolean
): T {
  if (!leagueUsesSalaryCap(leagueType)) return rosters;
  const filtered = {} as T;
  for (const [userId, entries] of Object.entries(rosters)) {
    const setupComplete = setupCompleteByUserId[userId] ?? false;
    const isOwn = viewerUserId != null && userId === viewerUserId;
    if (setupComplete || isOwn || isSiteAdmin) {
      filtered[userId as keyof T] = entries as T[keyof T];
    }
  }
  return filtered;
}
