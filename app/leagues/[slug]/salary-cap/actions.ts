"use server";

import { revalidatePath } from "next/cache";
import { getLeagueBySlug } from "@/lib/leagues";
import { addWrestlerToRoster, removeWrestlerFromRoster } from "@/lib/leagues";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import { leagueUsesSalaryCap } from "@/lib/leagueStructure";
import { getAdminClient } from "@/lib/supabase/admin";

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
