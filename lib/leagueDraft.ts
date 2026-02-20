/**
 * Private Leagues: draft order generation (snake/linear), current pick, and making a pick.
 */

import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getLeagueMembers, getRostersForLeague } from "@/lib/leagues";
import { getRosterRulesForLeague } from "@/lib/leagueStructure";
import { addWrestlerToRoster } from "@/lib/leagues";
import { aggregateWrestlerPoints } from "@/lib/scoring/aggregateWrestlerPoints.js";

const LEAGUE_START_DATE = "2025-05-02";
const AUTO_PICK_DEADLINE_SECONDS = 2 * 60;

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
 * Tolerates missing draft_current_pick_started_at column (pre-migration).
 */
export async function getLeagueDraftState(leagueId: string): Promise<{
  draft_status: "not_started" | "in_progress" | "completed";
  draft_current_pick: number | null;
  draft_style: "snake" | "linear";
  total_picks: number;
  draft_current_pick_started_at: string | null;
} | null> {
  const supabase = await createClient();
  let league: { draft_status?: string; draft_current_pick?: number | null; draft_style?: string; draft_current_pick_started_at?: string | null } | null = null;
  let err: { code?: string } | null = null;

  const full = await supabase
    .from("leagues")
    .select("draft_status, draft_current_pick, draft_style, draft_current_pick_started_at")
    .eq("id", leagueId)
    .maybeSingle();
  if (full.error) {
    err = full.error;
    if (full.error.code === "42703" || full.error.message?.includes("column")) {
      const fallback = await supabase
        .from("leagues")
        .select("draft_status, draft_current_pick, draft_style")
        .eq("id", leagueId)
        .maybeSingle();
      if (fallback.data) league = { ...fallback.data, draft_current_pick_started_at: null };
    }
  } else {
    league = full.data;
  }
  if (err && !league) return null;
  if (!league) return null;

  const { count } = await supabase
    .from("league_draft_order")
    .select("*", { count: "exact", head: true })
    .eq("league_id", leagueId);

  return {
    draft_status: (league.draft_status ?? "not_started") as "not_started" | "in_progress" | "completed",
    draft_current_pick: league.draft_current_pick ?? null,
    draft_style: (league.draft_style ?? "snake") as "snake" | "linear",
    total_picks: count ?? 0,
    draft_current_pick_started_at: league.draft_current_pick_started_at ?? null,
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

  const updatePayload = {
    draft_status: "in_progress",
    draft_current_pick: 1,
    draft_current_pick_started_at: new Date().toISOString(),
  };
  const admin = getAdminClient();
  const { error: updateError } = admin
    ? await admin.from("leagues").update(updatePayload).eq("id", leagueId)
    : await supabase.from("leagues").update(updatePayload).eq("id", leagueId);
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

  const addResult = await addWrestlerToRoster(leagueId, current.user_id, wrestlerId, null, true);
  if (addResult.error) return addResult;

  const state = await getLeagueDraftState(leagueId);
  const nextPick = (state?.draft_current_pick ?? 0) + 1;
  const totalPicks = state?.total_picks ?? 0;

  const admin = getAdminClient();
  if (!admin) {
    return {
      error:
        "Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is not set. Draft picks need this. Add it in .env and Netlify environment variables.",
    };
  }

  const { error: pickErr } = await admin.from("league_draft_picks").insert({
    league_id: leagueId,
    overall_pick: current.overall_pick,
    user_id: current.user_id,
    wrestler_id: wrestlerId,
  });
  if (pickErr) return { error: pickErr.message };

  const updates: {
    draft_current_pick: number | null;
    draft_status: string;
    draft_current_pick_started_at?: string;
  } =
    nextPick > totalPicks
      ? { draft_current_pick: null, draft_status: "completed" }
      : {
          draft_current_pick: nextPick,
          draft_status: "in_progress",
          draft_current_pick_started_at: new Date().toISOString(),
        };
  const { error: updateError } = await admin.from("leagues").update(updates).eq("id", leagueId);
  if (updateError) return { error: updateError.message };
  return {};
}

/** Draft pick history for display (who picked which wrestler at each slot). */
export async function getDraftPicksHistory(
  leagueId: string
): Promise<
  { overall_pick: number; user_id: string; wrestler_id: string; wrestler_name: string | null; picked_at: string }[]
> {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("league_draft_picks")
    .select("overall_pick, user_id, wrestler_id, picked_at")
    .eq("league_id", leagueId)
    .order("overall_pick", { ascending: true });

  if (error) return []; /* table may not exist yet (migration not run) */
  if (!rows?.length) return [];

  const wrestlerIds = [...new Set(rows.map((r) => r.wrestler_id))];
  const { data: wrestlers } = await supabase
    .from("wrestlers")
    .select("id, name")
    .in("id", wrestlerIds);
  const nameById: Record<string, string | null> = {};
  for (const w of wrestlers ?? []) nameById[w.id] = w.name ?? null;

  return (rows as { overall_pick: number; user_id: string; wrestler_id: string; picked_at: string }[]).map(
    (r) => ({
      overall_pick: r.overall_pick,
      user_id: r.user_id,
      wrestler_id: r.wrestler_id,
      wrestler_name: nameById[r.wrestler_id] ?? null,
      picked_at: r.picked_at,
    })
  );
}

/**
 * Returns the available wrestler with the most points to-date (for auto-pick).
 * Uses completed events from LEAGUE_START_DATE; wrestler id is used as slug for points.
 */
export async function getTopAvailableWrestlerByPoints(leagueId: string): Promise<string | null> {
  const supabase = await createClient();
  const rosters = await getRostersForLeague(leagueId);
  const draftedIds = new Set<string>();
  for (const entries of Object.values(rosters)) for (const e of entries) draftedIds.add(e.wrestler_id);

  const [{ data: events }, { data: wrestlers }] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, date, matches")
      .eq("status", "completed")
      .gte("date", LEAGUE_START_DATE)
      .order("date", { ascending: true }),
    supabase.from("wrestlers").select("id").order("id"),
  ]);

  const pointsBySlug = aggregateWrestlerPoints((events ?? []) as { id: string; name: string; date: string; matches?: object[] }[]);
  const list = (wrestlers ?? []) as { id: string }[];
  let bestId: string | null = null;
  let bestTotal = -1;
  for (const w of list) {
    if (draftedIds.has(w.id)) continue;
    const p = pointsBySlug[w.id] ?? { rsPoints: 0, plePoints: 0, beltPoints: 0 };
    const total = p.rsPoints + p.plePoints + p.beltPoints;
    if (total > bestTotal) {
      bestTotal = total;
      bestId = w.id;
    }
  }
  return bestId;
}

/**
 * If the current pick has exceeded the 2-minute limit, perform an auto-pick (highest points available) and advance.
 * Uses service role. Returns { didAutoPick: true } if an auto-pick was made (caller should revalidate/redirect).
 */
export async function runAutoPickIfExpired(leagueId: string): Promise<{ didAutoPick: boolean; error?: string }> {
  const state = await getLeagueDraftState(leagueId);
  if (!state || state.draft_status !== "in_progress" || state.draft_current_pick == null) {
    return { didAutoPick: false };
  }
  const startedAt = state.draft_current_pick_started_at;
  if (!startedAt) return { didAutoPick: false };

  const deadline = new Date(startedAt).getTime() + AUTO_PICK_DEADLINE_SECONDS * 1000;
  if (Date.now() < deadline) return { didAutoPick: false };

  const current = await getCurrentPick(leagueId);
  if (!current) return { didAutoPick: false };

  const wrestlerId = await getTopAvailableWrestlerByPoints(leagueId);
  if (!wrestlerId) return { didAutoPick: false, error: "No available wrestler for auto-pick." };

  const admin = getAdminClient();
  if (!admin) return { didAutoPick: false, error: "SUPABASE_SERVICE_ROLE_KEY not set." };

  const members = await getLeagueMembers(leagueId);
  const rules = getRosterRulesForLeague(members.length);
  if (!rules) return { didAutoPick: false, error: "Invalid league size." };

  const { data: currentRows } = await admin
    .from("league_rosters")
    .select("wrestler_id")
    .eq("league_id", leagueId)
    .eq("user_id", current.user_id);
  const currentIds = (currentRows ?? []).map((r: { wrestler_id: string }) => r.wrestler_id);
  if (currentIds.includes(wrestlerId)) return { didAutoPick: false, error: "Wrestler already on roster." };
  if (currentIds.length >= rules.rosterSize) return { didAutoPick: false, error: "Roster full." };

  const { error: rosterErr } = await admin.from("league_rosters").insert({
    league_id: leagueId,
    user_id: current.user_id,
    wrestler_id: wrestlerId,
    contract: null,
  });
  if (rosterErr) return { didAutoPick: false, error: rosterErr.message };

  const nextPick = (state.draft_current_pick ?? 0) + 1;
  const totalPicks = state.total_picks ?? 0;
  const updates: {
    draft_current_pick: number | null;
    draft_status: string;
    draft_current_pick_started_at?: string;
  } =
    nextPick > totalPicks
      ? { draft_current_pick: null, draft_status: "completed" }
      : {
          draft_current_pick: nextPick,
          draft_status: "in_progress",
          draft_current_pick_started_at: new Date().toISOString(),
        };

  const { error: pickErr } = await admin.from("league_draft_picks").insert({
    league_id: leagueId,
    overall_pick: current.overall_pick,
    user_id: current.user_id,
    wrestler_id: wrestlerId,
  });
  if (pickErr) return { didAutoPick: false, error: pickErr.message };

  const { error: updateError } = await admin.from("leagues").update(updates).eq("id", leagueId);
  if (updateError) return { didAutoPick: false, error: updateError.message };
  return { didAutoPick: true };
}

/**
 * Restart draft: clear all picks, rosters, and draft order; set draft to not_started.
 * Caller must verify commissioner. Uses service role.
 */
export async function restartDraft(leagueId: string): Promise<{ error?: string }> {
  const admin = getAdminClient();
  if (!admin) return { error: "SUPABASE_SERVICE_ROLE_KEY not set." };

  const { error: picksErr } = await admin.from("league_draft_picks").delete().eq("league_id", leagueId);
  if (picksErr) return { error: picksErr.message };
  const { error: rostersErr } = await admin.from("league_rosters").delete().eq("league_id", leagueId);
  if (rostersErr) return { error: rostersErr.message };
  const { error: orderErr } = await admin.from("league_draft_order").delete().eq("league_id", leagueId);
  if (orderErr) return { error: orderErr.message };
  const { error: updateErr } = await admin
    .from("leagues")
    .update({
      draft_status: "not_started",
      draft_current_pick: null,
      draft_current_pick_started_at: null,
    })
    .eq("id", leagueId);
  if (updateErr) return { error: updateErr.message };
  return {};
}

/**
 * Undo the last pick: remove that wrestler from the picker's roster, delete the pick record, and set current pick back.
 * Caller must verify commissioner. Uses service role.
 */
export async function clearLastPick(leagueId: string): Promise<{ error?: string }> {
  const admin = getAdminClient();
  if (!admin) return { error: "SUPABASE_SERVICE_ROLE_KEY not set." };

  const { data: lastRow, error: lastErr } = await admin
    .from("league_draft_picks")
    .select("overall_pick, user_id, wrestler_id")
    .eq("league_id", leagueId)
    .order("overall_pick", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastErr || !lastRow) return { error: "No pick to clear." };

  const { error: rosterErr } = await admin
    .from("league_rosters")
    .delete()
    .eq("league_id", leagueId)
    .eq("user_id", lastRow.user_id)
    .eq("wrestler_id", lastRow.wrestler_id);
  if (rosterErr) return { error: rosterErr.message };

  const { error: pickErr } = await admin
    .from("league_draft_picks")
    .delete()
    .eq("league_id", leagueId)
    .eq("overall_pick", lastRow.overall_pick);
  if (pickErr) return { error: pickErr.message };

  const prevPick = lastRow.overall_pick - 1;
  const updates =
    prevPick < 1
      ? { draft_current_pick: 1, draft_status: "in_progress", draft_current_pick_started_at: new Date().toISOString() }
      : { draft_current_pick: prevPick, draft_status: "in_progress", draft_current_pick_started_at: new Date().toISOString() };
  const { error: updateErr } = await admin.from("leagues").update(updates).eq("id", leagueId);
  if (updateErr) return { error: updateErr.message };
  return {};
}
