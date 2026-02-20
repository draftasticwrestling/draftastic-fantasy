/**
 * Private Leagues: draft order generation (snake/linear), current pick, and making a pick.
 */

import { createClient } from "@/lib/supabase/server";
import { getLeagueMembers } from "@/lib/leagues";
import { getRosterRulesForLeague } from "@/lib/leagueStructure";
import { addWrestlerToRoster } from "@/lib/leagues";

export type DraftOrderEntry = {
  overall_pick: number;
  user_id: string;
  round: number;
  pick_in_round: number;
};

/**
 * Get the full draft order for a league. Empty if not generated yet.
 */
export async function getDraftOrder(
  leagueId: string
): Promise<{ overall_pick: number; user_id: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("league_draft_order")
    .select("overall_pick, user_id")
    .eq("league_id", leagueId)
    .order("overall_pick", { ascending: true });

  if (error) return [];
  return (data ?? []) as { overall_pick: number; user_id: string }[];
}

/**
 * Get league draft state: status and current pick (whose turn).
 */
export async function getLeagueDraftState(leagueId: string): Promise<{
  draft_status: "not_started" | "in_progress" | "completed";
  draft_current_pick: number | null;
  draft_style: "snake" | "linear";
  total_picks: number;
} | null> {
  const supabase = await createClient();
  const { data: league, error } = await supabase
    .from("leagues")
    .select("draft_status, draft_current_pick, draft_style")
    .eq("id", leagueId)
    .maybeSingle();

  if (error || !league) return null;

  const { count } = await supabase
    .from("league_draft_order")
    .select("*", { count: "exact", head: true })
    .eq("league_id", leagueId);

  return {
    draft_status: (league.draft_status ?? "not_started") as "not_started" | "in_progress" | "completed",
    draft_current_pick: league.draft_current_pick ?? null,
    draft_style: (league.draft_style ?? "snake") as "snake" | "linear",
    total_picks: count ?? 0,
  };
}

/**
 * Get the current pick (whose turn) and pick number. Returns null if draft not started or completed.
 */
export async function getCurrentPick(
  leagueId: string
): Promise<{ overall_pick: number; user_id: string } | null> {
  const supabase = await createClient();
  const { data: league } = await supabase
    .from("leagues")
    .select("draft_current_pick, draft_status")
    .eq("id", leagueId)
    .single();

  if (!league || league.draft_status !== "in_progress" || league.draft_current_pick == null) {
    return null;
  }

  const { data: row } = await supabase
    .from("league_draft_order")
    .select("overall_pick, user_id")
    .eq("league_id", leagueId)
    .eq("overall_pick", league.draft_current_pick)
    .maybeSingle();

  if (!row) return null;
  return row as { overall_pick: number; user_id: string };
}

/**
 * Fisher-Yates shuffle.
 */
function shuffle<T>(array: T[]): T[] {
  const out = [...array];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Generate draft order (commissioner only). Uses league members and roster size; snake or linear from league.draft_style.
 */
export async function generateDraftOrder(leagueId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: league } = await supabase
    .from("leagues")
    .select("id, commissioner_id, draft_style")
    .eq("id", leagueId)
    .single();

  if (!league || league.commissioner_id !== user.id) {
    return { error: "Only the commissioner can generate draft order." };
  }

  const members = await getLeagueMembers(leagueId);
  const rules = getRosterRulesForLeague(members.length);
  if (!rules) return { error: "League size must be 3–12 teams to generate draft order." };

  const numRounds = rules.rosterSize;
  const memberIds = members.map((m) => m.user_id);
  const snake = (league.draft_style ?? "snake") === "snake";

  // Round 1 order is randomized; snake reverses every even round.
  const round1Order = shuffle(memberIds);
  const order: { overall_pick: number; user_id: string }[] = [];
  let overall = 0;
  for (let round = 1; round <= numRounds; round++) {
    const roundOrder = snake && round % 2 === 0 ? [...round1Order].reverse() : round1Order;
    for (const uid of roundOrder) {
      overall++;
      order.push({ overall_pick: overall, user_id: uid });
    }
  }

  await supabase.from("league_draft_order").delete().eq("league_id", leagueId);

  const { error: insertError } = await supabase.from("league_draft_order").insert(
    order.map((o) => ({ league_id: leagueId, overall_pick: o.overall_pick, user_id: o.user_id }))
  );
  if (insertError) return { error: insertError.message };

  const { error: updateError } = await supabase
    .from("leagues")
    .update({ draft_status: "in_progress", draft_current_pick: 1 })
    .eq("id", leagueId);

  if (updateError) return { error: updateError.message };
  return {};
}

/**
 * Make the current pick (add wrestler to current picker's roster and advance). Caller must be the current picker or commissioner.
 */
export async function makeDraftPick(
  leagueId: string,
  wrestlerId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const current = await getCurrentPick(leagueId);
  if (!current) return { error: "No draft in progress or no current pick." };

  const { data: league } = await supabase
    .from("leagues")
    .select("id, commissioner_id")
    .eq("id", leagueId)
    .single();

  if (!league) return { error: "League not found." };
  const isCommissioner = league.commissioner_id === user.id;
  if (current.user_id !== user.id && !isCommissioner) {
    return { error: "It's not your turn to pick." };
  }

  const addResult = await addWrestlerToRoster(leagueId, current.user_id, wrestlerId);
  if (addResult.error) return addResult;

  const state = await getLeagueDraftState(leagueId);
  const nextPick = (state?.draft_current_pick ?? 0) + 1;
  const totalPicks = state?.total_picks ?? 0;

  const updates: { draft_current_pick: number | null; draft_status: string } =
    nextPick > totalPicks
      ? { draft_current_pick: null, draft_status: "completed" }
      : { draft_current_pick: nextPick, draft_status: "in_progress" };

  const { error: updateError } = await supabase
    .from("leagues")
    .update(updates)
    .eq("id", leagueId);

  if (updateError) return { error: updateError.message };
  return {};
}
