"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import { getIsSiteAdmin } from "@/lib/auth/siteAdmin";
import {
  generateDraftOrder,
  setDraftOrderFromRound1,
  makeDraftPick,
  getViewerLiveAutoPick,
  setLiveDraftAutoPick,
  restartDraft,
  clearLastPick,
  startDraft,
  setDraftPreferences,
  clearDraftOrder,
  runAutoPickIfExpired,
  runLiveDraftClockIfExpired,
  MAX_AUTOPICK_PICKS_DRAFT_PAGE,
  DEFAULT_DRAFT_STRATEGY_OPTIONS,
} from "@/lib/leagueDraft";
import { getAutopickRequiredPriorityCount } from "@/lib/draftPriorityRequirements";
import {
  getAvailableBigBoardIdsForLeague,
  getBigBoardPriorityList,
  isBigBoardId,
  type BigBoardId,
} from "@/lib/draftBigBoards";
import { leagueIncludesNxt } from "@/lib/leagueStructure";

function isAvailableBigBoardId(
  id: string | null | undefined,
  availableBigBoardIds: BigBoardId[]
): id is BigBoardId {
  return Boolean(id) && isBigBoardId(id) && availableBigBoardIds.includes(id);
}

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
): Promise<{ error?: string; ok?: boolean; at?: number } | null> {
  const leagueSlug = (formData.get("league_slug") as string)?.trim();
  if (!leagueSlug) return { error: "League slug is required." };
  const result = await generateDraftOrderAction(leagueSlug, formData);
  if (result.error) return { error: result.error };
  return { ok: true, at: Date.now() };
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

/** GM or site admin: start the draft (begin pick clock). */
export async function startDraftAction(
  leagueSlug: string,
  opts?: { confirmShortRoster?: boolean }
): Promise<{ error?: string }> {
  const { getLeagueBySlug } = await import("@/lib/leagues");
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };
  const result = await startDraft(league.id, opts);
  if (result.error) return result;
  revalidatePath(`/leagues/${leagueSlug}`);
  revalidatePath(`/leagues/${leagueSlug}/draft`);
  return {};
}

export async function startDraftWithStateAction(
  _prevState: { error?: string; ok?: boolean; at?: number } | null,
  formData: FormData
): Promise<{ error?: string; ok?: boolean; at?: number } | null> {
  const leagueSlug = (formData.get("league_slug") as string)?.trim();
  if (!leagueSlug) return { error: "League slug is required." };
  const confirmShortRoster =
    formData.get("confirm_short_roster") === "1" || formData.get("confirm_short_roster") === "true";
  const result = await startDraftAction(leagueSlug, { confirmShortRoster });
  if (result.error) return result;
  return { ok: true, at: Date.now() };
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
  const confirmShortRoster =
    formData.get("confirm_short_roster") === "1" || formData.get("confirm_short_roster") === "true";
  await startDraftAction(leagueSlug, { confirmShortRoster });
}

/** FormData-only wrapper so draft page form has no closure (better RSC serialization). */
export async function makeDraftPickFromFormAction(formData: FormData): Promise<void> {
  const leagueSlug = (formData.get("league_slug") as string)?.trim();
  if (!leagueSlug) return;
  await makeDraftPickAction(leagueSlug, formData);
}

/** For useActionState: returns error so the make-pick form can display it. */
export async function makeDraftPickWithStateAction(
  _prev: { error?: string; ok?: boolean; at?: number },
  formData: FormData
): Promise<{ error?: string; ok?: boolean; at?: number }> {
  const leagueSlug = (formData.get("league_slug") as string)?.trim();
  if (!leagueSlug) return { error: "Missing league." };
  const result = await makeDraftPickAction(leagueSlug, formData);
  if (result.error) return result;
  return { ok: true, at: Date.now() };
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

/** Save a user's auto-draft preferences (optional priority_list 10+; strategy is fixed defaults). */
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
  const availableBigBoardIds = getAvailableBigBoardIdsForLeague({
    includeNxt: leagueIncludesNxt(league),
  });
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
  } else if (isAvailableBigBoardId(payload.priorityListSource, availableBigBoardIds)) {
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
  _prevState: { error?: string; redirectTo?: string } | null,
  formData: FormData
): Promise<{ error?: string; redirectTo?: string } | null> {
  const leagueSlug = (formData.get("league_slug") as string)?.trim();
  if (!leagueSlug) return { error: "League slug is required." };
  const { getLeagueBySlug } = await import("@/lib/leagues");
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };
  const availableBigBoardIds = getAvailableBigBoardIdsForLeague({
    includeNxt: leagueIncludesNxt(league),
  });
  const autopickRequiredPriorityCount = getAutopickRequiredPriorityCount(leagueIncludesNxt(league));

  const usesBigBoardPicker = league.draft_type === "autopick" || league.draft_type === "live";
  const rawListSource = (formData.get("list_source") as string)?.trim();
  const listSource = usesBigBoardPicker
    ? rawListSource === "custom" || isAvailableBigBoardId(rawListSource, availableBigBoardIds)
      ? rawListSource
      : availableBigBoardIds.includes("default")
        ? "default"
        : availableBigBoardIds[0] ?? "custom"
    : rawListSource || "custom";
  let priority_list: string[] = [];

  if (usesBigBoardPicker && isAvailableBigBoardId(listSource, availableBigBoardIds)) {
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
  if (league.draft_type === "autopick" && listSource === "custom" && priority_list.length < autopickRequiredPriorityCount) {
    return {
      error: `Autopick needs at least ${autopickRequiredPriorityCount} wrestlers on your list (currently ${priority_list.length}).`,
    };
  }
  const priorityListSource =
    listSource === "custom" || isAvailableBigBoardId(listSource, availableBigBoardIds)
      ? listSource
      : "custom";

  const result = await saveDraftPreferencesAction(leagueSlug, {
    priority_list,
    priorityListSource,
  });
  if (result.error) return { error: result.error };

  if (formData.get("from_onboarding") === "1") {
    const { completeLeagueOnboardingAction } = await import("../onboarding/actions");
    const done = await completeLeagueOnboardingAction(leagueSlug);
    if (done.error) return { error: done.error };
    return { redirectTo: done.redirectTo ?? `/leagues/${leagueSlug}` };
  }

  return null;
}

/** Lightweight pick sync so every browser updates without a manual refresh or a websocket. */
export async function syncLiveDraftRoomAction(leagueSlug: string): Promise<{
  error?: string;
  picks: {
    overall_pick: number;
    user_id: string;
    wrestler_id: string;
    wrestler_name: string | null;
    picked_at: string;
  }[];
  slot: number | null;
  pickerId: string | null;
  startedAt: string | null;
  status: string;
  viewerAutoPick: boolean;
}> {
  const empty = { picks: [], slot: null, pickerId: null, startedAt: null, status: "not_started", viewerAutoPick: false };
  const slug = leagueSlug.trim();
  if (!slug) return { ...empty, error: "Missing league." };
  const { getLeagueBySlug } = await import("@/lib/leagues");
  const { getDraftPicksHistory, getLeagueDraftState, getCurrentPick } = await import("@/lib/leagueDraft");
  const league = await getLeagueBySlug(slug);
  if (!league || league.draft_type !== "live") return { ...empty, error: "Not a live draft." };
  const { user } = await getServerAuth();
  const [picks, state, current, viewerAutoPick] = await Promise.all([
    getDraftPicksHistory(league.id),
    getLeagueDraftState(league.id),
    getCurrentPick(league.id),
    user ? getViewerLiveAutoPick(league.id, user.id) : Promise.resolve(false),
  ]);
  return {
    picks: picks.map((pick) => ({
      overall_pick: pick.overall_pick,
      user_id: pick.user_id,
      wrestler_id: pick.wrestler_id,
      wrestler_name: pick.wrestler_name,
      picked_at: pick.picked_at,
    })),
    slot: state?.draft_status === "in_progress" ? (current?.overall_pick ?? state.draft_current_pick) : null,
    pickerId: state?.draft_status === "in_progress" ? (current?.user_id ?? null) : null,
    startedAt: state?.draft_current_pick_started_at ?? null,
    status: state?.draft_status ?? "not_started",
    viewerAutoPick,
  };
}

/** One live-draft autopick after the server clock for this turn hits zero. Does not reload the draft page. */
export async function expireLiveDraftClockAction(leagueSlug: string): Promise<{
  didAutoPick: boolean;
  error?: string;
  startedAt?: string;
  secondsRemaining?: number;
  retry?: boolean;
  pick?: { overall_pick: number; user_id: string; wrestler_id: string; picked_at: string };
  picks?: { overall_pick: number; user_id: string; wrestler_id: string; picked_at: string }[];
  nextStartedAt?: string | null;
  nextSlot?: number | null;
  draftStatus?: string;
  viewerAutoPick?: boolean;
}> {
  const slug = leagueSlug.trim();
  if (!slug) return { didAutoPick: false };
  const { supabase, user } = await getServerAuth();
  if (!user) return { didAutoPick: false, error: "Not authenticated" };

  const { getLeagueBySlug } = await import("@/lib/leagues");
  const league = await getLeagueBySlug(slug);
  if (!league || league.draft_type !== "live") return { didAutoPick: false };

  const { data: member } = await supabase
    .from("league_members")
    .select("user_id")
    .eq("league_id", league.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member && !(await getIsSiteAdmin())) {
    return { didAutoPick: false, error: "Not a league member." };
  }

  const result = await runLiveDraftClockIfExpired(league.id);
  const viewerAutoPick = await getViewerLiveAutoPick(league.id, user.id);
  return { ...result, viewerAutoPick };
}

/** Turn rest-of-draft auto-pick on or off. Turning it on takes the current turn immediately when it is yours. */
export async function setLiveDraftAutoPickAction(
  leagueSlug: string,
  enabled: boolean
): Promise<{
  enabled: boolean;
  didAutoPick: boolean;
  error?: string;
  pick?: { overall_pick: number; user_id: string; wrestler_id: string; picked_at: string };
  picks?: { overall_pick: number; user_id: string; wrestler_id: string; picked_at: string }[];
  nextStartedAt?: string | null;
  nextSlot?: number | null;
  draftStatus?: string;
}> {
  const slug = leagueSlug.trim();
  if (!slug) return { enabled, didAutoPick: false, error: "Missing league." };
  const { user } = await getServerAuth();
  if (!user) return { enabled, didAutoPick: false, error: "Not authenticated" };

  const { getLeagueBySlug } = await import("@/lib/leagues");
  const league = await getLeagueBySlug(slug);
  if (!league || league.draft_type !== "live") {
    return { enabled, didAutoPick: false, error: "Not a live draft." };
  }
  if (league.draft_status !== "in_progress") {
    return { enabled, didAutoPick: false, error: "The draft is not in progress." };
  }

  const saved = await setLiveDraftAutoPick(league.id, user.id, enabled);
  if (saved.error) return { enabled: !enabled, didAutoPick: false, error: saved.error };
  if (!enabled) return { enabled: false, didAutoPick: false };

  const result = await runLiveDraftClockIfExpired(league.id);
  return { ...result, enabled: true };
}

/** Keep a live-draft queue in sync with the clock. Any length is allowed, including empty. */
export async function saveLiveDraftQueueAction(
  leagueId: string,
  priorityList: string[]
): Promise<{ error?: string }> {
  const { supabase, user } = await getServerAuth();
  if (!user) return { error: "Not authenticated" };
  const cleaned = priorityList.map((id) => id.trim()).filter(Boolean);
  const { data: existing, error: readError } = await supabase
    .from("league_draft_preferences")
    .select("strategy, strategy_options")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError) return { error: readError.message };
  const payload: Record<string, unknown> = {
    league_id: leagueId,
    user_id: user.id,
    priority_list: JSON.stringify(cleaned),
    strategy: (existing as { strategy?: unknown } | null)?.strategy ?? [],
    updated_at: new Date().toISOString(),
  };
  const options = (existing as { strategy_options?: unknown } | null)?.strategy_options;
  if (options != null) payload.strategy_options = options;
  const { error } = await supabase
    .from("league_draft_preferences")
    .upsert(payload, { onConflict: "league_id,user_id" });
  if (error) return { error: error.message };
  return {};
}
