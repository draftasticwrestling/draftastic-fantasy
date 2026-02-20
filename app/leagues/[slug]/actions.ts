"use server";

import { revalidatePath } from "next/cache";
import { addWrestlerToRoster, removeWrestlerFromRoster } from "@/lib/leagues";

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
