/**
 * Private Leagues: draft order generation (snake/linear), current pick, and making a pick.
 */

import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getLeagueMembers, getRostersForLeague } from "@/lib/leagues";
import { getRosterRulesForLeague } from "@/lib/leagueStructure";
import { isBlocklistedSlug } from "@/lib/draftBlocklist";
import { addWrestlerToRoster } from "@/lib/leagues";
import { aggregateWrestlerPoints } from "@/lib/scoring/aggregateWrestlerPoints.js";

const LEAGUE_START_DATE = "2025-05-02";
const DEFAULT_TIME_PER_PICK_SECONDS = 2 * 60;
const CONSECUTIVE_AUTO_PICKS_BEFORE_TAKEOVER = 3;

/** Strategy keys for auto-draft when priority list does not apply (legacy). */
export const DRAFT_STRATEGY_KEYS = [
  "prioritize_rs",
  "prioritize_ple",
  "prioritize_belt",
  "balance_brands",
  "prioritize_high_female",
  "prioritize_high_male",
] as const;
export type DraftStrategyKey = (typeof DRAFT_STRATEGY_KEYS)[number];

export type DraftFocus = "2026" | "2025" | "all";
export type DraftPointStrategy = "total" | "rs" | "ple" | "belt";
export type DraftWrestlerStrategy =
  | "best_available"
  | "balanced_gender"
  | "balanced_brands"
  | "high_males"
  | "high_females";

export type DraftStrategyOptions = {
  focus: DraftFocus;
  pointStrategy: DraftPointStrategy;
  wrestlerStrategy: DraftWrestlerStrategy;
};

export type DraftPreferences = {
  priority_list: string[];
  strategy: string[];
  strategy_options?: DraftStrategyOptions | null;
};

export const MIN_PRIORITY_LIST = 10;
export const MAX_PRIORITY_LIST = 50;

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
 * Get a user's draft preferences for a league. Returns null if none set.
 * Tolerates missing strategy_options column (pre-migration).
 */
export async function getDraftPreferences(
  leagueId: string,
  userId: string
): Promise<DraftPreferences | null> {
  const supabase = await createClient();
  let result = await supabase
    .from("league_draft_preferences")
    .select("priority_list, strategy, strategy_options")
    .eq("league_id", leagueId)
    .eq("user_id", userId)
    .maybeSingle();
  if (result.error && (result.error.code === "42703" || result.error.message?.includes("strategy_options"))) {
    result = await supabase
      .from("league_draft_preferences")
      .select("priority_list, strategy")
      .eq("league_id", leagueId)
      .eq("user_id", userId)
      .maybeSingle();
  }
  if (result.error || !result.data) return null;
  const data = result.data as { priority_list?: unknown; strategy?: unknown; strategy_options?: unknown };
  let list: string[] = [];
  if (Array.isArray(data.priority_list)) {
    list = data.priority_list as string[];
  } else if (typeof data.priority_list === "string") {
    try {
      const parsed = JSON.parse(data.priority_list) as unknown;
      list = Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      list = [];
    }
  }
  const strategy = Array.isArray(data.strategy) ? data.strategy : [];
  let strategy_options: DraftStrategyOptions | null | undefined = data.strategy_options as DraftStrategyOptions | null | undefined;
  if (typeof strategy_options === "string") {
    try {
      const parsed = JSON.parse(strategy_options) as unknown;
      strategy_options = (parsed && typeof parsed === "object" && "focus" in parsed) ? (parsed as DraftStrategyOptions) : null;
    } catch {
      strategy_options = null;
    }
  }
  return {
    priority_list: list as string[],
    strategy: strategy as string[],
    strategy_options: strategy_options ?? null,
  };
}

/**
 * Save draft preferences. When strategy_options is set, priority_list can be empty (0-50). Otherwise priority_list must be 10-50.
 */
export async function setDraftPreferences(
  leagueId: string,
  userId: string,
  prefs: {
    priority_list?: string[];
    strategy?: string[];
    strategy_options?: DraftStrategyOptions | null;
  }
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== userId) return { error: "Not authenticated" };

  const list = prefs.priority_list ?? [];
  const strategyOpts = prefs.strategy_options;
  if (list.length > 0 && (list.length < MIN_PRIORITY_LIST || list.length > MAX_PRIORITY_LIST)) {
    return { error: `Preferred wrestlers list must have between ${MIN_PRIORITY_LIST} and ${MAX_PRIORITY_LIST} wrestlers when set.` };
  }

  const strategy = (prefs.strategy ?? []).filter((s) => DRAFT_STRATEGY_KEYS.includes(s as DraftStrategyKey));
  // Send priority_list as JSON string so jsonb column gets exact value (avoids client serialization quirks)
  const payload: Record<string, unknown> = {
    league_id: leagueId,
    user_id: userId,
    priority_list: JSON.stringify(list),
    strategy,
    updated_at: new Date().toISOString(),
  };
  if (strategyOpts) payload.strategy_options = strategyOpts;
  const { error } = await supabase
    .from("league_draft_preferences")
    .upsert(payload as object, { onConflict: "league_id,user_id" });
  if (error) return { error: error.message };
  return {};
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

type AdminClient = NonNullable<ReturnType<typeof getAdminClient>>;

/** Get per-user draft state (consecutive auto-picks, takeover). Uses admin client. */
async function getDraftUserState(
  admin: AdminClient,
  leagueId: string,
  userId: string
): Promise<{ consecutive_auto_picks: number; auto_pick_rest_of_draft: boolean }> {
  const { data: row } = await admin
    .from("league_draft_user_state")
    .select("consecutive_auto_picks, auto_pick_rest_of_draft")
    .eq("league_id", leagueId)
    .eq("user_id", userId)
    .maybeSingle();
  const r = row as { consecutive_auto_picks?: number; auto_pick_rest_of_draft?: boolean } | null;
  return {
    consecutive_auto_picks: r?.consecutive_auto_picks ?? 0,
    auto_pick_rest_of_draft: r?.auto_pick_rest_of_draft ?? false,
  };
}

/** After an auto-pick: increment consecutive_auto_picks and set auto_pick_rest_of_draft if >= 3. Uses admin. */
async function afterAutoPickIncrementState(admin: AdminClient, leagueId: string, userId: string): Promise<void> {
  const { data: existing } = await admin
    .from("league_draft_user_state")
    .select("consecutive_auto_picks")
    .eq("league_id", leagueId)
    .eq("user_id", userId)
    .maybeSingle();
  const prev = (existing as { consecutive_auto_picks?: number } | null)?.consecutive_auto_picks ?? 0;
  const next = prev + 1;
  await admin.from("league_draft_user_state").upsert(
    {
      league_id: leagueId,
      user_id: userId,
      consecutive_auto_picks: next,
      auto_pick_rest_of_draft: next >= CONSECUTIVE_AUTO_PICKS_BEFORE_TAKEOVER,
    },
    { onConflict: "league_id,user_id" }
  );
}

/** After a manual pick: reset consecutive_auto_picks for this user. Uses admin. */
async function afterManualPickResetState(admin: AdminClient, leagueId: string, userId: string): Promise<void> {
  await admin.from("league_draft_user_state").upsert(
    { league_id: leagueId, user_id: userId, consecutive_auto_picks: 0, auto_pick_rest_of_draft: false },
    { onConflict: "league_id,user_id" }
  );
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
 * Generate draft order (commissioner only). Uses league members and roster size; snake or linear from league draft_type/draft_style (League Settings).
 */
export async function generateDraftOrder(leagueId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: league } = await supabase
    .from("leagues")
    .select("id, commissioner_id, draft_style, draft_type")
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
  const draftType = (league as { draft_type?: string }).draft_type ?? league.draft_style;
  const snake = draftType !== "linear";

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
    draft_status: "not_started",
    draft_current_pick: null,
    draft_current_pick_started_at: null,
  };
  const admin = getAdminClient();
  const { error: updateError } = admin
    ? await admin.from("leagues").update(updatePayload).eq("id", leagueId)
    : await supabase.from("leagues").update(updatePayload).eq("id", leagueId);
  if (updateError) return { error: updateError.message };
  return {};
}

/**
 * Set draft order from round 1 order (commissioner only). Used when draft_order_method is manual_by_gm.
 * round1UserIds = ordered list of user_ids for round 1; full order is built using league roster size and snake/linear.
 */
export async function setDraftOrderFromRound1(
  leagueId: string,
  round1UserIds: string[]
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: league } = await supabase
    .from("leagues")
    .select("id, commissioner_id, draft_style, draft_type")
    .eq("id", leagueId)
    .single();

  if (!league || league.commissioner_id !== user.id) {
    return { error: "Only the commissioner can set draft order." };
  }

  const members = await getLeagueMembers(leagueId);
  const rules = getRosterRulesForLeague(members.length);
  if (!rules) return { error: "League size must be 3–12 teams to set draft order." };

  const memberIds = new Set(members.map((m) => m.user_id));
  if (round1UserIds.length !== memberIds.size) {
    return { error: "Round 1 order must include every league member exactly once." };
  }
  for (const uid of round1UserIds) {
    if (!memberIds.has(uid)) return { error: "Round 1 order includes a user who is not a league member." };
  }

  const numRounds = rules.rosterSize;
  const draftType = (league as { draft_type?: string }).draft_type ?? league.draft_style;
  const snake = draftType !== "linear";

  const order: { overall_pick: number; user_id: string }[] = [];
  let overall = 0;
  for (let round = 1; round <= numRounds; round++) {
    const roundOrder = snake && round % 2 === 0 ? [...round1UserIds].reverse() : round1UserIds;
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
    draft_status: "not_started",
    draft_current_pick: null,
    draft_current_pick_started_at: null,
  };
  const admin = getAdminClient();
  const { error: updateError } = admin
    ? await admin.from("leagues").update(updatePayload).eq("id", leagueId)
    : await supabase.from("leagues").update(updatePayload).eq("id", leagueId);
  if (updateError) return { error: updateError.message };
  return {};
}

/**
 * Start the draft (commissioner only). Sets draft in progress and first pick clock.
 */
export async function startDraft(leagueId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: league } = await supabase
    .from("leagues")
    .select("id, commissioner_id, draft_current_pick")
    .eq("id", leagueId)
    .single();
  if (!league || league.commissioner_id !== user.id) {
    return { error: "Only the commissioner can start the draft." };
  }

  const { count } = await supabase
    .from("league_draft_order")
    .select("*", { count: "exact", head: true })
    .eq("league_id", leagueId);
  if (!count || count === 0) return { error: "No draft order. Generate draft order first." };

  const admin = getAdminClient();
  const updatePayload = {
    draft_status: "in_progress",
    draft_current_pick: 1,
    draft_current_pick_started_at: new Date().toISOString(),
  };
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
    is_auto_pick: false,
  });
  if (pickErr) return { error: pickErr.message };

  await afterManualPickResetState(admin, leagueId, current.user_id);

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

type DraftPickRow = { overall_pick: number; user_id: string; wrestler_id: string; picked_at: string; is_auto_pick?: boolean };

/** Draft pick history for display (who picked which wrestler at each slot). */
export async function getDraftPicksHistory(
  leagueId: string
): Promise<
  { overall_pick: number; user_id: string; wrestler_id: string; wrestler_name: string | null; picked_at: string; is_auto_pick?: boolean }[]
> {
  const supabase = await createClient();
  let rows: DraftPickRow[] | null = null;
  let err: { code?: string; message?: string } | null = null;

  const withAuto = await supabase
    .from("league_draft_picks")
    .select("overall_pick, user_id, wrestler_id, picked_at, is_auto_pick")
    .eq("league_id", leagueId)
    .order("overall_pick", { ascending: true });

  if (withAuto.error && (withAuto.error.code === "42703" || withAuto.error.message?.includes("is_auto_pick"))) {
    const withoutAuto = await supabase
      .from("league_draft_picks")
      .select("overall_pick, user_id, wrestler_id, picked_at")
      .eq("league_id", leagueId)
      .order("overall_pick", { ascending: true });
    err = withoutAuto.error;
    rows = (withoutAuto.data ?? []).map((r) => ({ ...r, is_auto_pick: false }));
  } else {
    err = withAuto.error;
    rows = (withAuto.data ?? []) as DraftPickRow[];
  }

  if (err || !rows?.length) return [];

  const wrestlerIds = [...new Set(rows.map((r) => r.wrestler_id))];
  const { data: wrestlers } = await supabase
    .from("wrestlers")
    .select("id, name")
    .in("id", wrestlerIds);
  const nameById: Record<string, string | null> = {};
  for (const w of wrestlers ?? []) nameById[w.id] = w.name ?? null;

  return rows.map((r) => ({
    overall_pick: r.overall_pick,
    user_id: r.user_id,
    wrestler_id: r.wrestler_id,
    wrestler_name: nameById[r.wrestler_id] ?? null,
    picked_at: r.picked_at,
    is_auto_pick: r.is_auto_pick ?? false,
  }));
}

function normalizeGender(g: string | null | undefined): "F" | "M" | null {
  if (!g) return null;
  const l = String(g).toLowerCase();
  if (l === "female" || l === "f") return "F";
  if (l === "male" || l === "m") return "M";
  return null;
}

function normalizeBrand(b: string | null | undefined): string {
  if (!b?.trim()) return "Unassigned";
  const l = b.trim().toLowerCase();
  if (l === "raw") return "Raw";
  if (l === "smackdown" || l === "smack down") return "SmackDown";
  if (l === "nxt" || l.includes("nxt")) return "NXT";
  return "Unassigned";
}

/** Roster category from brand (matches WrestlerList + more). Non-draftable: Front Office, Celebrity Guests, Alumni. */
function rosterCategory(brand: string | null | undefined): string {
  if (!brand?.trim()) return "Unassigned";
  const l = brand.trim().toLowerCase();
  if (l === "raw") return "Raw";
  if (l === "smackdown" || l === "smack down") return "SmackDown";
  if (l === "nxt" || l.includes("nxt")) return "NXT";
  if (l === "celebrity guests" || l === "celebrity" || l === "celebrity guest" || l === "celebrity guests") return "Celebrity Guests";
  if (l === "alumni" || l === "legend" || l === "legends" || l === "hall of fame") return "Alumni";
  if (
    l === "managers" || l === "manager" || l === "gm" || l === "gms" || l === "head of creative" ||
    l === "announcers" || l === "announcer" || l === "commentary" || l === "commentator" || l === "commentators" ||
    l === "authority" || l === "authority figure" || l === "general manager" || l === "executive" || l === "executives" ||
    l === "chief content officer" || l === "cco" || l === "staff" || l === "wwe staff" || l === "backstage" ||
    l === "producer" || l === "producers" || l === "writer" || l === "creative" || l === "broadcast" ||
    l === "on-air personality" || l === "personality" || l === "broadcast team"
  ) return "Front Office";
  return "Other";
}

const NON_DRAFTABLE_CATEGORIES = ["Front Office", "Celebrity Guests", "Alumni"];

const NON_DRAFTABLE_STATUSES = ["inactive", "injured", "inj", "retired", "released", "suspended", "part-time", "part time"];

export type DraftPoolRow = { id?: string; status?: string | null; brand?: string | null; classification?: string | null };

const NON_DRAFTABLE_CLASSIFICATIONS = ["non-wrestlers", "alumni"];

/**
 * Normalize a wrestler row from the API so status/classification work whether the DB returns Status or status, Classification or classification.
 * Use this right after fetching wrestlers from Supabase so the rest of the code can rely on .status and .classification.
 */
export function normalizeWrestlerRowFromApi(row: Record<string, unknown>): DraftPoolRow {
  const statusVal = row.Status ?? row.status;
  const classificationVal = row.Classification ?? row.classification;
  return {
    id: row.id != null ? String(row.id) : undefined,
    status: statusVal != null && statusVal !== "" ? String(statusVal) : undefined,
    classification: classificationVal != null && classificationVal !== "" ? String(classificationVal) : undefined,
    brand: row.brand != null ? String(row.brand) : undefined,
  };
}

/** Statuses that exclude from draft pool (injured included so they don't appear in real drafts). */
const NON_DRAFTABLE_STATUSES_EXCLUDING_INJURED = ["inactive", "retired", "released", "suspended", "part-time", "part time"];

/**
 * Draftable if: not explicitly non-Active (exclude Alumni, Non-wrestlers when classification is set),
 * not injured/inactive/retired/part-time, not non-wrestler/alumni/celebrity (brand). Blocklist is backup.
 * Expects row.status and row.classification (use normalizeWrestlerRowFromApi after API fetch so API columns Status/Classification are normalized).
 */
export function isDraftableWrestler(row: DraftPoolRow): boolean {
  const classification = row.classification != null ? String(row.classification).trim().toLowerCase() : "";
  if (classification && NON_DRAFTABLE_CLASSIFICATIONS.includes(classification)) return false;
  const status = row.status != null ? String(row.status).trim().toLowerCase() : "";
  if (status && NON_DRAFTABLE_STATUSES.includes(status)) return false;
  const category = rosterCategory(row.brand);
  if (NON_DRAFTABLE_CATEGORIES.includes(category)) return false;
  if (isBlocklistedSlug(row.id)) return false;
  return true;
}

/**
 * Like isDraftableWrestler but allows injured/inj so they appear in Draft Testing table with injury badge.
 * Use only on the admin Draft Testing page.
 */
export function isDraftableWrestlerForDraftTesting(row: DraftPoolRow): boolean {
  const classification = row.classification != null ? String(row.classification).trim().toLowerCase() : "";
  if (classification && NON_DRAFTABLE_CLASSIFICATIONS.includes(classification)) return false;
  const status = row.status != null ? String(row.status).trim().toLowerCase() : "";
  if (status && NON_DRAFTABLE_STATUSES_EXCLUDING_INJURED.includes(status)) return false;
  const category = rosterCategory(row.brand);
  if (NON_DRAFTABLE_CATEGORIES.includes(category)) return false;
  if (isBlocklistedSlug(row.id)) return false;
  return true;
}

/**
 * Returns the available wrestler with the most points to-date (for auto-pick fallback).
 * Uses completed events from LEAGUE_START_DATE; excludes inactive and non-draftable (Front Office, etc.).
 */
export async function getTopAvailableWrestlerByPoints(leagueId: string): Promise<string | null> {
  const supabase = await createClient();
  const rosters = await getRostersForLeague(leagueId);
  const draftedIds = new Set<string>();
  for (const entries of Object.values(rosters)) for (const e of entries) draftedIds.add(e.wrestler_id);

  let wrestlersRes = await supabase.from("wrestlers").select('id, status, "Status", brand, classification, "Classification"').order("id");
  let list = ((wrestlersRes.data ?? []) as Record<string, unknown>[]).map((r) => ({ ...r, ...normalizeWrestlerRowFromApi(r) })) as DraftPoolRow[];
  if (wrestlersRes.error && !list.length) {
    const fallback = await supabase.from("wrestlers").select('id, status, "Status", brand, classification, "Classification"').order("id");
    list = ((fallback.data ?? []) as Record<string, unknown>[]).map((r) => ({ ...r, ...normalizeWrestlerRowFromApi(r) })) as DraftPoolRow[];
  }
  if (!list.length) {
    const noClassification = await supabase.from("wrestlers").select('id, status, "Status", brand').order("id");
    list = ((noClassification.data ?? []) as Record<string, unknown>[]).map((r) => ({ ...r, ...normalizeWrestlerRowFromApi(r) })) as DraftPoolRow[];
  }
  list = list.filter(isDraftableWrestler).filter((w): w is DraftPoolRow & { id: string } => Boolean(w.id));

  const eventsRes = await supabase
    .from("events")
    .select("id, name, date, matches")
    .eq("status", "completed")
    .gte("date", LEAGUE_START_DATE)
    .order("date", { ascending: true });
  const events = eventsRes.data ?? [];
  const pointsBySlug = aggregateWrestlerPoints(events as { id: string; name: string; date: string; matches?: object[] }[]);
  let bestId: string | null = null;
  let bestTotal = -1;
  for (const w of list) {
    if (!w.id || draftedIds.has(w.id)) continue;
    const p = pointsBySlug[w.id] ?? { rsPoints: 0, plePoints: 0, beltPoints: 0 };
    const total = p.rsPoints + p.plePoints + p.beltPoints;
    if (total > bestTotal) {
      bestTotal = total;
      bestId = w.id;
    }
  }
  return bestId;
}

type WrestlerWithStats = {
  id: string;
  gender: string | null;
  brand: string | null;
  rating2k: number;
  rsPoints: number;
  plePoints: number;
  beltPoints: number;
  totalPoints: number;
};

/**
 * Get the best available wrestler for a user's auto-pick: uses priority list first if set,
 * then strategy_options (focus + point strategy + wrestler strategy) or legacy strategy[], else highest total points.
 */
export async function getTopAvailableWrestlerForUser(
  leagueId: string,
  userId: string
): Promise<string | null> {
  const supabase = await createClient();
  const rosters = await getRostersForLeague(leagueId);
  const draftedIds = new Set<string>();
  for (const entries of Object.values(rosters)) for (const e of entries) draftedIds.add(e.wrestler_id);

  const prefs = await getDraftPreferences(leagueId, userId);

  if (prefs?.priority_list?.length) {
    for (const wid of prefs.priority_list) {
      if (wid && !draftedIds.has(wid)) return wid;
    }
  }

  type WrestlerRow = DraftPoolRow & { id: string; gender?: string | null; "2K26 rating"?: number | null; "2K25 rating"?: number | null };
  let wrestlers: WrestlerRow[] | null = null;
  const wrestlersRes = await supabase
    .from("wrestlers")
    .select('id, gender, brand, status, "Status", classification, "Classification", "2K26 rating", "2K25 rating"')
    .order("id");
  let rawWrestlers = wrestlersRes.data as (Record<string, unknown> & { id: string })[] | null;
  if (wrestlersRes.error && (!rawWrestlers || !rawWrestlers.length)) {
    const fallback = await supabase.from("wrestlers").select('id, gender, brand, status, "Status", classification, "Classification"').order("id");
    rawWrestlers = fallback.data as (Record<string, unknown> & { id: string })[] | null;
  }
  if (!rawWrestlers?.length) {
    const noClassification = await supabase.from("wrestlers").select('id, gender, brand, status, "Status"').order("id");
    rawWrestlers = noClassification.data as (Record<string, unknown> & { id: string })[] | null;
  }
  wrestlers = (rawWrestlers ?? []).map((w) => ({ ...w, ...normalizeWrestlerRowFromApi(w) })).filter(isDraftableWrestler) as WrestlerRow[];

  const currentRoster = rosters[userId] ?? [];
  const wrestlerById = new Map((wrestlers ?? []).map((x) => [x.id, x]));
  const rosterBrandCounts: Record<string, number> = { Raw: 0, SmackDown: 0, Unassigned: 0 };
  const rosterGenderCounts: Record<string, number> = { F: 0, M: 0 };
  for (const e of currentRoster) {
    const w = wrestlerById.get(e.wrestler_id);
    const b = normalizeBrand((w as { brand?: string | null } | undefined)?.brand);
    rosterBrandCounts[b] = (rosterBrandCounts[b] ?? 0) + 1;
    const g = normalizeGender((w as { gender?: string | null } | undefined)?.gender);
    if (g) rosterGenderCounts[g] = (rosterGenderCounts[g] ?? 0) + 1;
  }

  const members = await getLeagueMembers(leagueId);
  const rules = getRosterRulesForLeague(members.length);
  const currentFemale = rosterGenderCounts.F ?? 0;
  const currentMale = rosterGenderCounts.M ?? 0;
  const remainingPicks = rules ? rules.rosterSize - currentRoster.length : 0;
  const needFemale = rules ? Math.max(0, rules.minFemale - currentFemale) : 0;
  const needMale = rules ? Math.max(0, rules.minMale - currentMale) : 0;
  const requiredGender: "F" | "M" | null =
    rules && remainingPicks > 0
      ? needFemale > 0 && remainingPicks - 1 < needFemale
        ? "F"
        : needMale > 0 && remainingPicks - 1 < needMale
          ? "M"
          : null
      : null;

  const opts = prefs?.strategy_options;
  if (opts?.focus != null && opts?.pointStrategy != null && opts?.wrestlerStrategy != null) {
    const [events2025, events2026, eventsAll] = await Promise.all([
      supabase.from("events").select("id, name, date, matches").eq("status", "completed").gte("date", "2025-01-01").lte("date", "2025-12-31").order("date", { ascending: true }),
      supabase.from("events").select("id, name, date, matches").eq("status", "completed").gte("date", "2026-01-01").order("date", { ascending: true }),
      supabase.from("events").select("id, name, date, matches").eq("status", "completed").gte("date", "2025-01-01").order("date", { ascending: true }),
    ]);
    const pts2025 = aggregateWrestlerPoints((events2025.data ?? []) as { id: string; name: string; date: string; matches?: object[] }[]);
    const pts2026 = aggregateWrestlerPoints((events2026.data ?? []) as { id: string; name: string; date: string; matches?: object[] }[]);
    const ptsAll = aggregateWrestlerPoints((eventsAll.data ?? []) as { id: string; name: string; date: string; matches?: object[] }[]);
    const pointsByPeriod: Record<string, Record<string, { rsPoints: number; plePoints: number; beltPoints: number }>> = {
      "2026": pts2026,
      "2025": pts2025,
      all: ptsAll,
    };
    const pts = pointsByPeriod[opts.focus] ?? pts2026;
    const available: WrestlerWithStats[] = [];
    for (const w of wrestlers ?? []) {
      const row = w as { id: string; gender?: string | null; brand?: string | null; "2K26 rating"?: number | null; "2K25 rating"?: number | null };
      if (draftedIds.has(row.id)) continue;
      const p = pts[row.id] ?? { rsPoints: 0, plePoints: 0, beltPoints: 0 };
      const total = p.rsPoints + p.plePoints + p.beltPoints;
      const r26 = row["2K26 rating"];
      const r25 = row["2K25 rating"];
      const rating2k = (r26 != null ? Number(r26) : r25 != null ? Number(r25) : 0) || 0;
      available.push({
        id: row.id,
        gender: row.gender ?? null,
        brand: row.brand ?? null,
        rating2k,
        rsPoints: p.rsPoints,
        plePoints: p.plePoints,
        beltPoints: p.beltPoints,
        totalPoints: total,
      });
    }
    if (available.length === 0) return null;
    const hasPoints =
      opts.pointStrategy === "total"
        ? (w: WrestlerWithStats) => w.totalPoints > 0
        : opts.pointStrategy === "rs"
          ? (w: WrestlerWithStats) => w.rsPoints > 0
          : opts.pointStrategy === "ple"
            ? (w: WrestlerWithStats) => w.plePoints > 0
            : (w: WrestlerWithStats) => w.beltPoints > 0;
    const withPoints = available.filter(hasPoints);
    let baseAvailable = withPoints.length > 0 ? withPoints : available;
    const byPoints = [...baseAvailable];
    if (opts.pointStrategy === "total") byPoints.sort((a, b) => b.totalPoints - a.totalPoints);
    else if (opts.pointStrategy === "rs") byPoints.sort((a, b) => b.rsPoints - a.rsPoints);
    else if (opts.pointStrategy === "ple") byPoints.sort((a, b) => b.plePoints - a.plePoints);
    else byPoints.sort((a, b) => b.beltPoints - a.beltPoints);
    const significantCount = Math.max(1, Math.ceil(byPoints.length * 0.5));
    const significant = byPoints.slice(0, significantCount);
    baseAvailable = significant.length > 0 ? significant : baseAvailable;
    let pool = baseAvailable;
    if (requiredGender) {
      const byGender = baseAvailable.filter((w) => normalizeGender(w.gender) === requiredGender);
      if (byGender.length > 0) pool = byGender;
    }
    let sorted = [...pool];
    if (opts.pointStrategy === "total") sorted.sort((a, b) => b.totalPoints - a.totalPoints);
    else if (opts.pointStrategy === "rs") sorted.sort((a, b) => b.rsPoints - a.rsPoints);
    else if (opts.pointStrategy === "ple") sorted.sort((a, b) => b.plePoints - a.plePoints);
    else if (opts.pointStrategy === "belt") sorted.sort((a, b) => b.beltPoints - a.beltPoints);
    if (opts.wrestlerStrategy === "best_available") return sorted[0]?.id ?? null;
    if (opts.wrestlerStrategy === "balanced_gender") {
      sorted.sort((a, b) => {
        const gA = normalizeGender(a.gender);
        const gB = normalizeGender(b.gender);
        const cA = gA ? rosterGenderCounts[gA] ?? 0 : 0;
        const cB = gB ? rosterGenderCounts[gB] ?? 0 : 0;
        if (cA !== cB) return cA - cB;
        return b.totalPoints - a.totalPoints;
      });
      return sorted[0]?.id ?? null;
    }
    if (opts.wrestlerStrategy === "balanced_brands") {
      sorted.sort((a, b) => {
        const brandA = normalizeBrand(a.brand);
        const brandB = normalizeBrand(b.brand);
        const countA = rosterBrandCounts[brandA] ?? 0;
        const countB = rosterBrandCounts[brandB] ?? 0;
        if (countA !== countB) return countA - countB;
        return b.totalPoints - a.totalPoints;
      });
      return sorted[0]?.id ?? null;
    }
    if (opts.wrestlerStrategy === "high_males") {
      const male = sorted.filter((w) => normalizeGender(w.gender) === "M");
      const pool = male.length > 0 ? male : sorted;
      pool.sort((a, b) => b.totalPoints * 1.2 - a.totalPoints * 1.2);
      return pool[0]?.id ?? null;
    }
    if (opts.wrestlerStrategy === "high_females") {
      const female = sorted.filter((w) => normalizeGender(w.gender) === "F");
      const pool = female.length > 0 ? female : sorted;
      pool.sort((a, b) => b.totalPoints * 1.2 - a.totalPoints * 1.2);
      return pool[0]?.id ?? null;
    }
    return sorted[0]?.id ?? null;
  }

  const eventsRes = await supabase
    .from("events")
    .select("id, name, date, matches")
    .eq("status", "completed")
    .gte("date", LEAGUE_START_DATE)
    .order("date", { ascending: true });
  const events = eventsRes.data;
  const pointsBySlug = aggregateWrestlerPoints((events ?? []) as { id: string; name: string; date: string; matches?: object[] }[]);
  const available: WrestlerWithStats[] = [];
  for (const w of wrestlers ?? []) {
    const row = w as { id: string; gender?: string | null; brand?: string | null; "2K26 rating"?: number | null; "2K25 rating"?: number | null };
    if (draftedIds.has(row.id)) continue;
    const p = pointsBySlug[row.id] ?? { rsPoints: 0, plePoints: 0, beltPoints: 0 };
    const total = p.rsPoints + p.plePoints + p.beltPoints;
    const r26 = row["2K26 rating"];
    const r25 = row["2K25 rating"];
    const rating2k = (r26 != null ? Number(r26) : r25 != null ? Number(r25) : 0) || 0;
    available.push({
      id: row.id,
      gender: row.gender ?? null,
      brand: row.brand ?? null,
      rating2k,
      rsPoints: p.rsPoints,
      plePoints: p.plePoints,
      beltPoints: p.beltPoints,
      totalPoints: total,
    });
  }
  if (available.length === 0) return null;

  let legacyPool = available;
  if (requiredGender) {
    const byGender = available.filter((w) => normalizeGender(w.gender) === requiredGender);
    if (byGender.length > 0) legacyPool = byGender;
  }

  const strategy = prefs?.strategy?.length ? prefs.strategy[0] : null;
  if (strategy === "prioritize_rs") {
    legacyPool.sort((a, b) => b.rsPoints - a.rsPoints);
    return legacyPool[0]?.id ?? null;
  }
  if (strategy === "prioritize_ple") {
    legacyPool.sort((a, b) => b.plePoints - a.plePoints);
    return legacyPool[0]?.id ?? null;
  }
  if (strategy === "prioritize_belt") {
    legacyPool.sort((a, b) => b.beltPoints - a.beltPoints);
    return legacyPool[0]?.id ?? null;
  }
  if (strategy === "balance_brands") {
    legacyPool.sort((a, b) => {
      const brandA = normalizeBrand(a.brand);
      const brandB = normalizeBrand(b.brand);
      const countA = rosterBrandCounts[brandA] ?? 0;
      const countB = rosterBrandCounts[brandB] ?? 0;
      if (countA !== countB) return countA - countB;
      return b.totalPoints - a.totalPoints;
    });
    return legacyPool[0]?.id ?? null;
  }
  if (strategy === "prioritize_high_female") {
    const female = legacyPool.filter((w) => normalizeGender(w.gender) === "F");
    const pool = female.length > 0 ? female : legacyPool;
    pool.sort((a, b) => b.rating2k - a.rating2k || b.totalPoints - a.totalPoints);
    return pool[0]?.id ?? null;
  }
  if (strategy === "prioritize_high_male") {
    const male = legacyPool.filter((w) => normalizeGender(w.gender) === "M");
    const pool = male.length > 0 ? male : legacyPool;
    pool.sort((a, b) => b.rating2k - a.rating2k || b.totalPoints - a.totalPoints);
    return pool[0]?.id ?? null;
  }

  legacyPool.sort((a, b) => b.totalPoints - a.totalPoints);
  return legacyPool[0]?.id ?? null;
}

/**
 * Perform one auto-pick for the current slot and advance. Returns next pick number and total for chaining.
 * Uses priority list first, then draft preferences. Records is_auto_pick and increments consecutive_auto_picks (sets takeover at 3).
 */
async function performOneAutoPick(
  admin: AdminClient,
  leagueId: string,
  current: { overall_pick: number; user_id: string },
  state: { draft_current_pick: number; total_picks: number }
): Promise<{ error?: string; nextPick?: number; totalPicks?: number }> {
  const wrestlerId = await getTopAvailableWrestlerForUser(leagueId, current.user_id);
  if (!wrestlerId) return { error: "No available wrestler for auto-pick." };

  const members = await getLeagueMembers(leagueId);
  const rules = getRosterRulesForLeague(members.length);
  if (!rules) return { error: "Invalid league size." };

  const { data: currentRows } = await admin
    .from("league_rosters")
    .select("wrestler_id")
    .eq("league_id", leagueId)
    .eq("user_id", current.user_id)
    .is("released_at", null);
  const currentIds = (currentRows ?? []).map((r: { wrestler_id: string }) => r.wrestler_id);
  if (currentIds.includes(wrestlerId)) return { error: "Wrestler already on roster." };
  if (currentIds.length >= rules.rosterSize) return { error: "Roster full." };

  const draftDate = new Date().toISOString().slice(0, 10);
  const { error: rosterErr } = await admin.from("league_rosters").insert({
    league_id: leagueId,
    user_id: current.user_id,
    wrestler_id: wrestlerId,
    contract: null,
    acquired_at: draftDate,
    released_at: null,
  });
  if (rosterErr) return { error: rosterErr.message };

  const nextPick = (state.draft_current_pick ?? 0) + 1;
  const totalPicks = state.total_picks ?? 0;

  const { error: pickErr } = await admin.from("league_draft_picks").insert({
    league_id: leagueId,
    overall_pick: current.overall_pick,
    user_id: current.user_id,
    wrestler_id: wrestlerId,
    is_auto_pick: true,
  });
  if (pickErr) return { error: pickErr.message };

  await afterAutoPickIncrementState(admin, leagueId, current.user_id);

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
  return { nextPick, totalPicks };
}

/**
 * If the current pick has exceeded the allotted time (or user is in "takeover" after 3 missed picks), perform auto-pick(s).
 * Uses priority list first, then draft preferences. If a user has missed 3 times in a row, system takes over and auto-picks
 * for them immediately for the rest of the draft (no timer wait). Uses service role.
 */
export async function runAutoPickIfExpired(leagueId: string): Promise<{ didAutoPick: boolean; error?: string }> {
  const admin = getAdminClient();
  if (!admin) return { didAutoPick: false, error: "SUPABASE_SERVICE_ROLE_KEY not set." };

  const state = await getLeagueDraftState(leagueId);
  if (!state || state.draft_status !== "in_progress" || state.draft_current_pick == null) {
    return { didAutoPick: false };
  }

  const current = await getCurrentPick(leagueId);
  if (!current) return { didAutoPick: false };

  const userState = await getDraftUserState(admin, leagueId, current.user_id);
  const timePerPickSeconds =
    (await (async () => {
      const supabase = await createClient();
      const { data: row } = await supabase.from("leagues").select("time_per_pick_seconds").eq("id", leagueId).maybeSingle();
      const sec = (row as { time_per_pick_seconds?: number } | null)?.time_per_pick_seconds;
      return sec != null && [30, 60, 90, 120, 150, 180].includes(sec) ? sec : DEFAULT_TIME_PER_PICK_SECONDS;
    })());

  const startedAt = state.draft_current_pick_started_at;
  const skipTimer = userState.auto_pick_rest_of_draft;
  if (!skipTimer) {
    if (!startedAt) return { didAutoPick: false };
    const deadline = new Date(startedAt).getTime() + timePerPickSeconds * 1000;
    if (Date.now() < deadline) return { didAutoPick: false };
  }

  let didAny = false;
  let cursor: { overall_pick: number; user_id: string } = current;
  let currentPickNum = state.draft_current_pick;
  let totalPicks = state.total_picks ?? 0;

  while (true) {
    const result = await performOneAutoPick(admin, leagueId, cursor, {
      draft_current_pick: currentPickNum,
      total_picks: totalPicks,
    });
    if (result.error) return { didAutoPick: didAny, error: result.error };
    didAny = true;

    const nextPick = result.nextPick ?? currentPickNum + 1;
    if (nextPick > totalPicks) return { didAutoPick: true };

    const { data: nextOrderRow } = await admin
      .from("league_draft_order")
      .select("overall_pick, user_id")
      .eq("league_id", leagueId)
      .eq("overall_pick", nextPick)
      .maybeSingle();
    if (!nextOrderRow) return { didAutoPick: true };
    const nextUserState = await getDraftUserState(
      admin,
      leagueId,
      (nextOrderRow as { user_id: string }).user_id
    );
    if (!nextUserState.auto_pick_rest_of_draft) return { didAutoPick: true };

    cursor = nextOrderRow as { overall_pick: number; user_id: string };
    currentPickNum = nextPick;
  }
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
  await admin.from("league_draft_user_state").delete().eq("league_id", leagueId);
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

  const { data: activeRow } = await admin
    .from("league_rosters")
    .select("id")
    .eq("league_id", leagueId)
    .eq("user_id", lastRow.user_id)
    .eq("wrestler_id", lastRow.wrestler_id)
    .is("released_at", null)
    .maybeSingle();
  const { error: rosterErr } = activeRow
    ? await admin.from("league_rosters").delete().eq("id", activeRow.id)
    : { error: null };
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
