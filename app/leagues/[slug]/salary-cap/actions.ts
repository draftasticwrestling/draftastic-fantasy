"use server";

import { revalidatePath } from "next/cache";
import { getLeagueBySlug, getRostersForLeague } from "@/lib/leagues";
import { addWrestlerToRoster, removeWrestlerFromRoster } from "@/lib/leagues";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import { leagueUsesSalaryCap } from "@/lib/leagueStructure";
import { getAdminClient } from "@/lib/supabase/admin";
import { isSalaryCapRosterSetupComplete } from "@/lib/leagueOnboarding";
import { completeLeagueOnboardingAction } from "../onboarding/actions";

async function assertSalaryCapSetupInProgress(
  leagueId: string,
  userId: string
): Promise<{ error?: string } | null> {
  const { supabase } = await getServerAuth();
  const setupComplete = await isSalaryCapRosterSetupComplete(supabase, leagueId, userId);
  if (setupComplete) {
    return {
      error:
        "Your roster setup is complete. Use Add/Drop on your faction page to change your roster during the season.",
    };
  }
  return null;
}

export async function addSalaryCapWrestlerAction(
  leagueSlug: string,
  wrestlerId: string
): Promise<{ error?: string }> {
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };
  if (!leagueUsesSalaryCap(league.league_type)) {
    return { error: "This league is not a salary cap league." };
  }
  const { user } = await getServerAuth();
  if (!user) return { error: "Not authenticated." };

  const blocked = await assertSalaryCapSetupInProgress(league.id, user.id);
  if (blocked) return blocked;

  const result = await addWrestlerToRoster(league.id, user.id, wrestlerId, null, true);
  if (result.error) return result;

  revalidatePath(`/leagues/${leagueSlug}/salary-cap`);
  revalidatePath(`/leagues/${leagueSlug}/faction`);
  revalidatePath(`/leagues/${leagueSlug}`);
  return {};
}

export async function removeSalaryCapWrestlerAction(
  leagueSlug: string,
  wrestlerId: string
): Promise<{ error?: string }> {
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };
  if (!leagueUsesSalaryCap(league.league_type)) {
    return { error: "This league is not a salary cap league." };
  }
  const { user } = await getServerAuth();
  if (!user) return { error: "Not authenticated." };

  const blocked = await assertSalaryCapSetupInProgress(league.id, user.id);
  if (blocked) return blocked;

  const result = await removeWrestlerFromRoster(league.id, user.id, wrestlerId, undefined, true);
  if (result.error) return result;

  revalidatePath(`/leagues/${leagueSlug}/salary-cap`);
  revalidatePath(`/leagues/${leagueSlug}/faction`);
  revalidatePath(`/leagues/${leagueSlug}`);
  return {};
}

/** Commissioner marks salary-cap roster build complete (same as draft completed for scoring). */
export async function completeSalaryCapBuildAction(leagueSlug: string): Promise<{ error?: string }> {
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };
  if (!leagueUsesSalaryCap(league.league_type)) {
    return { error: "This league is not a salary cap league." };
  }
  const { user } = await getServerAuth();
  if (!user) return { error: "Not authenticated." };
  if (league.commissioner_id !== user.id) {
    return { error: "Only the commissioner can complete the roster build." };
  }

  const admin = getAdminClient();
  if (!admin) return { error: "Server configuration error." };

  const { error } = await admin
    .from("leagues")
    .update({ draft_status: "completed" })
    .eq("id", league.id);
  if (error) return { error: error.message };

  revalidatePath(`/leagues/${leagueSlug}/salary-cap`);
  revalidatePath(`/leagues/${leagueSlug}`);
  return {};
}

/** Member finishes initial salary-cap roster setup and goes to their faction page. */
export async function finishSalaryCapInitialRosterAction(
  leagueSlug: string
): Promise<{ error?: string; redirectTo?: string }> {
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };
  if (!leagueUsesSalaryCap(league.league_type)) {
    return { error: "This league is not a salary cap league." };
  }

  const { supabase, user } = await getServerAuth();
  if (!user) return { error: "Not authenticated." };

  const rosters = await getRostersForLeague(league.id);
  const myEntries = rosters[user.id] ?? [];
  if (myEntries.length === 0) {
    return { error: "Add at least one wrestler to your roster before finishing setup." };
  }

  const { data: member } = await supabase
    .from("league_members")
    .select("onboarding_completed_at")
    .eq("league_id", league.id)
    .eq("user_id", user.id)
    .maybeSingle();

  const alreadyComplete = Boolean(
    (member as { onboarding_completed_at?: string | null } | null)?.onboarding_completed_at?.trim()
  );

  if (!alreadyComplete) {
    const onboarding = await completeLeagueOnboardingAction(leagueSlug);
    if (onboarding.error) return { error: onboarding.error };
  }

  revalidatePath(`/leagues/${leagueSlug}/salary-cap`);
  revalidatePath(`/leagues/${leagueSlug}/faction`);
  revalidatePath(`/leagues/${leagueSlug}`);
  revalidatePath(`/leagues/${leagueSlug}/team/${user.id}`);

  return { redirectTo: `/leagues/${leagueSlug}/faction` };
}
