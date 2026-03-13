"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { DraftOrderMethod, DraftType } from "@/lib/leagues";
import { addWrestlerToRoster, getLeagueBySlug, removeWrestlerFromRoster } from "@/lib/leagues";

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

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || league.commissioner_id !== user.id) {
    return { error: "Only the commissioner can set the draft date." };
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

const DRAFT_TYPES: DraftType[] = ["offline", "linear", "snake", "autopick"];
const DRAFT_STYLES = ["linear", "snake"] as const;
const TIME_PER_PICK_VALUES = [30, 60, 90, 120, 150, 180] as const;
const DRAFT_ORDER_METHODS: DraftOrderMethod[] = ["random_one_hour_before", "manual_by_gm"];

export async function updateDraftSettingsAction(
  leagueSlug: string,
  formData: FormData
): Promise<{ error?: string }> {
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || league.commissioner_id !== user.id) {
    return { error: "Only the commissioner can change draft settings." };
  }

  const draft_type_ui = (formData.get("draft_type_ui") as string)?.trim();
  const draft_style = (formData.get("draft_style") as string)?.trim();
  const time_per_pick_seconds = formData.get("time_per_pick_seconds");
  const draft_order_method = (formData.get("draft_order_method") as string)?.trim() as DraftOrderMethod | undefined;
  const draft_date_raw = (formData.get("draft_date") as string)?.trim() || "";
  const draft_time_raw = (formData.get("draft_time") as string)?.trim() || "";

  let draft_date: string | null = null;
  if (draft_date_raw) {
    if (draft_time_raw) {
      // Store combined local date+time; downstream code slices to YYYY-MM-DD when needed.
      draft_date = `${draft_date_raw}T${draft_time_raw}:00`;
    } else {
      draft_date = draft_date_raw;
    }
  }

  const payload: Record<string, unknown> = { draft_date: draft_date || null };

  if (draft_type_ui === "live" && draft_style && DRAFT_STYLES.includes(draft_style as "linear" | "snake")) {
    payload.draft_type = draft_style;
    payload.draft_style = draft_style;
  } else if (draft_type_ui === "offline" || draft_type_ui === "autopick") {
    payload.draft_type = draft_type_ui;
  } else if (draft_type_ui && DRAFT_TYPES.includes(draft_type_ui as DraftType)) {
    payload.draft_type = draft_type_ui;
  }

  if (time_per_pick_seconds != null) {
    const sec = Number(time_per_pick_seconds);
    if ((TIME_PER_PICK_VALUES as readonly number[]).includes(sec)) payload.time_per_pick_seconds = sec;
  }
  if (draft_order_method && DRAFT_ORDER_METHODS.includes(draft_order_method)) {
    payload.draft_order_method = draft_order_method;
  }

  const { error } = await supabase
    .from("leagues")
    .update(payload)
    .eq("id", league.id);

  if (error) return { error: error.message };
  revalidatePath(`/leagues/${leagueSlug}`);
  revalidatePath(`/leagues/${leagueSlug}/league-settings`);
  return {};
}

/** For useFormState: (prevState, formData) => update draft settings. */
export async function updateDraftSettingsFormAction(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string } | null> {
  const leagueSlug = (formData.get("league_slug") as string)?.trim();
  if (!leagueSlug) return { error: "League slug is required." };
  return updateDraftSettingsAction(leagueSlug, formData);
}

const TEAM_COUNTS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] as const;
const VALID_LEAGUE_TYPES = ["season_overall", "head_to_head", "combo", "legacy"] as const;

export async function updateBasicSettingsAction(
  leagueSlug: string,
  formData: FormData
): Promise<{ error?: string }> {
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || league.commissioner_id !== user.id) {
    return { error: "Only the commissioner can change basic settings." };
  }

  const name = (formData.get("league_name") as string)?.trim();
  if (!name || name.length > 120) return { error: "League name is required (max 120 characters)." };

  const maxTeamsRaw = formData.get("max_teams");
  const max_teams =
    maxTeamsRaw != null && Number.isFinite(Number(maxTeamsRaw))
      ? Math.min(16, Math.max(3, Math.floor(Number(maxTeamsRaw))))
      : null;

  if (league.league_type === "head_to_head" && max_teams != null && max_teams < 4) {
    return { error: "Head-to-Head leagues require at least 4 teams." };
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

export async function updateLeagueTypeAction(
  leagueSlug: string,
  formData: FormData
): Promise<{ error?: string }> {
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || league.commissioner_id !== user.id) {
    return { error: "Only the commissioner can change league type." };
  }

  const league_type = (formData.get("league_type") as string)?.trim() || null;
  if (league_type && !VALID_LEAGUE_TYPES.includes(league_type as (typeof VALID_LEAGUE_TYPES)[number])) {
    return { error: "Invalid league type." };
  }

  const { error } = await supabase.from("leagues").update({ league_type }).eq("id", league.id);
  if (error) return { error: error.message };
  revalidatePath(`/leagues/${leagueSlug}`);
  revalidatePath(`/leagues/${leagueSlug}/league-settings`);
  return {};
}

export async function updateLeagueTypeFormAction(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string } | null> {
  const leagueSlug = (formData.get("league_slug") as string)?.trim();
  if (!leagueSlug) return { error: "League slug is required." };
  return updateLeagueTypeAction(leagueSlug, formData);
}

export async function deleteLeagueAction(
  leagueSlug: string,
  formData: FormData
): Promise<{ error?: string }> {
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || league.commissioner_id !== user.id) {
    return { error: "Only the commissioner can delete the league." };
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
