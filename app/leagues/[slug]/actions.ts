"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
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

  if (!leagueSlug || !leagueId || !userId || !wrestlerId) {
    return { error: "Member and wrestler are required." };
  }

  const result = await addWrestlerToRoster(leagueId, userId, wrestlerId, contract ?? null);
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
