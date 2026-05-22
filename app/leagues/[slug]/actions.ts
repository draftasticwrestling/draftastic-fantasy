"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import { getAdminClient } from "@/lib/supabase/admin";
import type { DraftOrderMethod } from "@/lib/leagues";
import { addWrestlerToRoster, getLeagueBySlug, removeWrestlerFromRoster, syncPublicLeagueStatusBySlug } from "@/lib/leagues";
import { isPublicSalaryCapLeague } from "@/lib/publicLeagueSchedule";
import { assertWrestlerNotTradeLocked } from "@/lib/leagueOwner";
import { getIsSiteAdmin } from "@/lib/auth/siteAdmin";
import { isLeagueTypeChangeAllowed } from "@/lib/leagueSettingsRules";

export type AddRosterState = { error?: string };

export async function addRosterEntryAction(
  _prevState: AddRosterState | null,
  formData: FormData
): Promise<AddRosterState> {
  const leagueSlug = formData.get("leagueSlug") as string;
  const leagueId = formData.get("leagueId") as string;
  const userId = formData.get("userId") as string;
  const wrestlerId = (formData.get("wrestlerId") as string)?.trim();
  const contract = (formData.get("contract") as string)?.trim() || undefined;
  const acquiredAt = (formData.get("acquiredAt") as string)?.trim() || undefined;

  if (!leagueSlug || !leagueId || !userId || !wrestlerId) {
    return { error: "Member and wrestler are required." };
  }

  const result = await addWrestlerToRoster(
    leagueId,
    userId,
    wrestlerId,
    contract ?? null,
    undefined,
    acquiredAt || undefined
  );
  if (result.error) return { error: result.error };

  revalidatePath(`/leagues/${leagueSlug}`);
  return {};
}

export async function removeRosterEntryAction(formData: FormData): Promise<{ error?: string }> {
  const leagueSlug = formData.get("leagueSlug") as string;
  const leagueId = formData.get("leagueId") as string;
  const userId = formData.get("userId") as string;
  const wrestlerId = (formData.get("wrestlerId") as string)?.trim();

  if (!leagueSlug || !leagueId || !userId || !wrestlerId) {
    return { error: "Missing parameters." };
  }

  const tradeLock = await assertWrestlerNotTradeLocked(leagueId, userId, wrestlerId);
  if (tradeLock.error) return tradeLock;

  const result = await removeWrestlerFromRoster(leagueId, userId, wrestlerId);
  if (result.error) return { error: result.error };

  revalidatePath(`/leagues/${leagueSlug}`);
  return {};
}

/** FormData-only wrapper for form action (void return for Next.js). */
export async function removeRosterEntryFromFormAction(formData: FormData): Promise<void> {
  await removeRosterEntryAction(formData);
}

export async function updateDraftDateAction(
  leagueSlug: string,
  formData: FormData
): Promise<{ error?: string }> {
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };

  const { supabase, user } = await getServerAuth();
  if (!user || league.commissioner_id !== user.id) {
    return { error: "Only the GM can set the draft date." };
  }

  const draft_date = (formData.get("draft_date") as string)?.trim() || null;

  const { error } = await supabase
    .from("leagues")
    .update({ draft_date: draft_date || null })
    .eq("id", league.id);

  if (error) return { error: error.message };
  revalidatePath(`/leagues/${leagueSlug}`);
  return {};
}

/** FormData-only wrapper so the league page form action has no closure (better RSC serialization). */
export async function updateDraftDateFromFormAction(formData: FormData): Promise<void> {
  const leagueSlug = (formData.get("league_slug") as string)?.trim();
  if (!leagueSlug) return;
  await updateDraftDateAction(leagueSlug, formData);
}

export async function updateDraftSettingsAction(
  leagueSlug: string,
  formData: FormData
): Promise<{ error?: string }> {
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };

  const { supabase, user } = await getServerAuth();
  if (!user || league.commissioner_id !== user.id) {
    return { error: "Only the GM can change draft settings." };
  }

  const draft_type_ui = (formData.get("draft_type_ui") as string)?.trim();
  const isPublicLeague = String(league.visibility_type ?? "").toLowerCase() === "public";

  const payload: Record<string, unknown> = {
    draft_date: null,
    draft_time: null,
    draft_style: "snake",
    draft_order_method: "random_one_hour_before" satisfies DraftOrderMethod,
    time_per_pick_seconds: null,
  };

  if (draft_type_ui === "offline" && isPublicLeague) {
    return { error: "Public leagues must use Autopick draft type." };
  }

  if (draft_type_ui === "offline") {
    payload.draft_type = "offline";
  } else {
    payload.draft_type = "autopick";
  }

  const { data: updatedRows, error } = await supabase
    .from("leagues")
    .update(payload)
    .eq("id", league.id)
    .select("id");

  if (error) return { error: error.message };
  if (!updatedRows?.length) {
    return { error: "Update did not apply. You may not have permission to change this league." };
  }
  revalidatePath(`/leagues/${leagueSlug}`);
  revalidatePath(`/leagues/${leagueSlug}/league-settings`);
  revalidatePath(`/leagues/${leagueSlug}/draft`);
  return {};
}

/** For useActionState: (prevState, formData) => update draft settings. */
export async function updateDraftSettingsFormAction(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string } | null> {
  const leagueSlug = (formData.get("league_slug") as string)?.trim();
  if (!leagueSlug) return { error: "League slug is required." };
  return updateDraftSettingsAction(leagueSlug, formData);
}

const TEAM_COUNTS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] as const;
const VALID_LEAGUE_TYPES = ["season_overall", "head_to_head", "combo", "legacy", "salary_cap"] as const;

export async function updateBasicSettingsAction(
  leagueSlug: string,
  formData: FormData
): Promise<{ error?: string }> {
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };

  const { supabase, user } = await getServerAuth();
  if (!user || league.commissioner_id !== user.id) {
    return { error: "Only the GM can change basic settings." };
  }

  const name = (formData.get("league_name") as string)?.trim();
  if (!name || name.length > 120) return { error: "League name is required (max 120 characters)." };

  const isSiteAdmin = await getIsSiteAdmin();
  const isPublicLeague = String(league.visibility_type ?? "").toLowerCase() === "public";
  const allowedMinTeams = 3;
  const allowedMaxTeams = isSiteAdmin ? 16 : 6;

  const maxTeamsRaw = formData.get("max_teams");
  let max_teams =
    maxTeamsRaw != null && Number.isFinite(Number(maxTeamsRaw))
      ? Math.floor(Number(maxTeamsRaw))
      : null;

  if (isPublicLeague) {
    max_teams = isPublicSalaryCapLeague(league) ? null : 6;
  } else if (max_teams != null) {
    if (max_teams < allowedMinTeams || max_teams > allowedMaxTeams) {
      return { error: `Choose between ${allowedMinTeams} and ${allowedMaxTeams} teams.` };
    }
  }

  if (league.league_type === "head_to_head" && max_teams != null && max_teams < 4) {
    return { error: "Head-to-Head leagues require at least 4 factions." };
  }

  const auto_reactivate = formData.get("auto_reactivate") === "yes";

  const payload: Record<string, unknown> = { name, max_teams, auto_reactivate };
  const { error } = await supabase.from("leagues").update(payload).eq("id", league.id);
  if (error) return { error: error.message };
  revalidatePath(`/leagues/${leagueSlug}`);
  revalidatePath(`/leagues/${leagueSlug}/league-settings`);
  return {};
}

export async function updateBasicSettingsFormAction(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string } | null> {
  const leagueSlug = (formData.get("league_slug") as string)?.trim();
  if (!leagueSlug) return { error: "League slug is required." };
  return updateBasicSettingsAction(leagueSlug, formData);
}

/** GM updates the league note shown on the league overview. */
export async function updateManagerNoteAction(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const leagueSlug = (formData.get("league_slug") as string)?.trim();
  if (!leagueSlug) return { error: "League not found." };

  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };

  const { supabase, user } = await getServerAuth();
  if (!user || league.commissioner_id !== user.id) {
    return { error: "Only the GM can edit the GM note." };
  }

  const manager_note = (formData.get("manager_note") as string)?.trim() || null;

  const { error } = await supabase
    .from("leagues")
    .update({ manager_note })
    .eq("id", league.id);
  if (error) return { error: error.message };
  revalidatePath(`/leagues/${leagueSlug}`);
  revalidatePath(`/leagues/${leagueSlug}/lm-note`);
  redirect(`/leagues/${leagueSlug}`);
}

export async function updateLeagueTypeAction(
  leagueSlug: string,
  formData: FormData
): Promise<{ error?: string }> {
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };

  const { supabase, user } = await getServerAuth();
  if (!user || league.commissioner_id !== user.id) {
    return { error: "Only the GM can change league type." };
  }

  if (!isLeagueTypeChangeAllowed(league)) {
    const isPublic = String(league.visibility_type ?? "").toLowerCase() === "public";
    return {
      error: isPublic
        ? "League type cannot be changed for public leagues."
        : "League type cannot be changed after the league has started.",
    };
  }

  const league_type = (formData.get("league_type") as string)?.trim() || null;
  if (league_type && !VALID_LEAGUE_TYPES.includes(league_type as (typeof VALID_LEAGUE_TYPES)[number])) {
    return { error: "Invalid league type." };
  }

  const isSiteAdmin = await getIsSiteAdmin();
  if (
    league_type === "head_to_head" &&
    league.league_type !== "head_to_head" &&
    !isSiteAdmin
  ) {
    return {
      error:
        "Head-to-Head is not available for new leagues during the Road to SummerSlam beta. Choose Total Season Points, or ask a site admin to enable Head-to-Head for testing.",
    };
  }

  const updatePayload: { league_type: string | null; include_nxt?: boolean } = { league_type };
  if (league_type === "salary_cap") {
    updatePayload.include_nxt = true;
  } else if (league_type && league_type !== "head_to_head" && Boolean((league as { include_nxt?: boolean | null }).include_nxt)) {
    updatePayload.include_nxt = false;
  }
  let { error } = await supabase.from("leagues").update(updatePayload).eq("id", league.id);
  if (error && /include_nxt/i.test(error.message ?? "")) {
    const retry = await supabase.from("leagues").update({ league_type }).eq("id", league.id);
    error = retry.error;
  }
  if (error) return { error: error.message };
  revalidatePath(`/leagues/${leagueSlug}`);
  revalidatePath(`/leagues/${leagueSlug}/league-settings`);
  return {};
}

export async function updateIncludeNxtAction(
  leagueSlug: string,
  formData: FormData
): Promise<{ error?: string }> {
  const isSiteAdmin = await getIsSiteAdmin();
  if (!isSiteAdmin) {
    return { error: "Only site administrators can change the Include NXT setting." };
  }
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };

  const { supabase, user } = await getServerAuth();
  if (!user || league.commissioner_id !== user.id) {
    return { error: "Only the GM can update this league." };
  }
  if ((league.league_type ?? "") !== "head_to_head") {
    return { error: "Include NXT only applies to Head-to-Head leagues." };
  }

  const include_nxt =
    formData.get("include_nxt") === "1" || formData.get("include_nxt") === "on" || formData.get("include_nxt") === "true";

  let { error } = await supabase.from("leagues").update({ include_nxt }).eq("id", league.id);
  if (error && /include_nxt/i.test(error.message ?? "")) {
    return { error: "Database is missing the include_nxt column. Apply the latest Supabase migration." };
  }
  if (error) return { error: error.message };
  revalidatePath(`/leagues/${leagueSlug}`);
  revalidatePath(`/leagues/${leagueSlug}/league-settings`);
  revalidatePath(`/leagues/${leagueSlug}/draft`);
  revalidatePath(`/leagues/${leagueSlug}/wrestlers/free-agents`);
  return {};
}

export async function updateIncludeNxtFormAction(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string } | null> {
  const leagueSlug = (formData.get("league_slug") as string)?.trim();
  if (!leagueSlug) return { error: "League slug is required." };
  return updateIncludeNxtAction(leagueSlug, formData);
}

export async function updateLeagueTypeFormAction(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string } | null> {
  const leagueSlug = (formData.get("league_slug") as string)?.trim();
  if (!leagueSlug) return { error: "League slug is required." };
  return updateLeagueTypeAction(leagueSlug, formData);
}

/** Commissioner removes a manager from the league (prior to draft). Frees the slot for a new invite. */
export async function removeMemberFromLeagueAction(
  leagueSlug: string,
  userId: string
): Promise<{ error?: string }> {
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };

  const { supabase, user } = await getServerAuth();
  if (!user || league.commissioner_id !== user.id) {
    return { error: "Only the GM can remove a manager." };
  }
  if (userId === league.commissioner_id) {
    return { error: "You cannot remove yourself as GM." };
  }
  const status = league.draft_status ?? "not_started";
  if (status === "in_progress" || status === "completed") {
    return { error: "Managers can only be removed before the draft has started." };
  }

  const admin = getAdminClient();
  if (!admin) return { error: "Server configuration error." };

  const { error: rosterErr } = await admin
    .from("league_rosters")
    .delete()
    .eq("league_id", league.id)
    .eq("user_id", userId);
  if (rosterErr) return { error: rosterErr.message };

  const { error: prefErr } = await admin
    .from("league_draft_preferences")
    .delete()
    .eq("league_id", league.id)
    .eq("user_id", userId);
  if (prefErr) return { error: prefErr.message };

  const { error: memberErr } = await admin
    .from("league_members")
    .delete()
    .eq("league_id", league.id)
    .eq("user_id", userId);
  if (memberErr) return { error: memberErr.message };

  await syncPublicLeagueStatusBySlug(leagueSlug);
  revalidatePath(`/leagues/${leagueSlug}`);
  return {};
}

export async function deleteLeagueAction(
  leagueSlug: string,
  formData: FormData
): Promise<{ error?: string }> {
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };
  const isPublicLeague = String(league.visibility_type ?? "").toLowerCase() === "public";
  if (isPublicLeague) {
    return { error: "Public leagues cannot be deleted." };
  }

  const { supabase, user } = await getServerAuth();
  if (!user || league.commissioner_id !== user.id) {
    return { error: "Only the GM can delete the league." };
  }

  const confirmCheck = formData.get("confirm_irreversible") === "on";
  if (!confirmCheck) return { error: "You must check the box to confirm you understand this action is permanent." };

  const confirmName = (formData.get("confirm_league_name") as string)?.trim();
  if (confirmName !== league.name) {
    return { error: "The league name you typed does not match. Type the exact league name to confirm." };
  }

  const { error } = await supabase.from("leagues").delete().eq("id", league.id);
  if (error) return { error: error.message };
  revalidatePath("/leagues");
  redirect("/leagues");
}

export async function deleteLeagueFormAction(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string } | null> {
  const leagueSlug = (formData.get("league_slug") as string)?.trim();
  if (!leagueSlug) return { error: "League slug is required." };
  const result = await deleteLeagueAction(leagueSlug, formData);
  if (result?.error) return result;
  return null;
}
