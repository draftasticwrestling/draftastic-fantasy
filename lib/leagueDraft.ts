/**
 * Private Leagues: draft order generation (snake/linear), current pick, and making a pick.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getLeagueMembers, getRostersForLeague, getRostersForLeagueAdmin, getLeagueMemberUserIdsForAdmin } from "@/lib/leagues";
import { getRosterRulesForLeague, getRosterRulesForLeagueId } from "@/lib/leagueStructure";
import { isBlocklistedSlug } from "@/lib/draftBlocklist";
import { addWrestlerToRoster } from "@/lib/leagues";
import { timestamptzForAcquiredAtDate } from "@/lib/rosterTimestamps";
import { aggregateWrestlerPoints, getPointsForWrestler } from "@/lib/scoring/aggregateWrestlerPoints.js";
import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";
import {
  getCurrentChampionsBySlug,
  inferReignsFromEvents,
  mergeReigns,
  REIGN_EFFECTIVE_START,
} from "@/lib/scoring/endOfMonthBeltPoints.js";
import { normalizeChampionshipHistoryRow } from "@/lib/championshipHistoryNormalize";
import type { ChampionshipReignRow } from "@/lib/championshipTitleHistory";
import { factionDisplayName } from "@/lib/factionName";
import { EVENT_STATUSES_FOR_SCORING } from "@/lib/eventsScoring";
import { isRawOrSmackDownWrestlerRoster } from "@/lib/wrestlerRosterFromBrand";
import {
  AUTOPICK_LIST_EXHAUSTED_TIE_BREAK,
  AUTOPICK_REQUIRED_FEMALE_COUNT,
  AUTOPICK_REQUIRED_PRIORITY_COUNT,
} from "@/lib/draftPriorityRequirements";
import { normalizeDraftPoolGender as normalizeGender } from "@/lib/wrestlerDraftGender";
import {
  LEAGUE_LEADERS_ALL_TIME_EVENTS_FROM,
  LEAGUE_LEADERS_ALL_TIME_EVENTS_LIMIT,
} from "@/lib/leagueLeadersAllTimeScoring";
import { bigBoardLabel, getBigBoardPriorityList, isBigBoardId, type BigBoardId } from "@/lib/draftBigBoards";
import { isInBetaAutopickRunWindow } from "@/lib/betaAutopickSchedule";

const LEAGUE_START_DATE = "2025-05-02";

/** Live snake/linear: `draft_type` is canonical when it is `linear` or `snake` (matches generateDraftOrder). */
export function effectiveLiveDraftStyle(
  draft_type: string | null | undefined,
  draft_style: string | null | undefined
): "linear" | "snake" {
  if (draft_type === "linear" || draft_type === "snake") return draft_type;
  return draft_style === "linear" ? "linear" : "snake";
}

type AutopickPointsTriple = { rsPoints: number; plePoints: number; beltPoints: number };

function cloneAutopickPoints(p: AutopickPointsTriple): AutopickPointsTriple {
  return { rsPoints: p.rsPoints, plePoints: p.plePoints, beltPoints: p.beltPoints };
}

function autopickSumPoints(p: AutopickPointsTriple): number {
  const f = (n: number) => (Number.isFinite(n) ? n : 0);
  return f(p.rsPoints) + f(p.plePoints) + f(p.beltPoints);
}

/**
 * Match rows use slug-like keys; `wrestlers.id` may be a UUID. Resolve each roster row to the best
 * aggregate bucket so totals are not all zero (which made autopick follow DB `order("id")` / alphabetical).
 */
function resolveAutopickPointsForRow(
  aggregate: ReturnType<typeof aggregateWrestlerPoints>,
  w: { id: string; name?: string | null }
): AutopickPointsTriple {
  const nameKey = w.name ? normalizeWrestlerName(w.name) : "";
  const direct = getPointsForWrestler(aggregate, w.id, nameKey);
  if (autopickSumPoints(direct) > 0) return cloneAutopickPoints(direct);

  const idNorm = w.id ? normalizeWrestlerName(String(w.id)) : "";
  let best = cloneAutopickPoints(direct);
  let bestSum = autopickSumPoints(best);
  for (const [k, pts] of Object.entries(aggregate)) {
    if (!pts || typeof pts.rsPoints !== "number") continue;
    const s = autopickSumPoints(pts);
    if (s <= 0) continue;
    const kn = normalizeWrestlerName(String(k));
    const match =
      k === w.id ||
      (idNorm && kn === idNorm) ||
      (nameKey && (kn === nameKey || k === nameKey));
    if (match && s > bestSum) {
      best = cloneAutopickPoints(pts);
      bestSum = s;
    }
  }
  return best;
}

function augmentAggregateForAutopickWrestlers(
  aggregate: ReturnType<typeof aggregateWrestlerPoints>,
  rows: { id: string; name?: string | null }[]
): ReturnType<typeof aggregateWrestlerPoints> {
  const out: ReturnType<typeof aggregateWrestlerPoints> = { ...aggregate };
  for (const w of rows) {
    if (!w?.id) continue;
    const pts = resolveAutopickPointsForRow(aggregate, w);
    const id = String(w.id).trim();
    if (!id) continue;
    out[id] = pts;
    out[id.toLowerCase()] = pts;
    const nk = w.name ? normalizeWrestlerName(w.name) : "";
    if (nk) out[nk] = pts;
  }
  return out;
}

/** Autopick ranks by all-time totals keyed by `wrestler_id` when cache exists, else event-derived fallback. */
async function loadAutopickEventPointsBySlug(admin: AdminClient): Promise<ReturnType<typeof aggregateWrestlerPoints>> {
  const [eventsRes, wrestlersRes, cacheRes] = await Promise.all([
    admin
      .from("events")
      .select("id, name, date, matches")
      .in("status", [...EVENT_STATUSES_FOR_SCORING])
      .gte("date", LEAGUE_LEADERS_ALL_TIME_EVENTS_FROM)
      .order("date", { ascending: true })
      .limit(LEAGUE_LEADERS_ALL_TIME_EVENTS_LIMIT),
    admin.from("wrestlers").select("id, name").order("id"),
    admin
      .from("wrestler_stats_cache")
      .select("wrestler_id, total_points")
      .eq("season_key", "all_time"),
  ]);
  const aggregate = aggregateWrestlerPoints(
    (eventsRes.data ?? []) as { id: string; name: string; date: string; matches?: object[] }[]
  );
  const wrestlerRows = ((wrestlersRes.data ?? []) as { id: string; name?: string | null }[]) ?? [];
  const out = augmentAggregateForAutopickWrestlers(aggregate, wrestlerRows);
  for (const row of (cacheRes.data ?? []) as { wrestler_id?: string | null; total_points?: number | null }[]) {
    const id = row.wrestler_id != null ? String(row.wrestler_id).trim() : "";
    if (!id) continue;
    const total = Number(row.total_points ?? 0);
    if (!Number.isFinite(total)) continue;
    // Put total into rsPoints so existing sum path remains unchanged.
    const p = { rsPoints: total, plePoints: 0, beltPoints: 0 };
    out[id] = p;
    out[id.toLowerCase()] = p;
  }
  return out;
}

function autopickEventPointsTotal(
  pointsBySlug: ReturnType<typeof aggregateWrestlerPoints>,
  slugKey: string,
  nameKey: string
): number {
  const p = getPointsForWrestler(pointsBySlug, slugKey, nameKey);
  return autopickSumPoints(p);
}

const DEFAULT_TIME_PER_PICK_SECONDS = 2 * 60;
const FIRST_PICK_BUFFER_SECONDS = 60; // extra buffer after draft begins before first auto-pick
/** For autopick leagues, use a short clock so the draft moves quickly (no human picking). */
const AUTOPICK_TIME_PER_PICK_SECONDS = 5;
const CONSECUTIVE_AUTO_PICKS_BEFORE_TAKEOVER = 3;
/** Cap serverless work per request when batching autopick picks (cron / default). */
const MAX_AUTOPICK_PICKS_PER_REQUEST = 120;
/** Draft page: smaller batches avoid serverless timeouts while still making progress across redirects. */
export const MAX_AUTOPICK_PICKS_DRAFT_PAGE = 45;
/** Hard stop so a stuck cursor / race loop cannot hang one HTTP request forever. */
const MAX_AUTOPICK_WHILE_ITERATIONS = 600;

function isPostgresUniqueViolation(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  if (err.code === "23505") return true;
  const m = err.message ?? "";
  return /duplicate key|unique constraint/i.test(m);
}

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
  /** Autopick: last Big Board applied, or "custom" after the manager edits the list. */
  priorityListSource?: "custom" | string;
};

export type DraftPreferences = {
  priority_list: string[];
  strategy: string[];
  strategy_options?: DraftStrategyOptions | null;
};

function isDraftFocus(v: unknown): v is DraftFocus {
  return v === "2026" || v === "2025" || v === "all";
}

function isDraftPointStrategy(v: unknown): v is DraftPointStrategy {
  return v === "total" || v === "rs" || v === "ple" || v === "belt";
}

function isDraftWrestlerStrategy(v: unknown): v is DraftWrestlerStrategy {
  return (
    v === "best_available" ||
    v === "balanced_gender" ||
    v === "balanced_brands" ||
    v === "high_males" ||
    v === "high_females"
  );
}

/** Shown strategy when saving draft preferences without per-user picks (all-time total, best available). */
export const DEFAULT_DRAFT_STRATEGY_OPTIONS: DraftStrategyOptions = {
  focus: "all",
  pointStrategy: "total",
  wrestlerStrategy: "best_available",
};

/**
 * Resolves strategy for autopick: uses DB strategy_options (with per-field defaults),
 * or when the row has no strategy_options and no legacy strategy[] (common for
 * priority-only saves / pre-migration rows), uses {@link DEFAULT_DRAFT_STRATEGY_OPTIONS}.
 */
function resolvedStrategyOptions(prefs: DraftPreferences | null): DraftStrategyOptions | null {
  const raw = prefs?.strategy_options;
  if (raw != null && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    return {
      focus: isDraftFocus(r.focus) ? r.focus : "all",
      pointStrategy: isDraftPointStrategy(r.pointStrategy) ? r.pointStrategy : "total",
      wrestlerStrategy: isDraftWrestlerStrategy(r.wrestlerStrategy) ? r.wrestlerStrategy : "best_available",
    };
  }
  if (prefs != null && (!prefs.strategy || prefs.strategy.length === 0)) {
    return { ...DEFAULT_DRAFT_STRATEGY_OPTIONS };
  }
  return null;
}

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

/** Default behavior when a manager has not set auto-draft preferences. */
export const DEFAULT_AUTOPICK_DESCRIPTION = AUTOPICK_LIST_EXHAUSTED_TIE_BREAK;

/**
 * Get preference status for all league members (for pre-draft "auto-draft readiness" display).
 * Returns one entry per member with hasPreferences and a short summary; missing prefs show default description.
 */
export async function getDraftPreferencesForAllMembers(
  leagueId: string
): Promise<
  { user_id: string; display_name: string; hasPreferences: boolean; summary: string }[]
> {
  const members = await getLeagueMembers(leagueId);
  const db = getAdminClient() ?? (await createClient());
  const { data: leagueRow } = await db.from("leagues").select("draft_type").eq("id", leagueId).maybeSingle();
  const leagueIsAutopick = (leagueRow as { draft_type?: string } | null)?.draft_type === "autopick";

  const out: { user_id: string; display_name: string; hasPreferences: boolean; summary: string }[] = [];
  for (const m of members) {
    const name = factionDisplayName(m, "Unknown");
    const prefs = await getDraftPreferences(leagueId, m.user_id, db);
    const so = prefs?.strategy_options as { priorityListSource?: string } | undefined;
    const listSrc = so?.priorityListSource;
    const listLen = prefs?.priority_list?.length ?? 0;
    const isCustom = listSrc === "custom";
    const customOk = isCustom && listLen >= AUTOPICK_REQUIRED_PRIORITY_COUNT;
    const hasPreferencesNonAutopick =
      prefs != null && (listLen > 0 || prefs.strategy_options != null);

    let hasPreferencesDisplay: boolean;
    let summary: string;

    if (!leagueIsAutopick) {
      hasPreferencesDisplay = hasPreferencesNonAutopick;
      summary = DEFAULT_AUTOPICK_DESCRIPTION;
      if (hasPreferencesNonAutopick && prefs) {
        if (listLen > 0) summary = `Priority list: ${listLen} wrestlers · ${DEFAULT_AUTOPICK_DESCRIPTION}`;
      }
    } else if (!isCustom) {
      hasPreferencesDisplay = true;
      const boardId: BigBoardId =
        listSrc && isBigBoardId(String(listSrc)) ? (listSrc as BigBoardId) : "default";
      summary =
        boardId === "default"
          ? `Default Big Board · ${DEFAULT_AUTOPICK_DESCRIPTION}`
          : `${bigBoardLabel(boardId)} · ${listLen} wrestlers · ${DEFAULT_AUTOPICK_DESCRIPTION}`;
    } else if (customOk) {
      hasPreferencesDisplay = true;
      summary = `My own list: ${listLen} wrestlers · ${DEFAULT_AUTOPICK_DESCRIPTION}`;
    } else {
      hasPreferencesDisplay = false;
      summary = `My own list incomplete (${listLen}/${AUTOPICK_REQUIRED_PRIORITY_COUNT}). The Default Big Board will be used at draft time until this is complete.`;
    }
    out.push({
      user_id: m.user_id,
      display_name: name,
      hasPreferences: hasPreferencesDisplay,
      summary,
    });
  }
  return out;
}

/**
 * Get a user's draft preferences for a league. Returns null if none set.
 * Tolerates missing strategy_options column (pre-migration).
 */
export async function getDraftPreferences(
  leagueId: string,
  userId: string,
  /** Service role (or any) client; when omitted, uses the current session (RLS: own row only). */
  db?: SupabaseClient
): Promise<DraftPreferences | null> {
  const supabase = db ?? (await createClient());
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
      strategy_options =
        parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as DraftStrategyOptions) : null;
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

async function validateAutopickPriorityCoverage(
  admin: AdminClient,
  leagueId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const memberIds = await getLeagueMemberUserIdsForAdmin(leagueId);
  if (memberIds.length === 0) return { ok: false, error: "No league members found for autopick draft." };

  const { data: prefRows } = await admin
    .from("league_draft_preferences")
    .select("user_id, priority_list")
    .eq("league_id", leagueId)
    .in("user_id", memberIds);
  const rows = (prefRows ?? []) as { user_id?: string | null; priority_list?: unknown }[];
  const listByUser = new Map<string, string[]>();
  for (const r of rows) {
    const uid = r.user_id ? String(r.user_id) : "";
    if (!uid) continue;
    let ids: string[] = [];
    if (Array.isArray(r.priority_list)) ids = r.priority_list.map((v) => String(v)).filter(Boolean);
    else if (typeof r.priority_list === "string") {
      try {
        const parsed = JSON.parse(r.priority_list) as unknown;
        if (Array.isArray(parsed)) ids = parsed.map((v) => String(v)).filter(Boolean);
      } catch {}
    }
    listByUser.set(uid, ids);
  }

  const allIds = Array.from(
    new Set(
      Array.from(listByUser.values())
        .flat()
        .map((v) => String(v).trim())
        .filter(Boolean)
    )
  );
  const genderById: Record<string, "F" | "M" | null> = {};
  if (allIds.length > 0) {
    const g = await getWrestlerGendersBatch(admin, allIds);
    for (const [id, raw] of Object.entries(g)) {
      const ng = normalizeGender(raw);
      genderById[id] = ng;
      genderById[id.toLowerCase()] = ng;
    }
  }

  const failures: string[] = [];
  for (const uid of memberIds) {
    const list = listByUser.get(uid) ?? [];
    const femaleCount = list.reduce((n, id) => {
      const key = String(id).trim();
      const gen = genderById[key] ?? genderById[key.toLowerCase()] ?? null;
      return n + (gen === "F" ? 1 : 0);
    }, 0);
    if (list.length < AUTOPICK_REQUIRED_PRIORITY_COUNT || femaleCount < AUTOPICK_REQUIRED_FEMALE_COUNT) {
      failures.push(
        `${uid.slice(0, 8)}… (${list.length}/${AUTOPICK_REQUIRED_PRIORITY_COUNT} listed, ${femaleCount}/${AUTOPICK_REQUIRED_FEMALE_COUNT} female)`
      );
    }
  }
  if (failures.length === 0) return { ok: true };
  return {
    ok: false,
    error:
      `Autopick requires each manager to set at least ${AUTOPICK_REQUIRED_PRIORITY_COUNT} ranked wrestlers ` +
      `including at least ${AUTOPICK_REQUIRED_FEMALE_COUNT} female. Missing coverage: ${failures.join("; ")}`,
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
  draft_status: "not_started" | "in_progress" | "ready_for_review" | "completed";
  draft_current_pick: number | null;
  draft_style: "snake" | "linear";
  total_picks: number;
  draft_current_pick_started_at: string | null;
} | null> {
  const supabase = await createClient();
  let league: {
    draft_status?: string;
    draft_current_pick?: number | null;
    draft_style?: string;
    draft_type?: string | null;
    draft_current_pick_started_at?: string | null;
  } | null = null;
  let err: { code?: string } | null = null;

  const full = await supabase
    .from("leagues")
    .select("draft_status, draft_current_pick, draft_style, draft_type, draft_current_pick_started_at")
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
    draft_status: (league.draft_status ?? "not_started") as
      | "not_started"
      | "in_progress"
      | "ready_for_review"
      | "completed",
    draft_current_pick: league.draft_current_pick ?? null,
    draft_style: effectiveLiveDraftStyle(league.draft_type, league.draft_style),
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

/** Same as getCurrentPick but uses admin client. Use this during autopick/cron so the correct picker is always read (no RLS/session dependency). */
async function getCurrentPickUsingAdmin(
  admin: AdminClient,
  leagueId: string
): Promise<{ overall_pick: number; user_id: string } | null> {
  const { data: league } = await admin
    .from("leagues")
    .select("draft_current_pick, draft_status")
    .eq("id", leagueId)
    .single();

  if (!league || league.draft_status !== "in_progress" || league.draft_current_pick == null) {
    return null;
  }

  const { data: row } = await admin
    .from("league_draft_order")
    .select("overall_pick, user_id")
    .eq("league_id", leagueId)
    .eq("overall_pick", league.draft_current_pick)
    .maybeSingle();

  if (!row) return null;
  return row as { overall_pick: number; user_id: string };
}

/** Same as getDraftOrder but uses admin client. Use from cron so order is read without a user session. */
async function getDraftOrderUsingAdmin(
  admin: AdminClient,
  leagueId: string
): Promise<{ overall_pick: number; user_id: string }[]> {
  const { data, error } = await admin
    .from("league_draft_order")
    .select("overall_pick, user_id")
    .eq("league_id", leagueId)
    .order("overall_pick", { ascending: true });
  if (error) return [];
  return (data ?? []) as { overall_pick: number; user_id: string }[];
}

/** Same as getLeagueDraftState but uses admin client. Use from cron so state is read without a user session. */
async function getLeagueDraftStateUsingAdmin(
  admin: AdminClient,
  leagueId: string
): Promise<{
  draft_status: "not_started" | "in_progress" | "ready_for_review" | "completed";
  draft_current_pick: number | null;
  draft_style: "snake" | "linear";
  total_picks: number;
  draft_current_pick_started_at: string | null;
  draft_type: string | null;
} | null> {
  const { data: league, error } = await admin
    .from("leagues")
    .select("draft_status, draft_current_pick, draft_style, draft_current_pick_started_at, draft_type")
    .eq("id", leagueId)
    .maybeSingle();
  if (error || !league) return null;
  const { count } = await admin
    .from("league_draft_order")
    .select("*", { count: "exact", head: true })
    .eq("league_id", leagueId);
  return {
    draft_status: (league.draft_status ?? "not_started") as
      | "not_started"
      | "in_progress"
      | "ready_for_review"
      | "completed",
    draft_current_pick: league.draft_current_pick ?? null,
    draft_style: effectiveLiveDraftStyle(league.draft_type, league.draft_style),
    total_picks: count ?? 0,
    draft_current_pick_started_at: league.draft_current_pick_started_at ?? null,
    draft_type: league.draft_type != null ? String(league.draft_type) : null,
  };
}

/** Fetch gender for wrestler ids in one query. Returns id -> raw gender string. */
async function getWrestlerGendersBatch(
  admin: AdminClient,
  wrestlerIds: string[]
): Promise<Record<string, string | null>> {
  if (wrestlerIds.length === 0) return {};
  const { data } = await admin
    .from("wrestlers")
    .select("id, gender")
    .in("id", wrestlerIds);
  const rows = (data ?? []) as { id: string; gender: string | null }[];
  return Object.fromEntries(rows.map((r) => [r.id, r.gender ?? null]));
}

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
 * Ensure there is a draft run row for this league and return its id.
 * Uses leagues.current_draft_run_id if set; otherwise creates a new run using season/year heuristics.
 */
async function ensureDraftRunForLeague(league: {
  id: string;
  current_draft_run_id?: string | null;
  season_slug?: string | null;
  start_date?: string | null;
  draft_date?: string | null;
  created_at?: string | null;
}): Promise<string | { error: string }> {
  const existing = (league as { current_draft_run_id?: string | null }).current_draft_run_id;
  const admin = getAdminClient();
  const supabase = admin ?? (await createClient());

  if (existing) return existing;

  const seasonSlug = (league.season_slug ?? "").trim();
  const startDate = league.start_date ? String(league.start_date).slice(0, 10) : null;
  const draftDate = league.draft_date ? String(league.draft_date).slice(0, 10) : null;
  const created = league.created_at ? String(league.created_at).slice(0, 10) : null;

  const pickYear = (raw: string | null) => {
    if (!raw || raw.length < 4) return null;
    const y = Number(raw.slice(0, 4));
    return Number.isFinite(y) ? y : null;
  };
  const year =
    pickYear(startDate) ??
    pickYear(draftDate) ??
    pickYear(created) ??
    new Date().getFullYear();

  const payload = {
    league_id: league.id,
    season_slug: seasonSlug || "",
    season_year: year,
    draft_date: draftDate,
  };

  const { data: run, error } = await supabase
    .from("league_draft_runs")
    .insert(payload)
    .select("id")
    .single();
  if (error || !run?.id) return { error: error?.message ?? "Failed to create draft run." };

  await supabase
    .from("leagues")
    .update({ current_draft_run_id: run.id })
    .eq("id", league.id);

  return run.id as string;
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
    .select("id, commissioner_id, draft_style, draft_type, current_draft_run_id, season_slug, start_date, draft_date, created_at")
    .eq("id", leagueId)
    .single();

  if (!league || league.commissioner_id !== user.id) {
    return { error: "Only the GM can generate draft order." };
  }

  const draftType = (league as { draft_type?: string }).draft_type ?? null;
  if (draftType === "autopick") {
    const { count } = await supabase
      .from("league_draft_order")
      .select("*", { count: "exact", head: true })
      .eq("league_id", leagueId);
    if (count && count > 0) {
      return { error: "Draft order is already set for this league. It cannot be changed." };
    }
  }
  if (draftType === "offline") {
    return { error: "Offline leagues do not use an on-site draft order. Add rosters from each team page when your draft is done." };
  }

  const members = await getLeagueMembers(leagueId);
  const rules = getRosterRulesForLeague(
    members.length,
    (league as { season_slug?: string | null }).season_slug ?? null
  );
  if (!rules) return { error: "League size must be 3–12 teams to generate draft order." };

  const runId = await ensureDraftRunForLeague(league);
  if (typeof runId !== "string") return runId;

  const numRounds = rules.rosterSize;
  const memberIds = members.map((m) => m.user_id);
  const draftTypeForSnake = (league as { draft_type?: string }).draft_type ?? league.draft_style;
  const snake = draftTypeForSnake !== "linear";

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

  const admin = getAdminClient();
  if (!admin) {
    return {
      error:
        "SUPABASE_SERVICE_ROLE_KEY is not set. Draft order must be written with the service role so all teams get correct pick slots. Add it in Netlify environment variables.",
    };
  }
  await admin.from("league_draft_order").delete().eq("league_id", leagueId);

  const { error: insertError } = await admin.from("league_draft_order").insert(
    order.map((o) => ({
      league_id: leagueId,
      draft_run_id: runId,
      overall_pick: o.overall_pick,
      user_id: o.user_id,
    }))
  );
  if (insertError) return { error: insertError.message };

  const updatePayload = {
    draft_status: "not_started",
    draft_current_pick: null,
    draft_current_pick_started_at: null,
  };
  const { error: updateError } = await admin.from("leagues").update(updatePayload).eq("id", leagueId);
  if (updateError) return { error: updateError.message };
  return {};
}

/**
 * Generate draft order using service role only. For use by cron when "randomize one hour before draft time".
 * Does not require a logged-in user. Ensures all teams get correct pick slots.
 */
export async function generateDraftOrderForScheduledDraft(leagueId: string): Promise<{ error?: string }> {
  const admin = getAdminClient();
  if (!admin) return { error: "SUPABASE_SERVICE_ROLE_KEY not set." };

  const { data: league, error: leagueErr } = await admin
    .from("leagues")
    .select("id, draft_style, draft_type, current_draft_run_id, season_slug, start_date, draft_date, created_at")
    .eq("id", leagueId)
    .maybeSingle();
  if (leagueErr || !league) return { error: "League not found." };

  const memberIds = await getLeagueMemberUserIdsForAdmin(leagueId);
  const rules = getRosterRulesForLeague(
    memberIds.length,
    (league as { season_slug?: string | null }).season_slug ?? null
  );
  if (!rules) return { error: "League size must be 3–12 teams to generate draft order." };

  const runId = await ensureDraftRunForLeague(league);
  if (typeof runId !== "string") return runId;

  const numRounds = rules.rosterSize;
  const draftType = (league as { draft_type?: string }).draft_type ?? league.draft_style;
  const snake = draftType !== "linear";

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

  await admin.from("league_draft_order").delete().eq("league_id", leagueId);
  const { error: insertError } = await admin.from("league_draft_order").insert(
    order.map((o) => ({
      league_id: leagueId,
      draft_run_id: runId,
      overall_pick: o.overall_pick,
      user_id: o.user_id,
    }))
  );
  if (insertError) return { error: insertError.message };

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
    .select("id, commissioner_id, draft_style, draft_type, current_draft_run_id, season_slug, start_date, draft_date, created_at")
    .eq("id", leagueId)
    .single();

  if (!league || league.commissioner_id !== user.id) {
    return { error: "Only the GM can set draft order." };
  }

  const members = await getLeagueMembers(leagueId);
  const rules = getRosterRulesForLeague(
    members.length,
    (league as { season_slug?: string | null }).season_slug ?? null
  );
  if (!rules) return { error: "League size must be 3–12 teams to set draft order." };

  const runId = await ensureDraftRunForLeague(league);
  if (typeof runId !== "string") return runId;

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

  const admin = getAdminClient();
  if (!admin) {
    return {
      error:
        "SUPABASE_SERVICE_ROLE_KEY is not set. Draft order must be written with the service role so all teams get correct pick slots. Add it in Netlify environment variables.",
    };
  }
  await admin.from("league_draft_order").delete().eq("league_id", leagueId);

  const { error: insertError } = await admin.from("league_draft_order").insert(
    order.map((o) => ({
      league_id: leagueId,
      draft_run_id: runId,
      overall_pick: o.overall_pick,
      user_id: o.user_id,
    }))
  );
  if (insertError) return { error: insertError.message };

  const updatePayload = {
    draft_status: "not_started",
    draft_current_pick: null,
    draft_current_pick_started_at: null,
  };
  const { error: updateError } = await admin.from("leagues").update(updatePayload).eq("id", leagueId);
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
    return { error: "Only the GM can start the draft." };
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

  const { data: orderRow } = await admin
    .from("league_draft_order")
    .select("draft_run_id")
    .eq("league_id", leagueId)
    .eq("overall_pick", current.overall_pick)
    .maybeSingle();
  const draftRunId = (orderRow as { draft_run_id?: string } | null)?.draft_run_id ?? null;
  if (!draftRunId) {
    return { error: "Draft run not found. Generate or set draft order first." };
  }

  const { error: pickErr } = await admin.from("league_draft_picks").insert({
    league_id: leagueId,
    draft_run_id: draftRunId,
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
      ? { draft_current_pick: null, draft_status: "ready_for_review" }
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
  /** Prefer service role so every member sees full pick log (RLS on league_draft_picks can otherwise hide rows). */
  const supabase = getAdminClient() ?? (await createClient());
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
 * Pool for `draft_type === "autopick"` simplified picks. Same as Draft Testing: **injured talent counts**.
 * Strict `isDraftableWrestler` often empties the pool (many active stars are marked injured) and blocks the whole draft.
 */
function isAutopickDraftableWrestler(row: DraftPoolRow): boolean {
  return isDraftableWrestlerForDraftTesting(row);
}

type PointsFallbackOptions = {
  draftedIds?: Set<string>;
  /** When set (e.g. from autopick), only consider wrestlers of this gender so roster min F/M rules are satisfied. */
  requiredGender?: "F" | "M" | null;
  /** Service-role client from autopick; avoids relying on a second getAdminClient() call. */
  supabase?: SupabaseClient;
};

/**
 * Returns the available wrestler with the most points to-date (for auto-pick fallback).
 * Uses completed events from LEAGUE_START_DATE; excludes inactive and non-draftable (Front Office, etc.).
 * When options.requiredGender is set, only considers wrestlers of that gender; if none available, returns null.
 */
export async function getTopAvailableWrestlerByPoints(
  leagueId: string,
  options?: PointsFallbackOptions
): Promise<string | null> {
  const supabase = options?.supabase ?? getAdminClient() ?? (await createClient());
  let draftedIds: Set<string>;
  if (options?.draftedIds) {
    draftedIds = options.draftedIds;
  } else {
    const rosters = await getRostersForLeague(leagueId);
    draftedIds = new Set<string>();
    for (const entries of Object.values(rosters)) for (const e of entries) draftedIds.add(e.wrestler_id);
  }

  const needGender = options?.requiredGender ?? null;
  const selectCols = needGender
    ? 'id, gender, status, "Status", brand, classification, "Classification"'
    : 'id, status, "Status", brand, classification, "Classification"';
  let wrestlersRes = await supabase.from("wrestlers").select(selectCols).order("id");
  let list = ((wrestlersRes.data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({ ...r, ...normalizeWrestlerRowFromApi(r) })) as (DraftPoolRow & { gender?: string | null })[];
  if (wrestlersRes.error && !list.length) {
    const fallback = await supabase.from("wrestlers").select(selectCols).order("id");
    list = ((fallback.data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({ ...r, ...normalizeWrestlerRowFromApi(r) })) as (DraftPoolRow & { gender?: string | null })[];
  }
  if (!list.length) {
    const noClassification = await supabase.from("wrestlers").select(needGender ? "id, gender, status, \"Status\", brand" : 'id, status, "Status", brand').order("id");
    list = ((noClassification.data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({ ...r, ...normalizeWrestlerRowFromApi(r) })) as (DraftPoolRow & { gender?: string | null })[];
  }
  list = list.filter(isDraftableWrestler).filter((w): w is (DraftPoolRow & { id: string; gender?: string | null }) => Boolean(w.id));
  if (needGender) {
    const byGender = list.filter((w) => normalizeGender(w.gender) === needGender);
    if (byGender.length > 0) list = byGender;
    else return null;
  }

  const eventsRes = await supabase
    .from("events")
    .select("id, name, date, matches")
    .in("status", [...EVENT_STATUSES_FOR_SCORING])
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

type RosterOverride = {
  rosters: Record<string, { wrestler_id: string }[]>;
  draftedIds: Set<string>;
  /** When set (including `null`), from performOneAutoPick — constrains priority list + strategy for roster mins. */
  requiredGender?: "F" | "M" | null;
  /** Pass the same service-role client as roster/order writes (autopick). */
  supabase?: SupabaseClient;
};

/** Next pick must be this gender to satisfy min F/M with remaining slots (league rules). */
export function requiredGenderForNextPick(
  rules: { rosterSize: number; minFemale: number; minMale: number },
  currentRosterLength: number,
  currentFemale: number,
  currentMale: number
): "F" | "M" | null {
  const remainingPicks = rules.rosterSize - currentRosterLength;
  if (remainingPicks <= 0) return null;
  const needFemale = Math.max(0, rules.minFemale - currentFemale);
  const needMale = Math.max(0, rules.minMale - currentMale);
  if (needFemale > 0 && remainingPicks - 1 < needFemale) return "F";
  if (needMale > 0 && remainingPicks - 1 < needMale) return "M";
  return null;
}

/**
 * Get the best available wrestler for a user's auto-pick: uses priority list first if set,
 * then strategy_options (focus + point strategy + wrestler strategy) or legacy strategy[], else highest total points.
 * When opts is provided (e.g. from autopick with admin rosters), uses that data instead of fetching so all teams are considered.
 */
export async function getTopAvailableWrestlerForUser(
  leagueId: string,
  userId: string,
  opts?: RosterOverride
): Promise<string | null> {
  /** Autopick passes service role via opts; otherwise prefer admin so prefs bypass RLS. */
  const supabase = opts?.supabase ?? getAdminClient() ?? (await createClient());
  const rosters = opts?.rosters ?? (await getRostersForLeague(leagueId));
  const draftedIds = opts?.draftedIds ?? (() => {
    const set = new Set<string>();
    for (const entries of Object.values(rosters)) for (const e of entries) set.add(e.wrestler_id);
    return set;
  })();

  const prefs = await getDraftPreferences(leagueId, userId, supabase);

  const { data: leagueDraftMeta } = await supabase.from("leagues").select("draft_type").eq("id", leagueId).maybeSingle();
  const isAutopickLeague = (leagueDraftMeta as { draft_type?: string } | null)?.draft_type === "autopick";

  const rules = await getRosterRulesForLeagueId(supabase, leagueId);
  const currentRoster = rosters[userId] ?? [];
  const rosterIdsForGender = currentRoster.map((e) => e.wrestler_id).filter(Boolean);
  let rosterFemale = 0;
  let rosterMale = 0;
  const skipLocalGenderCount = opts != null && "requiredGender" in opts;
  if (!skipLocalGenderCount && rosterIdsForGender.length > 0) {
    const { data: gRows } = await supabase.from("wrestlers").select("id,gender").in("id", rosterIdsForGender);
    for (const row of (gRows ?? []) as { id: string; gender?: string | null }[]) {
      const g = normalizeGender(row.gender);
      if (g === "F") rosterFemale += 1;
      else if (g === "M") rosterMale += 1;
    }
  }
  const requiredGender: "F" | "M" | null =
    skipLocalGenderCount
      ? opts!.requiredGender ?? null
      : rules
        ? requiredGenderForNextPick(rules, currentRoster.length, rosterFemale, rosterMale)
        : null;

  let priorityWalkList: string[] = [];
  if (isAutopickLeague) {
    const so = prefs?.strategy_options as { priorityListSource?: string } | undefined;
    const src = so?.priorityListSource?.trim();
    if (src === "custom") {
      const own = prefs?.priority_list ?? [];
      priorityWalkList =
        own.length > 0 ? own : (getBigBoardPriorityList("default") ?? []);
    } else {
      const boardId = src && isBigBoardId(src) ? src : "default";
      priorityWalkList = getBigBoardPriorityList(boardId) ?? [];
    }
  } else if (prefs?.priority_list?.length) {
    priorityWalkList = prefs.priority_list;
  }

  if (priorityWalkList.length) {
    const undraftedPriorityIds = priorityWalkList.filter((wid): wid is string => Boolean(wid) && !draftedIds.has(wid));
    if (undraftedPriorityIds.length > 0) {
      const { data: priG } = await supabase.from("wrestlers").select("id,gender").in("id", undraftedPriorityIds);
      const genderById = new Map<string, "F" | "M" | null>();
      for (const row of (priG ?? []) as { id: string; gender?: string | null }[]) {
        const ng = normalizeGender(row.gender);
        const id = String(row.id);
        genderById.set(id, ng);
        genderById.set(id.toLowerCase(), ng);
      }
      for (const wid of priorityWalkList) {
        if (!wid || draftedIds.has(wid)) continue;
        const g = genderById.get(wid) ?? genderById.get(String(wid).toLowerCase()) ?? null;
        if (requiredGender && g !== requiredGender) continue;
        return wid;
      }
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

  const strategyOpts = resolvedStrategyOptions(prefs);
  if (strategyOpts) {
    const [events2025, events2026, eventsAll] = await Promise.all([
      supabase.from("events").select("id, name, date, matches").in("status", [...EVENT_STATUSES_FOR_SCORING]).gte("date", "2025-01-01").lte("date", "2025-12-31").order("date", { ascending: true }),
      supabase.from("events").select("id, name, date, matches").in("status", [...EVENT_STATUSES_FOR_SCORING]).gte("date", "2026-01-01").order("date", { ascending: true }),
      supabase.from("events").select("id, name, date, matches").in("status", [...EVENT_STATUSES_FOR_SCORING]).gte("date", "2025-01-01").order("date", { ascending: true }),
    ]);
    const pts2025 = aggregateWrestlerPoints((events2025.data ?? []) as { id: string; name: string; date: string; matches?: object[] }[]);
    const pts2026 = aggregateWrestlerPoints((events2026.data ?? []) as { id: string; name: string; date: string; matches?: object[] }[]);
    const ptsAll = aggregateWrestlerPoints((eventsAll.data ?? []) as { id: string; name: string; date: string; matches?: object[] }[]);
    const pointsByPeriod: Record<string, Record<string, { rsPoints: number; plePoints: number; beltPoints: number }>> = {
      "2026": pts2026,
      "2025": pts2025,
      all: ptsAll,
    };
    const pts = pointsByPeriod[strategyOpts.focus] ?? pts2026;
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
      strategyOpts.pointStrategy === "total"
        ? (w: WrestlerWithStats) => w.totalPoints > 0
        : strategyOpts.pointStrategy === "rs"
          ? (w: WrestlerWithStats) => w.rsPoints > 0
          : strategyOpts.pointStrategy === "ple"
            ? (w: WrestlerWithStats) => w.plePoints > 0
            : (w: WrestlerWithStats) => w.beltPoints > 0;
    const withPoints = available.filter(hasPoints);
    let baseAvailable = withPoints.length > 0 ? withPoints : available;
    const byPoints = [...baseAvailable];
    if (strategyOpts.pointStrategy === "total") byPoints.sort((a, b) => b.totalPoints - a.totalPoints);
    else if (strategyOpts.pointStrategy === "rs") byPoints.sort((a, b) => b.rsPoints - a.rsPoints);
    else if (strategyOpts.pointStrategy === "ple") byPoints.sort((a, b) => b.plePoints - a.plePoints);
    else byPoints.sort((a, b) => b.beltPoints - a.beltPoints);
    const significantCount = Math.max(1, Math.ceil(byPoints.length * 0.5));
    const significant = byPoints.slice(0, significantCount);
    baseAvailable = significant.length > 0 ? significant : baseAvailable;
    let pool = baseAvailable;
    if (requiredGender) {
      const byGender = baseAvailable.filter((w) => normalizeGender(w.gender) === requiredGender);
      if (byGender.length > 0) {
        pool = byGender;
      } else {
        const byGenderAll = available.filter((w) => normalizeGender(w.gender) === requiredGender);
        pool = byGenderAll;
      }
    }
    let sorted = [...pool];
    if (sorted.length === 0) return null;
    if (strategyOpts.pointStrategy === "total") sorted.sort((a, b) => b.totalPoints - a.totalPoints);
    else if (strategyOpts.pointStrategy === "rs") sorted.sort((a, b) => b.rsPoints - a.rsPoints);
    else if (strategyOpts.pointStrategy === "ple") sorted.sort((a, b) => b.plePoints - a.plePoints);
    else if (strategyOpts.pointStrategy === "belt") sorted.sort((a, b) => b.beltPoints - a.beltPoints);
    if (strategyOpts.wrestlerStrategy === "best_available") return sorted[0]?.id ?? null;
    if (strategyOpts.wrestlerStrategy === "balanced_gender") {
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
    if (strategyOpts.wrestlerStrategy === "balanced_brands") {
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
    if (strategyOpts.wrestlerStrategy === "high_males") {
      if (requiredGender === "F") {
        sorted.sort((a, b) => b.totalPoints - a.totalPoints);
        return sorted[0]?.id ?? null;
      }
      const male = sorted.filter((w) => normalizeGender(w.gender) === "M");
      const pool = male.length > 0 ? male : sorted;
      pool.sort((a, b) => b.totalPoints * 1.2 - a.totalPoints * 1.2);
      return pool[0]?.id ?? null;
    }
    if (strategyOpts.wrestlerStrategy === "high_females") {
      if (requiredGender === "M") {
        sorted.sort((a, b) => b.totalPoints - a.totalPoints);
        return sorted[0]?.id ?? null;
      }
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
    .in("status", [...EVENT_STATUSES_FOR_SCORING])
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
    legacyPool = available.filter((w) => normalizeGender(w.gender) === requiredGender);
    if (legacyPool.length === 0) return null;
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
    if (requiredGender === "M") {
      legacyPool.sort((a, b) => b.rating2k - a.rating2k || b.totalPoints - a.totalPoints);
      return legacyPool[0]?.id ?? null;
    }
    const female = legacyPool.filter((w) => normalizeGender(w.gender) === "F");
    const pool = female.length > 0 ? female : legacyPool;
    pool.sort((a, b) => b.rating2k - a.rating2k || b.totalPoints - a.totalPoints);
    return pool[0]?.id ?? null;
  }
  if (strategy === "prioritize_high_male") {
    if (requiredGender === "F") {
      legacyPool.sort((a, b) => b.rating2k - a.rating2k || b.totalPoints - a.totalPoints);
      return legacyPool[0]?.id ?? null;
    }
    const male = legacyPool.filter((w) => normalizeGender(w.gender) === "M");
    const pool = male.length > 0 ? male : legacyPool;
    pool.sort((a, b) => b.rating2k - a.rating2k || b.totalPoints - a.totalPoints);
    return pool[0]?.id ?? null;
  }

  legacyPool.sort((a, b) => b.totalPoints - a.totalPoints);
  return legacyPool[0]?.id ?? null;
}

/**
 * If `draft_current_pick` points at a slot that already has a `league_draft_picks` row, the league row
 * was never advanced (e.g. update failed after insert). The next autopick then hits a unique violation
 * and can spin forever in skippedDueToRace. Advance the cursor once to match reality.
 */
async function healOneStaleDraftCursorStep(admin: AdminClient, leagueId: string): Promise<boolean> {
  const state = await getLeagueDraftStateUsingAdmin(admin, leagueId);
  if (!state || state.draft_status !== "in_progress" || state.draft_current_pick == null) return false;

  const pickNum = state.draft_current_pick;
  const { data: orderRow } = await admin
    .from("league_draft_order")
    .select("draft_run_id")
    .eq("league_id", leagueId)
    .eq("overall_pick", pickNum)
    .maybeSingle();
  const draftRunId = (orderRow as { draft_run_id?: string } | null)?.draft_run_id ?? null;
  if (!draftRunId) return false;

  const { data: pickRow } = await admin
    .from("league_draft_picks")
    .select("overall_pick")
    .eq("draft_run_id", draftRunId)
    .eq("overall_pick", pickNum)
    .maybeSingle();
  if (!pickRow) return false;

  const totalPicks = state.total_picks ?? 0;
  const nextPick = pickNum + 1;
  const updates: {
    draft_current_pick: number | null;
    draft_status: string;
    draft_current_pick_started_at?: string | null;
  } =
    nextPick > totalPicks
      ? { draft_current_pick: null, draft_status: "ready_for_review", draft_current_pick_started_at: null }
      : {
          draft_current_pick: nextPick,
          draft_status: "in_progress",
          draft_current_pick_started_at: new Date().toISOString(),
        };
  const { error } = await admin.from("leagues").update(updates).eq("id", leagueId);
  return !error;
}

async function healStaleDraftCursorChain(admin: AdminClient, leagueId: string): Promise<void> {
  for (let i = 0; i < 200; i++) {
    const healed = await healOneStaleDraftCursorStep(admin, leagueId);
    if (!healed) break;
  }
}

/** Cheap cursor repair only (no picks). Safe on every draft page load for autopick. */
export async function repairDraftAutopickCursor(leagueId: string): Promise<void> {
  const admin = getAdminClient();
  if (!admin) return;
  await healStaleDraftCursorChain(admin, leagueId);
}

/** Track drafted wrestlers with case variants so roster/pick UUIDs match `wrestlers.id` queries. */
function addToDraftedSet(set: Set<string>, id: string | null | undefined): void {
  if (id == null || typeof id !== "string") return;
  const t = id.trim();
  if (!t) return;
  set.add(t);
  set.add(t.toLowerCase());
}

function isInDraftedSet(set: Set<string>, id: string | null | undefined): boolean {
  if (id == null || typeof id !== "string") return false;
  const t = id.trim();
  return t !== "" && (set.has(t) || set.has(t.toLowerCase()));
}

/** Same key resolution as /wrestlers grid for `getCurrentChampionsBySlug` maps. */
function autopickWrestlerIsCurrentChampion(
  w: { id: string; name?: string | null },
  currentChampionsBySlug: Record<string, string[]>
): boolean {
  if (!currentChampionsBySlug || Object.keys(currentChampionsBySlug).length === 0) return false;
  const slugKey = w.id;
  const nameKey = w.name ? normalizeWrestlerName(w.name) : "";
  const canonicalKey = nameKey || (slugKey ? normalizeWrestlerName(String(slugKey)) : "") || slugKey;
  const titles =
    currentChampionsBySlug[canonicalKey] ??
    currentChampionsBySlug[slugKey] ??
    (nameKey ? currentChampionsBySlug[nameKey] : null) ??
    [];
  return titles.length > 0;
}

/**
 * Merged table + inferred reigns (same sources as /wrestlers). Fetched once per autopick batch.
 */
async function loadAutopickChampionsBySlug(admin: AdminClient): Promise<Record<string, string[]>> {
  const [{ data: rawReigns }, { data: eventsForReignInference }] = await Promise.all([
    admin.from("championship_history").select("*"),
    admin
      .from("events")
      .select("id, name, date, matches")
      .eq("status", "completed")
      .gte("date", REIGN_EFFECTIVE_START)
      .order("date", { ascending: true }),
  ]);
  const tableReigns = (rawReigns ?? [])
    .map((row) => normalizeChampionshipHistoryRow(row as Record<string, unknown>))
    .sort((a, b) => {
      const ax = (a.won_date ?? a.start_date ?? "").slice(0, 10);
      const bx = (b.won_date ?? b.start_date ?? "").slice(0, 10);
      return ax.localeCompare(bx);
    }) as ChampionshipReignRow[];
  const inferredReigns = inferReignsFromEvents(
    (eventsForReignInference ?? []) as Parameters<typeof inferReignsFromEvents>[0]
  );
  const reigns = mergeReigns(tableReigns, inferredReigns) as Parameters<typeof getCurrentChampionsBySlug>[0];
  return getCurrentChampionsBySlug(reigns);
}

/**
 * Any undrafted wrestler whose Roster column is Raw or SmackDown (`wrestlers.brand` via `wrestlerRosterFromBrand`).
 * Stable id order; last resort if the points-based path returns null.
 */
async function findFirstUndraftedAutopickRawSdWrestlerId(
  admin: AdminClient,
  draftedIds: Set<string>,
  requiredGender: "F" | "M" | null
): Promise<string | null> {
  const selectCols = 'id, name, gender, status, "Status", brand, classification, "Classification"';
  let wrestlersRes = await admin.from("wrestlers").select(selectCols).order("id");
  let list = ((wrestlersRes.data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
    ...r,
    ...normalizeWrestlerRowFromApi(r),
  })) as (DraftPoolRow & { id?: string })[];
  if (wrestlersRes.error && !list.length) {
    const fallback = await admin.from("wrestlers").select(selectCols).order("id");
    list = ((fallback.data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
      ...r,
      ...normalizeWrestlerRowFromApi(r),
    })) as (DraftPoolRow & { id?: string })[];
  }
  if (!list.length) {
    const noClassification = await admin.from("wrestlers").select('id, name, gender, status, "Status", brand').order("id");
    list = ((noClassification.data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
      ...r,
      ...normalizeWrestlerRowFromApi(r),
    })) as (DraftPoolRow & { id?: string })[];
  }
  for (const w of list) {
    const id = w.id != null ? String(w.id) : "";
    if (!id || isInDraftedSet(draftedIds, id)) continue;
    if (!isAutopickDraftableWrestler(w)) continue;
    if (!isRawOrSmackDownWrestlerRoster(w.brand)) continue;
    if (requiredGender != null && normalizeGender((w as { gender?: string | null }).gender) !== requiredGender) {
      continue;
    }
    return id;
  }
  return null;
}

/**
 * Autopick leagues (`draft_type === "autopick"`): no priority lists or strategy prefs.
 * - Pool: autopick-eligible wrestlers (injured allowed; see `isAutopickDraftableWrestler`) whose **Roster** is Raw or SmackDown (`wrestlers.brand` via `wrestlerRosterFromBrand`).
 * - Order: while any current champion remains undrafted in that pool, pick best **event-derived** total (RS+PLE+belt) among them; else best overall in pool.
 * - Gender: `requiredGenderFromRules` from roster mins; if no match, relax gender.
 * - If that pool is exhausted, `performOneAutoPick` falls back to best score among all draftable wrestlers, then any draftable (so large drafts can finish).
 * @param eventPointsBySlug When set (e.g. from `runAutoPickIfExpired`), skips a second identical events query for this pick.
 */
async function pickAutopickLeagueWrestler(
  admin: AdminClient,
  draftedIds: Set<string>,
  requiredGenderFromRules: "F" | "M" | null,
  championsBySlug: Record<string, string[]>,
  eventPointsBySlug?: ReturnType<typeof aggregateWrestlerPoints> | null
): Promise<string | null> {
  const selectCols = 'id, name, gender, status, "Status", brand, classification, "Classification"';
  let wrestlersRes = await admin.from("wrestlers").select(selectCols).order("id");
  let list = ((wrestlersRes.data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
    ...r,
    ...normalizeWrestlerRowFromApi(r),
  })) as (DraftPoolRow & { gender?: string | null; id?: string })[];
  if (wrestlersRes.error && !list.length) {
    const fallback = await admin.from("wrestlers").select(selectCols).order("id");
    list = ((fallback.data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
      ...r,
      ...normalizeWrestlerRowFromApi(r),
    })) as (DraftPoolRow & { gender?: string | null; id?: string })[];
  }
  if (!list.length) {
    const noClassification = await admin.from("wrestlers").select('id, name, gender, status, "Status", brand').order("id");
    list = ((noClassification.data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
      ...r,
      ...normalizeWrestlerRowFromApi(r),
    })) as (DraftPoolRow & { gender?: string | null; id?: string })[];
  }
  const rawSmackdownRosterPool = list
    .filter(isAutopickDraftableWrestler)
    .filter((w): w is DraftPoolRow & { id: string; gender?: string | null } => Boolean(w.id))
    .filter((w) => isRawOrSmackDownWrestlerRoster(w.brand));
  if (rawSmackdownRosterPool.length === 0) return null;

  const pointsBySlug = eventPointsBySlug ?? (await loadAutopickEventPointsBySlug(admin));

  const bestIn = (
    candidates: (DraftPoolRow & { id: string; name?: string | null; gender?: string | null })[],
    gender: "F" | "M" | null
  ): string | null => {
    let pool = candidates;
    if (gender != null) {
      const byG = pool.filter((w) => normalizeGender(w.gender) === gender);
      if (byG.length === 0) return null;
      pool = byG;
    }
    // Only prefer champions who are still available. If every champion in this slice is already
    // drafted, narrowing to "champions" would leave only drafted rows and we would pick no one.
    const champsUndrafted = pool.filter(
      (w) =>
        Boolean(w.id) &&
        !isInDraftedSet(draftedIds, w.id) &&
        autopickWrestlerIsCurrentChampion(w, championsBySlug)
    );
    if (champsUndrafted.length > 0) pool = champsUndrafted;
    const contenders = pool
      .filter((w) => Boolean(w.id) && !isInDraftedSet(draftedIds, w.id))
      .map((w) => {
        const nameKey = w.name ? normalizeWrestlerName(w.name) : "";
        return { w, total: autopickEventPointsTotal(pointsBySlug, w.id, nameKey) };
      })
      .sort((a, b) => b.total - a.total || String(a.w.id).localeCompare(String(b.w.id)));
    return contenders[0]?.w.id ?? null;
  };

  let id = bestIn(rawSmackdownRosterPool, requiredGenderFromRules);
  if (!id && requiredGenderFromRules != null) {
    id = bestIn(rawSmackdownRosterPool, null);
  }
  return id;
}

/** Best undrafted wrestler by event-derived total (RS+PLE+belt), optional gender filter. */
async function getBestAutopickWrestlerAllTimeTotal(
  admin: AdminClient,
  draftedIds: Set<string>,
  needGender: "F" | "M" | null,
  eventPointsBySlug?: ReturnType<typeof aggregateWrestlerPoints> | null
): Promise<string | null> {
  const selectCols =
    needGender != null
      ? 'id, name, gender, status, "Status", brand, classification, "Classification"'
      : 'id, name, status, "Status", brand, classification, "Classification"';
  let wrestlersRes = await admin.from("wrestlers").select(selectCols).order("id");
  let list = ((wrestlersRes.data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
    ...r,
    ...normalizeWrestlerRowFromApi(r),
  })) as (DraftPoolRow & { gender?: string | null; id?: string })[];
  if (wrestlersRes.error && !list.length) {
    const fallback = await admin.from("wrestlers").select(selectCols).order("id");
    list = ((fallback.data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
      ...r,
      ...normalizeWrestlerRowFromApi(r),
    })) as (DraftPoolRow & { gender?: string | null; id?: string })[];
  }
  if (!list.length) {
    const noClassification = await admin
      .from("wrestlers")
      .select(needGender != null ? 'id, name, gender, status, "Status", brand' : 'id, name, status, "Status", brand')
      .order("id");
    list = ((noClassification.data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
      ...r,
      ...normalizeWrestlerRowFromApi(r),
    })) as (DraftPoolRow & { gender?: string | null; id?: string })[];
  }
  type AutopickPointsWrestler = DraftPoolRow & { id: string; name?: string | null; gender?: string | null };
  let pooled: AutopickPointsWrestler[] = list
    .filter(isAutopickDraftableWrestler)
    .filter((w): w is AutopickPointsWrestler => Boolean(w.id));
  if (needGender != null) {
    const byGender = pooled.filter((w) => normalizeGender(w.gender) === needGender);
    if (byGender.length > 0) pooled = byGender as AutopickPointsWrestler[];
    else return null;
  }

  const pointsBySlug = eventPointsBySlug ?? (await loadAutopickEventPointsBySlug(admin));
  const contenders = pooled
    .filter((w) => !isInDraftedSet(draftedIds, w.id))
    .map((w) => {
      const nameKey = w.name ? normalizeWrestlerName(w.name) : "";
      return { w, total: autopickEventPointsTotal(pointsBySlug, w.id, nameKey) };
    })
    .sort((a, b) => b.total - a.total || String(a.w.id).localeCompare(String(b.w.id)));
  return contenders[0]?.w.id ?? null;
}

/** Last resort: any draftable wrestler not in the drafted set (stable id order). */
async function getAnyUndraftedDraftableWrestlerId(
  admin: AdminClient,
  draftedIds: Set<string>
): Promise<string | null> {
  const { data } = await admin
    .from("wrestlers")
    .select('id, status, "Status", brand, classification, "Classification"')
    .order("id");
  const rows = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    ...r,
    ...normalizeWrestlerRowFromApi(r),
  })) as DraftPoolRow[];
  for (const w of rows) {
    const id = w.id != null ? String(w.id) : "";
    if (!id || isInDraftedSet(draftedIds, id)) continue;
    if (!isDraftableWrestler(w)) continue;
    return id;
  }
  return null;
}

/** Autopick last resort: any autopick-eligible wrestler (injured OK), stable id order. */
async function getAnyUndraftedAutopickWrestlerId(
  admin: AdminClient,
  draftedIds: Set<string>
): Promise<string | null> {
  const { data } = await admin
    .from("wrestlers")
    .select('id, status, "Status", brand, classification, "Classification"')
    .order("id");
  const rows = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    ...r,
    ...normalizeWrestlerRowFromApi(r),
  })) as DraftPoolRow[];
  for (const w of rows) {
    const id = w.id != null ? String(w.id) : "";
    if (!id || isInDraftedSet(draftedIds, id)) continue;
    if (!isAutopickDraftableWrestler(w)) continue;
    return id;
  }
  return null;
}

/**
 * If every row fails classification/brand/status filters, assign the first undrafted wrestler that is not
 * blocklisted so an autopick league cannot brick (data hygiene / gender rules should be fixed separately).
 */
async function getAnyUndraftedNonBlocklistedForAutopickEmergency(
  admin: AdminClient,
  draftedIds: Set<string>
): Promise<string | null> {
  const { data } = await admin.from("wrestlers").select("id").order("id");
  for (const row of data ?? []) {
    const id = row.id != null ? String(row.id) : "";
    if (!id || isInDraftedSet(draftedIds, id)) continue;
    if (isBlocklistedSlug(id)) continue;
    return id;
  }
  return null;
}

async function performOneAutoPick(
  admin: AdminClient,
  leagueId: string,
  current: { overall_pick: number; user_id: string },
  state: { draft_current_pick: number; total_picks: number },
  /** Autopick leagues: simplified picker (Raw/SmackDown roster from `w.brand`, healthy, roster mins, points + champions); live timer uses full prefs. */
  simplifiedAutopick?: boolean,
  /** Preloaded `getCurrentChampionsBySlug` map; avoids N championship queries during batched autopick. */
  autopickChampionsBySlug?: Record<string, string[]>,
  /** Preloaded event aggregate for ranking; one query per `runAutoPickIfExpired` batch instead of per pick. */
  autopickEventPointsBySlug?: ReturnType<typeof aggregateWrestlerPoints> | null
): Promise<{ error?: string; nextPick?: number; totalPicks?: number; skippedDueToRace?: boolean }> {
  const { data: orderRow } = await admin
    .from("league_draft_order")
    .select("draft_run_id")
    .eq("league_id", leagueId)
    .eq("overall_pick", current.overall_pick)
    .maybeSingle();
  const draftRunId = (orderRow as { draft_run_id?: string } | null)?.draft_run_id ?? null;
  if (!draftRunId) return { error: "Draft run not found. Generate or set draft order first." };

  // Use admin rosters so we see all teams' picks (RLS would otherwise limit to current user) and assign correctly.
  const rosters = await getRostersForLeagueAdmin(leagueId, admin);
  const draftedIds = new Set<string>();
  for (const entries of Object.values(rosters)) for (const e of entries) addToDraftedSet(draftedIds, e.wrestler_id);
  const { data: existingPickRows } = await admin
    .from("league_draft_picks")
    .select("wrestler_id")
    .eq("draft_run_id", draftRunId);
  for (const row of existingPickRows ?? []) {
    addToDraftedSet(draftedIds, (row as { wrestler_id?: string | null }).wrestler_id);
  }

  const currentRoster = rosters[current.user_id] ?? [];
  const rules = await getRosterRulesForLeagueId(admin, leagueId);
  const rosterGenderCounts: Record<string, number> = { F: 0, M: 0 };
  if (currentRoster.length > 0) {
    const genderById = await getWrestlerGendersBatch(admin, currentRoster.map((e) => e.wrestler_id));
    for (const e of currentRoster) {
      const g = normalizeGender(genderById[e.wrestler_id]);
      if (g) rosterGenderCounts[g] = (rosterGenderCounts[g] ?? 0) + 1;
    }
  }
  const currentFemale = rosterGenderCounts.F ?? 0;
  const currentMale = rosterGenderCounts.M ?? 0;
  const requiredGender: "F" | "M" | null = rules
    ? requiredGenderForNextPick(rules, currentRoster.length, currentFemale, currentMale)
    : null;

  let wrestlerId: string | null = null;
  if (simplifiedAutopick) {
    const champs = autopickChampionsBySlug ?? (await loadAutopickChampionsBySlug(admin));
    wrestlerId = await pickAutopickLeagueWrestler(
      admin,
      draftedIds,
      requiredGender,
      champs,
      autopickEventPointsBySlug
    );
    if (!wrestlerId) {
      wrestlerId = await findFirstUndraftedAutopickRawSdWrestlerId(admin, draftedIds, requiredGender);
    }
    if (!wrestlerId && requiredGender != null) {
      wrestlerId = await findFirstUndraftedAutopickRawSdWrestlerId(admin, draftedIds, null);
    }
    // Raw/SmackDown pool can run out before the draft ends (large leagues, heavy drafting, or sparse brands).
    // Prefer best all-time score among all draftable talent, then any undrafted draftable, so the draft can finish.
    if (!wrestlerId) {
      wrestlerId = await getBestAutopickWrestlerAllTimeTotal(admin, draftedIds, requiredGender, autopickEventPointsBySlug);
    }
    if (!wrestlerId && requiredGender != null) {
      wrestlerId = await getBestAutopickWrestlerAllTimeTotal(admin, draftedIds, null, autopickEventPointsBySlug);
    }
    if (!wrestlerId) {
      wrestlerId = await getAnyUndraftedAutopickWrestlerId(admin, draftedIds);
    }
    if (!wrestlerId) {
      wrestlerId = await getAnyUndraftedNonBlocklistedForAutopickEmergency(admin, draftedIds);
    }
  } else {
    wrestlerId = await getTopAvailableWrestlerForUser(leagueId, current.user_id, {
      rosters,
      draftedIds,
      requiredGender,
      supabase: admin,
    });
    if (!wrestlerId) {
      wrestlerId = await getTopAvailableWrestlerByPoints(leagueId, { draftedIds, requiredGender, supabase: admin });
    }
    if (!wrestlerId) {
      wrestlerId = await getBestAutopickWrestlerAllTimeTotal(admin, draftedIds, null);
    }
    if (!wrestlerId) {
      wrestlerId = await getAnyUndraftedDraftableWrestlerId(admin, draftedIds);
    }
  }
  if (!wrestlerId) {
    return {
      error: simplifiedAutopick
        ? "Autopick could not assign anyone: every wrestler may already be rostered/picked, or gender minimums cannot be met with anyone left in the database. If the draft should continue, check for duplicate picks, restart the draft, or lower min F/M vs roster size."
        : "Auto-pick could not find an available wrestler for this slot.",
    };
  }

  if (!rules) return { error: "Invalid league size." };
  const currentIds = currentRoster.map((e) => e.wrestler_id);
  if (currentIds.some((id) => id === wrestlerId || id.toLowerCase() === wrestlerId.toLowerCase())) {
    return { error: "Wrestler already on roster." };
  }
  if (currentIds.length >= rules.rosterSize) return { error: "Roster full." };

  const nextPick = (state.draft_current_pick ?? 0) + 1;
  const totalPicks = state.total_picks ?? 0;

  // Claim the slot before roster insert so concurrent page loads cannot each add a roster row
  // for the same overall_pick (which used to leave orphan rosters and duplicate-key errors).
  const { error: pickErr } = await admin.from("league_draft_picks").insert({
    league_id: leagueId,
    draft_run_id: draftRunId,
    overall_pick: current.overall_pick,
    user_id: current.user_id,
    wrestler_id: wrestlerId,
    is_auto_pick: true,
  });
  if (pickErr) {
    if (isPostgresUniqueViolation(pickErr)) return { skippedDueToRace: true };
    return { error: pickErr.message };
  }

  const clock = new Date();
  const draftDate = clock.toISOString().slice(0, 10);
  const acquiredAtTs = timestamptzForAcquiredAtDate(draftDate, clock);
  const { error: rosterErr } = await admin.from("league_rosters").insert({
    league_id: leagueId,
    user_id: current.user_id,
    wrestler_id: wrestlerId,
    contract: null,
    acquired_at: draftDate,
    acquired_at_ts: acquiredAtTs,
    released_at: null,
  });
  if (rosterErr) {
    const isColumnError = /column.*acquired_at_ts does not exist/i.test(rosterErr.message ?? "");
    if (isColumnError) {
      const { error: rosterErr2 } = await admin.from("league_rosters").insert({
        league_id: leagueId,
        user_id: current.user_id,
        wrestler_id: wrestlerId,
        contract: null,
        acquired_at: draftDate,
        released_at: null,
      });
      if (rosterErr2) {
        await admin.from("league_draft_picks").delete().eq("draft_run_id", draftRunId).eq("overall_pick", current.overall_pick);
        if (isPostgresUniqueViolation(rosterErr2)) return { skippedDueToRace: true };
        return { error: rosterErr2.message };
      }
    } else {
      await admin.from("league_draft_picks").delete().eq("draft_run_id", draftRunId).eq("overall_pick", current.overall_pick);
      if (isPostgresUniqueViolation(rosterErr)) return { skippedDueToRace: true };
      return { error: rosterErr.message };
    }
  }

  await afterAutoPickIncrementState(admin, leagueId, current.user_id);

  const updates: {
    draft_current_pick: number | null;
    draft_status: string;
    draft_current_pick_started_at?: string;
  } =
    nextPick > totalPicks
      ? { draft_current_pick: null, draft_status: "ready_for_review" }
      : {
          draft_current_pick: nextPick,
          draft_status: "in_progress",
          draft_current_pick_started_at: new Date().toISOString(),
        };

  const { error: updateError } = await admin.from("leagues").update(updates).eq("id", leagueId);
  if (updateError) return { error: updateError.message };
  return { nextPick, totalPicks };
}

/** When true, auto-pick runs without waiting for the per-pick timer (e.g. scheduled full autopick). */
export type RunAutoPickOptions = {
  skipTimer?: boolean;
  /** Max successful picks in this invocation; default MAX_AUTOPICK_PICKS_PER_REQUEST. Draft page uses a lower cap. */
  maxPicksPerInvocation?: number;
};

/**
 * If the current pick has exceeded the allotted time (or user is in "takeover" after 3 missed picks), perform auto-pick(s).
 * Uses priority list first, then draft preferences. If a user has missed 3 times in a row, system takes over and auto-picks
 * for them immediately for the rest of the draft (no timer wait). Uses service role.
 * When options.skipTimer is true, runs one or more auto-picks immediately without checking the timer (for scheduled autopick drafts).
 */
export async function runAutoPickIfExpired(
  leagueId: string,
  options?: RunAutoPickOptions
): Promise<{ didAutoPick: boolean; error?: string }> {
  const disabled = process.env.DISABLE_AUTOPICK_DRAFT === "1" || process.env.DISABLE_AUTOPICK_DRAFT === "true";
  if (disabled) return { didAutoPick: false };

  const admin = getAdminClient();
  if (!admin) return { didAutoPick: false, error: "SUPABASE_SERVICE_ROLE_KEY not set." };

  await healStaleDraftCursorChain(admin, leagueId);

  const state = await getLeagueDraftStateUsingAdmin(admin, leagueId);
  if (!state || state.draft_status !== "in_progress" || state.draft_current_pick == null) {
    return { didAutoPick: false };
  }

  // Use admin so we always get the correct picker (cron has no user session; RLS would otherwise limit who we see).
  const current = await getCurrentPickUsingAdmin(admin, leagueId);
  if (!current) return { didAutoPick: false };

  const userState = await getDraftUserState(admin, leagueId, current.user_id);
  const skipTimerByOption = options?.skipTimer === true;
  const { data: leagueRow } = await admin
    .from("leagues")
    .select("time_per_pick_seconds, draft_type")
    .eq("id", leagueId)
    .maybeSingle();
  const draftType =
    (leagueRow as { draft_type?: string } | null)?.draft_type ?? state.draft_type ?? null;
  const rawSec = (leagueRow as { time_per_pick_seconds?: number } | null)?.time_per_pick_seconds;
  const timePerPickSeconds =
    draftType === "autopick"
      ? AUTOPICK_TIME_PER_PICK_SECONDS
      : rawSec != null && [30, 60, 90, 120, 150, 180].includes(rawSec)
        ? rawSec
        : DEFAULT_TIME_PER_PICK_SECONDS;

  const startedAt = state.draft_current_pick_started_at;
  // Autopick has no human on the clock — the 5s value is for display only. Always run picks immediately
  // so one server invocation can finish the whole draft (and cron does not wait on artificial delays).
  const skipTimer =
    skipTimerByOption ||
    userState.auto_pick_rest_of_draft ||
    draftType === "autopick";
  if (!skipTimer) {
    if (!startedAt) return { didAutoPick: false };
    const isFirstPick = state.draft_current_pick === 1;
    const effectiveSeconds =
      timePerPickSeconds + (isFirstPick && draftType !== "autopick" ? FIRST_PICK_BUFFER_SECONDS : 0);
    const deadline = new Date(startedAt).getTime() + effectiveSeconds * 1000;
    if (Date.now() < deadline) return { didAutoPick: false };
  }

  const runBatchAutopick = draftType === "autopick" && skipTimer;
  const pickBudget = options?.maxPicksPerInvocation ?? MAX_AUTOPICK_PICKS_PER_REQUEST;
  if (draftType === "autopick") {
    const coverage = await validateAutopickPriorityCoverage(admin, leagueId);
    if (!coverage.ok) return { didAutoPick: false, error: coverage.error };
  }
  let autopickChampionsBySlug: Record<string, string[]> | undefined;
  let autopickEventPointsBySlug: ReturnType<typeof aggregateWrestlerPoints> | null = null;
  if (draftType === "autopick") {
    const [champRes, ptsRes] = await Promise.all([
      loadAutopickChampionsBySlug(admin).catch(() => ({} as Record<string, string[]>)),
      loadAutopickEventPointsBySlug(admin).catch(() => null),
    ]);
    autopickChampionsBySlug = champRes;
    autopickEventPointsBySlug = ptsRes;
  }
  let didAny = false;
  let cursor: { overall_pick: number; user_id: string } = current;
  let currentPickNum = state.draft_current_pick;
  let totalPicks = state.total_picks ?? 0;
  let batchCount = 0;
  let whileSafety = 0;

  while (true) {
    if (++whileSafety > MAX_AUTOPICK_WHILE_ITERATIONS) {
      return {
        didAutoPick: didAny,
        error: didAny ? undefined : "Autopick stalled (iteration limit). Refresh or ask the GM to check draft state.",
      };
    }
    const result = await performOneAutoPick(
      admin,
      leagueId,
      cursor,
      {
        draft_current_pick: currentPickNum,
        total_picks: totalPicks,
      },
      false,
      autopickChampionsBySlug,
      autopickEventPointsBySlug
    );
    if (result.skippedDueToRace) {
      await healStaleDraftCursorChain(admin, leagueId);
      const s2 = await getLeagueDraftStateUsingAdmin(admin, leagueId);
      const c2 = await getCurrentPickUsingAdmin(admin, leagueId);
      if (!s2 || s2.draft_status !== "in_progress" || s2.draft_current_pick == null || !c2) {
        return { didAutoPick: didAny };
      }
      cursor = c2;
      currentPickNum = s2.draft_current_pick;
      totalPicks = s2.total_picks ?? 0;
      continue;
    }
    if (result.error) return { didAutoPick: didAny, error: result.error };
    didAny = true;
    batchCount += 1;

    const nextPick = result.nextPick ?? currentPickNum + 1;
    if (nextPick > totalPicks) return { didAutoPick: true };

    const { data: nextOrderRow } = await admin
      .from("league_draft_order")
      .select("overall_pick, user_id")
      .eq("league_id", leagueId)
      .eq("overall_pick", nextPick)
      .maybeSingle();
    if (!nextOrderRow) return { didAutoPick: true };

    if (runBatchAutopick) {
      if (batchCount >= pickBudget) return { didAutoPick: true };
      const s2 = await getLeagueDraftStateUsingAdmin(admin, leagueId);
      const c2 = await getCurrentPickUsingAdmin(admin, leagueId);
      if (!s2 || s2.draft_status !== "in_progress" || s2.draft_current_pick == null || !c2) {
        return { didAutoPick: true };
      }
      cursor = c2;
      currentPickNum = s2.draft_current_pick;
      totalPicks = s2.total_picks ?? 0;
      continue;
    }

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
 * Compute scheduled draft time in ms (start of draft_date + draft_time). Returns null if no date.
 * Exported for cron/API route that finds due leagues.
 */
export function getScheduledDraftTimeMs(league: {
  draft_date?: string | null;
  draft_time?: string | null;
}): number | null {
  const raw = league.draft_date ? String(league.draft_date) : null;
  if (!raw) return null;
  const datePart = raw.slice(0, 10);
  const timePart =
    (league.draft_time && String(league.draft_time).trim()) ||
    (raw.length > 10 ? raw.slice(11, 16) : null);
  const timeForDate = timePart && /^\d{1,2}:\d{2}/.test(timePart) ? timePart.slice(0, 5) : "00:00";
  const candidate = new Date(`${datePart}T${timeForDate}:00`);
  return Number.isNaN(candidate.getTime()) ? null : candidate.getTime();
}

/**
 * For autopick leagues: when the scheduled draft time has been reached, start the draft and run all picks to completion.
 * Called when any league member loads the draft page, or by the cron job (Netlify Scheduled Function).
 * Uses service role for league fetch so it works without a logged-in user (cron context).
 */
export async function runFullAutopickDraftAtScheduledTime(
  leagueId: string
): Promise<{ didRun: boolean; error?: string }> {
  const disabled = process.env.DISABLE_AUTOPICK_DRAFT === "1" || process.env.DISABLE_AUTOPICK_DRAFT === "true";
  if (disabled) return { didRun: false };

  const admin = getAdminClient();
  if (!admin) return { didRun: false, error: "SUPABASE_SERVICE_ROLE_KEY not set." };
  const { data: league } = await admin
    .from("leagues")
    .select("id, draft_date, draft_time, draft_type, draft_status")
    .eq("id", leagueId)
    .single();
  if (!league) return { didRun: false };

  const draftType = (league as { draft_type?: string }).draft_type ?? null;
  const draftStatus = (league as { draft_status?: string }).draft_status ?? "not_started";
  if (draftType !== "autopick" || draftStatus !== "not_started") return { didRun: false };

  const scheduledMs = getScheduledDraftTimeMs(league as { draft_date?: string | null; draft_time?: string | null });
  const dueByTime = scheduledMs != null && Date.now() >= scheduledMs;
  const dueByBetaWindow = scheduledMs == null && isInBetaAutopickRunWindow(Date.now());
  if (!dueByTime && !dueByBetaWindow) return { didRun: false };

  let order = await getDraftOrderUsingAdmin(admin, leagueId);
  if (order.length === 0) {
    const gen = await generateDraftOrderForScheduledDraft(leagueId);
    if (gen.error) return { didRun: false, error: gen.error };
    order = await getDraftOrderUsingAdmin(admin, leagueId);
    if (order.length === 0) return { didRun: false, error: "Could not build draft order." };
  }

  const { error: updateErr } = await admin.from("leagues").update({
    draft_status: "in_progress",
    draft_current_pick: 1,
    draft_current_pick_started_at: new Date().toISOString(),
  }).eq("id", leagueId);
  if (updateErr) return { didRun: false, error: updateErr.message };

  while (true) {
    const state = await getLeagueDraftStateUsingAdmin(admin, leagueId);
    if (!state || state.draft_status === "completed") return { didRun: true };
    if (state.draft_status !== "in_progress") return { didRun: true };

    const result = await runAutoPickIfExpired(leagueId, { skipTimer: true });
    if (result.error) return { didRun: true, error: result.error };
    if (!result.didAutoPick) return { didRun: true };
  }
}

/**
 * Clear draft order only (no picks/rosters). Sets draft_status to not_started.
 * Commissioner must be verified by caller. Uses service role.
 */
export async function clearDraftOrder(leagueId: string): Promise<{ error?: string }> {
  const admin = getAdminClient();
  if (!admin) return { error: "SUPABASE_SERVICE_ROLE_KEY not set." };

  const { data: leagueMeta } = await admin
    .from("leagues")
    .select("draft_type")
    .eq("id", leagueId)
    .maybeSingle();
  if ((leagueMeta as { draft_type?: string } | null)?.draft_type === "autopick") {
    const { count } = await admin
      .from("league_draft_order")
      .select("*", { count: "exact", head: true })
      .eq("league_id", leagueId);
    if (count && count > 0) {
      return { error: "Autopick draft order cannot be cleared after it is generated." };
    }
  }

  await admin.from("league_draft_order").delete().eq("league_id", leagueId);
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
 * Restart draft: clear all picks and rosters, reset draft state to not_started.
 * Draft order (league_draft_order) is preserved so the same order is used when the draft is started again.
 * Caller must verify commissioner. Uses service role.
 */
export async function restartDraft(leagueId: string): Promise<{ error?: string }> {
  const admin = getAdminClient();
  if (!admin) return { error: "SUPABASE_SERVICE_ROLE_KEY not set." };

  const { error: picksErr } = await admin.from("league_draft_picks").delete().eq("league_id", leagueId);
  if (picksErr) return { error: picksErr.message };
  const { error: rostersErr } = await admin.from("league_rosters").delete().eq("league_id", leagueId);
  if (rostersErr) return { error: rostersErr.message };
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
