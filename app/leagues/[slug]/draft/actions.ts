"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateDraftOrder, makeDraftPick, restartDraft, clearLastPick, startDraft, setDraftPreferences } from "@/lib/leagueDraft";

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

/** Commissioner only: start the draft (begin pick clock). */
export async function startDraftAction(leagueSlug: string): Promise<{ error?: string }> {
  const { getLeagueBySlug } = await import("@/lib/leagues");
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };
  const result = await startDraft(league.id);
  if (result.error) return result;
  revalidatePath(`/leagues/${leagueSlug}`);
  revalidatePath(`/leagues/${leagueSlug}/draft`);
  return {};
}

/** FormData-only wrapper for Start Draft. */
export async function startDraftFromFormAction(formData: FormData): Promise<void> {
  const leagueSlug = (formData.get("league_slug") as string)?.trim();
  if (!leagueSlug) return;
  await startDraftAction(leagueSlug);
}

/** FormData-only wrapper so draft page form has no closure (better RSC serialization). */
export async function makeDraftPickFromFormAction(formData: FormData): Promise<void> {
  const leagueSlug = (formData.get("league_slug") as string)?.trim();
  if (!leagueSlug) return;
  await makeDraftPickAction(leagueSlug, formData);
}

/** For useFormState: returns error so the make-pick form can display it. */
export async function makeDraftPickWithStateAction(
  _prev: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  const leagueSlug = (formData.get("league_slug") as string)?.trim();
  if (!leagueSlug) return { error: "Missing league." };
  return makeDraftPickAction(leagueSlug, formData);
}

/** Commissioner only: restart draft (clear all picks and order). */
export async function restartDraftAction(leagueSlug: string): Promise<{ error?: string }> {
  const { getLeagueBySlug } = await import("@/lib/leagues");
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || league.commissioner_id !== user.id) return { error: "Only the commissioner can restart the draft." };
  const result = await restartDraft(league.id);
  if (result.error) return result;
  revalidatePath(`/leagues/${leagueSlug}`);
  revalidatePath(`/leagues/${leagueSlug}/draft`);
  return {};
}

/** Commissioner only: undo the last pick. */
export async function clearLastPickAction(leagueSlug: string): Promise<{ error?: string }> {
  const { getLeagueBySlug } = await import("@/lib/leagues");
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || league.commissioner_id !== user.id) return { error: "Only the commissioner can clear a pick." };
  const result = await clearLastPick(league.id);
  if (result.error) return result;
  revalidatePath(`/leagues/${leagueSlug}`);
  revalidatePath(`/leagues/${leagueSlug}/draft`);
  return {};
}

/** FormData wrapper for commissioner restart draft. */
export async function restartDraftFromFormAction(formData: FormData): Promise<void> {
  const leagueSlug = (formData.get("league_slug") as string)?.trim();
  if (!leagueSlug) return;
  await restartDraftAction(leagueSlug);
}

/** FormData wrapper for commissioner clear last pick. */
export async function clearLastPickFromFormAction(formData: FormData): Promise<void> {
  const leagueSlug = (formData.get("league_slug") as string)?.trim();
  if (!leagueSlug) return;
  await clearLastPickAction(leagueSlug);
}

/** Save a user's auto-draft preferences (optional priority_list 10-50, strategy_options: focus, pointStrategy, wrestlerStrategy). */
export async function saveDraftPreferencesAction(
  leagueSlug: string,
  payload: {
    priority_list?: string[] | string;
    focus: string;
    pointStrategy: string;
    wrestlerStrategy: string;
  }
): Promise<{ error?: string }> {
  const { getLeagueBySlug } = await import("@/lib/leagues");
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };
  const { data: member } = await supabase
    .from("league_members")
    .select("user_id")
    .eq("league_id", league.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return { error: "You are not a member of this league." };
  let priority_list: string[] = [];
  if (Array.isArray(payload.priority_list)) {
    priority_list = payload.priority_list;
  } else if (typeof payload.priority_list === "string") {
    try {
      const parsed = JSON.parse(payload.priority_list) as unknown;
      priority_list = Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      priority_list = [];
    }
  }
  const result = await setDraftPreferences(league.id, user.id, {
    priority_list,
    strategy: [],
    strategy_options: {
      focus: payload.focus as "2026" | "2025" | "all",
      pointStrategy: payload.pointStrategy as "total" | "rs" | "ple" | "belt",
      wrestlerStrategy: payload.wrestlerStrategy as "best_available" | "balanced_gender" | "balanced_brands" | "high_males" | "high_females",
    },
  });
  if (result.error) return result;
  revalidatePath(`/leagues/${leagueSlug}/draft`);
  revalidatePath(`/leagues/${leagueSlug}/draft/preferences`);
  return {};
}

/** Form action for draft preferences: receives FormData from form submit (avoids client action reference 404). */
export async function saveDraftPreferencesFormAction(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string } | null> {
  const leagueSlug = (formData.get("league_slug") as string)?.trim();
  if (!leagueSlug) return { error: "League slug is required." };
  const priorityListRaw = formData.get("priority_list");
  let priority_list: string[] = [];
  if (typeof priorityListRaw === "string") {
    try {
      const parsed = JSON.parse(priorityListRaw) as unknown;
      priority_list = Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      priority_list = [];
    }
  }
  const focus = (formData.get("focus") as string)?.trim() || "all";
  const pointStrategy = (formData.get("pointStrategy") as string)?.trim() || "total";
  const wrestlerStrategy = (formData.get("wrestlerStrategy") as string)?.trim() || "best_available";
  const result = await saveDraftPreferencesAction(leagueSlug, {
    priority_list,
    focus,
    pointStrategy,
    wrestlerStrategy,
  });
  if (result.error) return { error: result.error };
  return null;
}
