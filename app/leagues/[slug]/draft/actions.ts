"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateDraftOrder, makeDraftPick } from "@/lib/leagueDraft";

export async function generateDraftOrderAction(
  leagueSlug: string,
  formData: FormData
): Promise<{ error?: string }> {
  const { getLeagueBySlug } = await import("@/lib/leagues");
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };

  const style = (formData.get("draft_style") as string)?.trim();
  if (style === "snake" || style === "linear") {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user && league.commissioner_id === user.id) {
      await supabase
        .from("leagues")
        .update({ draft_style: style })
        .eq("id", league.id);
    }
  }

  const result = await generateDraftOrder(league.id);
  if (result.error) return result;

  revalidatePath(`/leagues/${leagueSlug}`);
  revalidatePath(`/leagues/${leagueSlug}/draft`);
  return {};
}

export async function makeDraftPickAction(
  leagueSlug: string,
  formData: FormData
): Promise<{ error?: string }> {
  const { getLeagueBySlug } = await import("@/lib/leagues");
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };

  const wrestlerId = (formData.get("wrestler_id") as string)?.trim();
  if (!wrestlerId) return { error: "Select a wrestler." };

  const result = await makeDraftPick(league.id, wrestlerId);
  if (result.error) return result;

  revalidatePath(`/leagues/${leagueSlug}`);
  revalidatePath(`/leagues/${leagueSlug}/draft`);
  return {};
}

/** FormData-only wrapper so draft page form has no closure (better RSC serialization). */
export async function generateDraftOrderFromFormAction(formData: FormData): Promise<void> {
  const leagueSlug = (formData.get("league_slug") as string)?.trim();
  if (!leagueSlug) return;
  await generateDraftOrderAction(leagueSlug, formData);
}

/** FormData-only wrapper so draft page form has no closure (better RSC serialization). */
export async function makeDraftPickFromFormAction(formData: FormData): Promise<void> {
  const leagueSlug = (formData.get("league_slug") as string)?.trim();
  if (!leagueSlug) return;
  await makeDraftPickAction(leagueSlug, formData);
}
