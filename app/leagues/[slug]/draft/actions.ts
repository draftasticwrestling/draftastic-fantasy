"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import { getIsSiteAdmin } from "@/lib/auth/siteAdmin";
import {
  generateDraftOrder,
  setDraftOrderFromRound1,
  makeDraftPick,
  restartDraft,
  clearLastPick,
  startDraft,
  setDraftPreferences,
  clearDraftOrder,
  runAutoPickIfExpired,
  MAX_AUTOPICK_PICKS_DRAFT_PAGE,
  DEFAULT_DRAFT_STRATEGY_OPTIONS,
} from "@/lib/leagueDraft";
import { getBigBoardPriorityList, isBigBoardId } from "@/lib/draftBigBoards";

export async function generateDraftOrderAction(
  leagueSlug: string,
  formData: FormData
): Promise<{ error?: string }> {
  const { getLeagueBySlug } = await import("@/lib/leagues");
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };

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

/** useActionState-friendly wrapper so the draft page can show success/errors inline. */
export async function generateDraftOrderWithStateAction(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string } | null> {
  const leagueSlug = (formData.get("league_slug") as string)?.trim();
  if (!leagueSlug) return { error: "League slug is required." };
  const result = await generateDraftOrderAction(leagueSlug, formData);
  if (result.error) return { error: result.error };
  return {};
}

/** Site admin only: set draft order from round 1 order (when draft_order_method is manual_by_gm). */
export async function setDraftOrderAction(
  leagueSlug: string,
  round1UserIds: string[]
): Promise<{ error?: string }> {
  const { getLeagueBySlug } = await import("@/lib/leagues");
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };

  const result = await setDraftOrderFromRound1(league.id, round1UserIds);
  if (result.error) return result;

  revalidatePath(`/leagues/${leagueSlug}`);
  revalidatePath(`/leagues/${leagueSlug}/draft`);
  revalidatePath(`/leagues/${leagueSlug}/draft/set-order`);
  return {};
}

/** Site admin only: start the draft (begin pick clock). */
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

/**
 * Run up to MAX_AUTOPICK_PICKS_DRAFT_PAGE autopicks for an in-progress autopick league.
 * Invoked from the client so the draft RSC payload stays small (avoids browser "network error" on long renders).
 */
export async function runAutopickTickAction(
  leagueSlug: string
): Promise<{ didAutoPick: boolean; error?: string }> {
  const { getLeagueBySlug } = await import("@/lib/leagues");
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { didAutoPick: false };

  if (league.draft_type !== "autopick" || league.draft_status !== "in_progress") {
    return { didAutoPick: false };
  }

  const { supabase, user } = await getServerAuth();
  if (!user) return { didAutoPick: false, error: "Sign in to run the draft." };

  const { data: member } = await supabase
    .from("league_members")
    .select("league_id")
    .eq("league_id", league.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return { didAutoPick: false, error: "You are not a member of this league." };

  const result = await runAutoPickIfExpired(league.id, { maxPicksPerInvocation: MAX_AUTOPICK_PICKS_DRAFT_PAGE });
  revalidatePath(`/leagues/${leagueSlug}/draft`);
  return result;
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

/** For useActionState: returns error so the make-pick form can display it. */
export async function makeDraftPickWithStateAction(
  _prev: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  const leagueSlug = (formData.get("league_slug") as string)?.trim();
  if (!leagueSlug) return { error: "Missing league." };
  return makeDraftPickAction(leagueSlug, formData);
}

/** Site admin only: clear draft order so a new order can be generated. */
export async function clearDraftOrderAction(leagueSlug: string): Promise<{ error?: string }> {
  const { getLeagueBySlug } = await import("@/lib/leagues");
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };
  const { user } = await getServerAuth();
  if (!user) return { error: "Not authenticated." };
  if (!(await getIsSiteAdmin())) {
    return { error: "Only site admins can clear draft order. Use the site admin league tools." };
  }
  const result = await clearDraftOrder(league.id);
  if (result.error) return result;
  revalidatePath(`/leagues/${leagueSlug}`);
  revalidatePath(`/leagues/${leagueSlug}/draft`);
  return {};
}

/** Form action: clear draft order and redirect to draft page (so Generate draft order form appears). */
export async function clearDraftOrderFromFormAction(formData: FormData): Promise<never> {
  const leagueSlug = (formData.get("league_slug") as string)?.trim();
  if (!leagueSlug) redirect("/");
  const result = await clearDraftOrderAction(leagueSlug);
  if (result.error) redirect(`/leagues/${leagueSlug}/draft?error=${encodeURIComponent(result.error)}`);
  redirect(`/leagues/${leagueSlug}/draft`);
}

/** Site admin only: restart draft (clear all picks and rosters; keeps draft order). */
export async function restartDraftAction(leagueSlug: string): Promise<{ error?: string }> {
  const { getLeagueBySlug } = await import("@/lib/leagues");
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };
  const { user } = await getServerAuth();
  if (!user) return { error: "Not authenticated." };
  if (!(await getIsSiteAdmin())) {
    return { error: "Only site admins can restart the draft. Use the site admin league tools." };
  }
  const result = await restartDraft(league.id);
  if (result.error) return result;
  revalidatePath(`/leagues/${leagueSlug}`);
  revalidatePath(`/leagues/${leagueSlug}/draft`);
  return {};
}

/** Site admin only: undo the last pick. */
export async function clearLastPickAction(leagueSlug: string): Promise<{ error?: string }> {
  const { getLeagueBySlug } = await import("@/lib/leagues");
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };
  const { user } = await getServerAuth();
  if (!user) return { error: "Not authenticated." };
  if (!(await getIsSiteAdmin())) {
    return { error: "Only site admins can undo a pick. Use the site admin league tools." };
  }
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

/** Save a user's auto-draft preferences (optional priority_list 10-50; strategy is fixed defaults). */
export async function saveDraftPreferencesAction(
  leagueSlug: string,
  payload: {
    priority_list?: string[] | string;
    /** Autopick: "custom" or a Big Board id (which board was used, or custom after edits). */
    priorityListSource?: string;
  }
): Promise<{ error?: string }> {
  const { getLeagueBySlug } = await import("@/lib/leagues");
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };
  const { supabase, user } = await getServerAuth();
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
  let priorityListSource: string = "custom";
  if (payload.priorityListSource === "custom") {
    priorityListSource = "custom";
  } else if (payload.priorityListSource && isBigBoardId(payload.priorityListSource)) {
    priorityListSource = payload.priorityListSource;
  }

  const result = await setDraftPreferences(league.id, user.id, {
    priority_list,
    strategy: [],
    strategy_options: {
      ...DEFAULT_DRAFT_STRATEGY_OPTIONS,
      priorityListSource,
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
  const { getLeagueBySlug } = await import("@/lib/leagues");
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };

  const rawListSource = (formData.get("list_source") as string)?.trim();
  const listSource =
    league.draft_type === "autopick"
      ? rawListSource === "custom" || isBigBoardId(rawListSource)
        ? rawListSource
        : "default"
      : rawListSource || "custom";
  let priority_list: string[] = [];

  if (league.draft_type === "autopick" && isBigBoardId(listSource)) {
    const boardList = getBigBoardPriorityList(listSource);
    if (!boardList) {
      return {
        error:
          "That Big Board is not available yet (it needs a full list in the app). Choose another board or build your own list.",
      };
    }
    priority_list = boardList;
  } else {
    const priorityListRaw = formData.get("priority_list");
    if (typeof priorityListRaw === "string") {
      try {
        const parsed = JSON.parse(priorityListRaw) as unknown;
        priority_list = Array.isArray(parsed) ? (parsed as string[]) : [];
      } catch {
        priority_list = [];
      }
    }
  }
  const priorityListSource =
    listSource === "custom" || isBigBoardId(listSource) ? listSource : "custom";

  const result = await saveDraftPreferencesAction(leagueSlug, {
    priority_list,
    priorityListSource,
  });
  if (result.error) return { error: result.error };
  return null;
}
