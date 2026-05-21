/**
 * Owner features: next event, lineups (active wrestlers per event), trade/release/free-agent proposals.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  getRosterRulesForLeagueId,
  leagueUsesSalaryCap,
  SALARY_CAP_MAX_ROSTER_SIZE,
} from "@/lib/leagueStructure";
import { getActivePerEvent } from "@/lib/leagueStructure";
import { getActivePerEventForSalaryCapRosterCount } from "@/lib/salaryCap";
import { classifyEventType } from "@/lib/scoring/parsers/eventClassifier.js";
import { removeWrestlerFromRoster } from "@/lib/leagues";
import { addWrestlerToRoster } from "@/lib/leagues";
import { timestamptzForAcquiredAtDate, timestamptzForReleasedAtDate } from "@/lib/rosterTimestamps";
import { assertFaSigningAllowedForLeague } from "@/lib/freeAgentSigningLimits";
import { recordEngagementEvent } from "@/lib/engagementEvents";
import { awardUserXp } from "@/lib/xp/awardUserXp";
import { XP_AMOUNTS } from "@/lib/xp/xpReasons";

function normalizeGender(g: string | null | undefined): "F" | "M" | null {
  if (g == null || typeof g !== "string") return null;
  const l = g.trim().toLowerCase();
  if (
    l === "female" ||
    l === "f" ||
    l === "woman" ||
    l === "women" ||
    l === "girl" ||
    l === "she" ||
    l.startsWith("fem")
  ) {
    return "F";
  }
  if (l === "male" || l === "m" || l === "man" || l === "men" || l === "boy" || l.startsWith("mal")) {
    return "M";
  }
  return null;
}

type LeagueActivityInsert = {
  league_id: string;
  activity_type: "drop" | "fa_add";
  user_id: string;
  wrestler_id: string;
  secondary_wrestler_id: string | null;
};

/**
 * Persist a roster feed row. Prefer the caller's session (RLS policies on league_activity);
 * fall back to service role if needed. Logs failures — roster mutations already succeeded.
 */
async function insertLeagueActivityRow(userClient: SupabaseClient, row: LeagueActivityInsert): Promise<void> {
  const { data: inserted, error } = await userClient.from("league_activity").insert(row).select("id").maybeSingle();
  if (!error) {
    await recordEngagementEvent({
      eventName: row.activity_type === "fa_add" ? "league.fa_add" : "league.drop",
      userId: row.user_id,
      leagueId: row.league_id,
    });
    if (row.activity_type === "fa_add" && inserted && (inserted as { id?: string }).id) {
      void awardUserXp({
        userId: row.user_id,
        delta: XP_AMOUNTS.free_agent_move,
        reason: "free_agent_move",
        idempotencyKey: `fa_add:${(inserted as { id: string }).id}`,
        metadata: { leagueId: row.league_id, wrestlerId: row.wrestler_id },
      });
    }
    return;
  }
  const admin = getAdminClient();
  if (admin) {
    const { data: ins2, error: e2 } = await admin.from("league_activity").insert(row).select("id").maybeSingle();
    if (e2) {
      console.error("[league_activity] insert failed (user then admin):", error.message, "|", e2.message);
    } else {
      await recordEngagementEvent({
        eventName: row.activity_type === "fa_add" ? "league.fa_add" : "league.drop",
        userId: row.user_id,
        leagueId: row.league_id,
      });
      if (row.activity_type === "fa_add" && ins2 && (ins2 as { id?: string }).id) {
        void awardUserXp({
          userId: row.user_id,
          delta: XP_AMOUNTS.free_agent_move,
          reason: "free_agent_move",
          idempotencyKey: `fa_add:${(ins2 as { id: string }).id}`,
          metadata: { leagueId: row.league_id, wrestlerId: row.wrestler_id },
        });
      }
    }
    return;
  }
  console.error("[league_activity] insert failed (no service role fallback):", error.message);
}

export type UpcomingEvent = { id: string; name: string; date: string; eventType: string };

async function getInEventLockMessage(supabase: SupabaseClient): Promise<string | null> {
  const minDate = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: events, error } = await supabase
    .from("events")
    .select("name, status, date, broadcast_start_ts")
    .in("status", ["live", "upcoming"])
    .gte("date", minDate)
    .order("date", { ascending: true })
    .limit(8);
  if (error || !events?.length) return null;

  const nowMs = Date.now();
  const rows = (events ?? []) as Array<{
    name?: string | null;
    status?: string | null;
    date?: string | null;
    broadcast_start_ts?: string | null;
  }>;

  const live = rows.find((e) => String(e.status ?? "").toLowerCase() === "live");
  if (live) {
    return `Roster and lineup changes are locked while ${live.name ?? "the live event"} is in progress.`;
  }

  const startedUpcoming = rows.find((e) => {
    if (String(e.status ?? "").toLowerCase() !== "upcoming") return false;
    if (!e.broadcast_start_ts) return false;
    const startMs = Date.parse(String(e.broadcast_start_ts));
    return Number.isFinite(startMs) && startMs <= nowMs;
  });
  if (startedUpcoming) {
    return `Roster and lineup changes are locked while ${startedUpcoming.name ?? "the current event"} is in progress.`;
  }

  return null;
}

/** Next upcoming event (date >= today), optionally prefer SmackDown. */
export async function getNextUpcomingEvent(
  options?: { preferSmackDown?: boolean }
): Promise<UpcomingEvent | null> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: events, error } = await supabase
    .from("events")
    .select("id, name, date")
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(options?.preferSmackDown ? 20 : 1);

  if (error || !events?.length) return null;
  const list = (events ?? []) as { id: string; name: string; date: string }[];

  if (options?.preferSmackDown) {
    const smackdown = list.find(
      (e) => classifyEventType(e.name, e.id) === "smackdown"
    );
    if (smackdown)
      return {
        id: smackdown.id,
        name: smackdown.name,
        date: smackdown.date,
        eventType: "smackdown",
      };
  }
  const first = list[0];
  return {
    id: first.id,
    name: first.name,
    date: first.date,
    eventType: classifyEventType(first.name, first.id) ?? "unknown",
  };
}

/** Get active wrestler ids for an owner at an event. */
export async function getLineupForEvent(
  leagueId: string,
  userId: string,
  eventId: string
): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("league_lineups")
    .select("wrestler_id")
    .eq("league_id", leagueId)
    .eq("user_id", userId)
    .eq("event_id", eventId);
  if (error) return [];
  return (data ?? []).map((r: { wrestler_id: string }) => r.wrestler_id);
}

/** Set lineup (replace). Validates count <= activePerEvent and wrestlers on roster. */
export async function setLineupForEvent(
  leagueId: string,
  userId: string,
  eventId: string,
  wrestlerIds: string[]
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== userId) return { error: "Not authenticated." };
  const eventLock = await getInEventLockMessage(supabase);
  if (eventLock) return { error: eventLock };

  const { data: leagueLineupMeta } = await supabase
    .from("leagues")
    .select("league_type")
    .eq("id", leagueId)
    .maybeSingle();
  const lineupLeagueType = (leagueLineupMeta as { league_type?: string | null } | null)?.league_type ?? null;

  const { data: rosterCountRows } = await supabase
    .from("league_rosters")
    .select("wrestler_id")
    .eq("league_id", leagueId)
    .eq("user_id", userId)
    .is("released_at", null);
  const rosterCount = (rosterCountRows ?? []).length;

  const rulesForLineup = await getRosterRulesForLeagueId(supabase, leagueId);
  const activePer = leagueUsesSalaryCap(lineupLeagueType)
    ? getActivePerEventForSalaryCapRosterCount(rosterCount)
    : getActivePerEvent(rulesForLineup?.rosterSize ?? 0);
  if (activePer == null) return { error: "Invalid league size." };
  if (wrestlerIds.length > activePer)
    return { error: `You can start at most ${activePer} wrestlers.` };

  const { data: roster } = await supabase
    .from("league_rosters")
    .select("wrestler_id")
    .eq("league_id", leagueId)
    .eq("user_id", userId);
  const onRoster = new Set((roster ?? []).map((r: { wrestler_id: string }) => r.wrestler_id));
  for (const wid of wrestlerIds) {
    if (!onRoster.has(wid)) return { error: "All wrestlers must be on your roster." };
  }

  await supabase
    .from("league_lineups")
    .delete()
    .eq("league_id", leagueId)
    .eq("user_id", userId)
    .eq("event_id", eventId);

  if (wrestlerIds.length > 0) {
    const { error: insErr } = await supabase.from("league_lineups").insert(
      wrestlerIds.map((wrestler_id) => ({
        league_id: leagueId,
        user_id: userId,
        event_id: eventId,
        wrestler_id,
      }))
    );
    if (insErr) return { error: insErr.message };
  }
  return {};
}

// --- Trade proposals ---

export type TradeProposal = {
  id: string;
  league_id: string;
  from_user_id: string;
  to_user_id: string;
  status: string;
  created_at: string;
  responded_at?: string | null;
  to_responded_at?: string | null;
  accepted_at?: string | null;
  gm_responded_at?: string | null;
  executed_at?: string | null;
  cancelled_at?: string | null;
  expired_at?: string | null;
  to_user_drop_ids?: string[] | null;
  items: { wrestler_id: string; direction: "give" | "receive" }[];
};

export async function getTradeProposalsForLeague(
  leagueId: string
): Promise<TradeProposal[]> {
  const supabase = await createClient();
  const full = await supabase
    .from("league_trade_proposals")
    .select("id, league_id, from_user_id, to_user_id, status, created_at, responded_at, to_responded_at, accepted_at, gm_responded_at, executed_at, cancelled_at, expired_at, to_user_drop_ids")
    .eq("league_id", leagueId)
    .order("created_at", { ascending: false });
  let proposals: TradeProposal[] | null = (full.data ?? null) as TradeProposal[] | null;
  let error = full.error;

  const isColumnError =
    error &&
    (error.code === "42703" ||
      /column.*does not exist/i.test(error.message ?? "") ||
      /schema cache/i.test(error.message ?? ""));
  if (isColumnError) {
    const fallback = await supabase
      .from("league_trade_proposals")
      .select("id, league_id, from_user_id, to_user_id, status, created_at, responded_at")
      .eq("league_id", leagueId)
      .order("created_at", { ascending: false });
    proposals = ((fallback.data ?? []) as TradeProposal[]).map((p) => ({
      ...(p as TradeProposal),
      to_responded_at: null,
      accepted_at: null,
      gm_responded_at: null,
      executed_at: null,
      cancelled_at: null,
      expired_at: null,
      to_user_drop_ids: null,
      items: [],
    }));
    error = fallback.error;
  }

  if (error || !proposals?.length) return [];

  const ids = (proposals as { id: string }[]).map((p) => p.id);
  const { data: items } = await supabase
    .from("league_trade_proposal_items")
    .select("proposal_id, wrestler_id, direction")
    .in("proposal_id", ids);
  const byProposal: Record<string, { wrestler_id: string; direction: "give" | "receive" }[]> = {};
  for (const it of items ?? []) {
    const pid = (it as { proposal_id: string }).proposal_id;
    if (!byProposal[pid]) byProposal[pid] = [];
    byProposal[pid].push({
      wrestler_id: (it as { wrestler_id: string }).wrestler_id,
      direction: (it as { direction: "give" | "receive" }).direction,
    });
  }
  return (proposals as TradeProposal[]).map((p) => ({
    ...p,
    items: byProposal[p.id] ?? [],
  }));
}

/** Statuses where roster spots are still committed to a trade until it executes or is cancelled. */
const ACTIVE_TRADE_LOCK_STATUSES = ["pending", "awaiting_gm_approval", "gm_approved"] as const;

/**
 * Shown when a manager tries to drop (or FA-drop) a wrestler tied to an unfinished trade.
 */
export const TRADE_DROP_LOCK_MESSAGE =
  "This wrestler is part of a trade that's still pending or waiting on the GM (including someone you chose to drop to make room for that trade). Cancel that trade or wait until it completes before dropping them.";

/**
 * Wrestler IDs the owner must not drop while those trades are unfinished:
 * - As trade proposer: every wrestler you're giving (`direction === "give"`).
 * - As trade recipient: every wrestler you're trading away (`direction === "receive"`) plus any
 *   `to_user_drop_ids` chosen when you accepted (roster cuts for that deal).
 */
export async function getWrestlerIdsLockedByPendingTrades(
  leagueId: string,
  userId: string
): Promise<string[]> {
  const supabase = await createClient();

  type TradeLockProposalRow = {
    id: string;
    from_user_id: string;
    to_user_id: string;
    status: string;
    to_user_drop_ids?: string[] | null;
    executed_at?: string | null;
  };
  let proposals: TradeLockProposalRow[] = [];

  const selectFull =
    "id, from_user_id, to_user_id, status, to_user_drop_ids, executed_at" as const;
  let full = await supabase
    .from("league_trade_proposals")
    .select(selectFull)
    .eq("league_id", leagueId)
    .in("status", [...ACTIVE_TRADE_LOCK_STATUSES]);

  const isColError = (e: typeof full.error) =>
    !!e &&
    (e.code === "42703" ||
      /column.*does not exist/i.test(e.message ?? "") ||
      /schema cache/i.test(e.message ?? ""));

  if (full.error && isColError(full.error)) {
    const minimal = await supabase
      .from("league_trade_proposals")
      .select("id, from_user_id, to_user_id, status")
      .eq("league_id", leagueId)
      .in("status", ["pending", "awaiting_gm_approval"]);
    if (minimal.error || !minimal.data?.length) return [];
    const md = minimal.data as { id: string; from_user_id: string; to_user_id: string; status: string }[];
    proposals = md.map((p) => ({
      ...p,
      to_user_drop_ids: null,
      executed_at: null,
    }));
  } else if (full.error || !full.data?.length) {
    return [];
  } else {
    proposals = full.data as TradeLockProposalRow[];
  }

  const unfinished = proposals.filter((p) => {
    const ex = p.executed_at;
    return ex == null || String(ex).trim() === "";
  });
  const ids = unfinished.map((p) => p.id);
  if (ids.length === 0) return [];

  const { data: items } = await supabase
    .from("league_trade_proposal_items")
    .select("proposal_id, wrestler_id, direction")
    .in("proposal_id", ids);

  const byProposal: Record<string, { wrestler_id: string; direction: string }[]> = {};
  for (const it of items ?? []) {
    const row = it as { proposal_id: string; wrestler_id: string; direction: string };
    if (!byProposal[row.proposal_id]) byProposal[row.proposal_id] = [];
    byProposal[row.proposal_id].push({
      wrestler_id: row.wrestler_id,
      direction: row.direction,
    });
  }

  const locked = new Set<string>();
  for (const p of unfinished) {
    const pit = byProposal[p.id] ?? [];
    if (p.from_user_id === userId) {
      for (const it of pit) {
        if (it.direction === "give") locked.add(String(it.wrestler_id).trim());
      }
    }
    if (p.to_user_id === userId) {
      for (const it of pit) {
        if (it.direction === "receive") locked.add(String(it.wrestler_id).trim());
      }
      const drops = (p.to_user_drop_ids ?? []) as string[];
      for (const d of drops) {
        const t = String(d).trim();
        if (t) locked.add(t);
      }
    }
  }
  return [...locked];
}

/** Block roster drops that would break a pending / in-flight trade (server-side). */
export async function assertWrestlerNotTradeLocked(
  leagueId: string,
  rosterOwnerUserId: string,
  wrestlerId: string
): Promise<{ error?: string }> {
  const wid = String(wrestlerId).trim();
  if (!wid) return {};
  const locked = new Set(await getWrestlerIdsLockedByPendingTrades(leagueId, rosterOwnerUserId));
  if (locked.has(wid)) return { error: TRADE_DROP_LOCK_MESSAGE };
  return {};
}

/** Validate that after the trade both rosters would meet min/max and gender rules. */
export async function validateTradeRosters(
  leagueId: string,
  fromUserId: string,
  toUserId: string,
  giveWrestlerIds: string[],
  receiveWrestlerIds: string[]
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const giveIds = giveWrestlerIds.map((id) => id.trim()).filter(Boolean);
  const receiveIds = receiveWrestlerIds.map((id) => id.trim()).filter(Boolean);
  if (giveIds.length === 0 && receiveIds.length === 0) return { error: "Add at least one wrestler to give or receive." };

  const rules = await getRosterRulesForLeagueId(supabase, leagueId);
  if (!rules) return { error: "League roster rules could not be loaded." };

  const minTotal = rules.minFemale + rules.minMale;

  const { data: fromRows } = await supabase
    .from("league_rosters")
    .select("wrestler_id")
    .eq("league_id", leagueId)
    .eq("user_id", fromUserId)
    .is("released_at", null);
  const { data: toRows } = await supabase
    .from("league_rosters")
    .select("wrestler_id")
    .eq("league_id", leagueId)
    .eq("user_id", toUserId)
    .is("released_at", null);
  const fromRoster = new Set((fromRows ?? []).map((r: { wrestler_id: string }) => r.wrestler_id));
  const toRoster = new Set((toRows ?? []).map((r: { wrestler_id: string }) => r.wrestler_id));

  for (const id of giveIds) {
    if (!fromRoster.has(id)) return { error: `Wrestler you're giving (${id}) is not on your roster.` };
  }
  for (const id of receiveIds) {
    if (!toRoster.has(id)) return { error: `Wrestler you're receiving (${id}) is not on the other manager's roster.` };
  }

  const allIds = [...new Set([...fromRoster, ...toRoster, ...giveIds, ...receiveIds])];
  const { data: wrestlerRows } = await supabase
    .from("wrestlers")
    .select("id, gender")
    .in("id", allIds);
  const genderById: Record<string, "F" | "M" | null> = {};
  for (const w of wrestlerRows ?? []) {
    genderById[(w as { id: string }).id] = normalizeGender((w as { gender: string | null }).gender);
  }

  const fromAfter = new Set(fromRoster);
  giveIds.forEach((id) => fromAfter.delete(id));
  receiveIds.forEach((id) => fromAfter.add(id));
  const toAfter = new Set(toRoster);
  receiveIds.forEach((id) => toAfter.delete(id));
  giveIds.forEach((id) => toAfter.add(id));

  let fromF = 0;
  let fromM = 0;
  for (const id of fromAfter) {
    const g = genderById[id];
    if (g === "F") fromF++;
    else if (g === "M") fromM++;
  }
  let toF = 0;
  let toM = 0;
  for (const id of toAfter) {
    const g = genderById[id];
    if (g === "F") toF++;
    else if (g === "M") toM++;
  }
  const fromTotal = fromAfter.size;
  const toTotal = toAfter.size;

  if (fromTotal > rules.rosterSize) {
    return { error: `After this trade your roster would have ${fromTotal} wrestlers. Maximum is ${rules.rosterSize}.` };
  }
  if (fromTotal < minTotal || fromF < rules.minFemale || fromM < rules.minMale) {
    return {
      error: `After this trade your roster would not meet the minimum (${minTotal} wrestlers, ${rules.minFemale} women, ${rules.minMale} men). You would have ${fromTotal} (${fromF} women, ${fromM} men).`,
    };
  }
  // Allow proposals that would put the recipient over roster max (e.g. 2-for-1).
  // Recipient will be required to choose drops when accepting (see respondToTradeProposal).
  if (toTotal < minTotal || toF < rules.minFemale || toM < rules.minMale) {
    return {
      error: `After this trade the other manager's roster would not meet the minimum (${minTotal} wrestlers, ${rules.minFemale} women, ${rules.minMale} men). Their roster would have ${toTotal} (${toF} women, ${toM} men).`,
    };
  }
  return {};
}

export async function createTradeProposal(
  leagueId: string,
  fromUserId: string,
  toUserId: string,
  giveWrestlerIds: string[],
  receiveWrestlerIds: string[]
): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== fromUserId) return { error: "Not authenticated." };
  if (fromUserId === toUserId) return { error: "Cannot trade with yourself." };
  if (giveWrestlerIds.length === 0 && receiveWrestlerIds.length === 0)
    return { error: "Add at least one wrestler to give or receive." };

  const validation = await validateTradeRosters(
    leagueId,
    fromUserId,
    toUserId,
    giveWrestlerIds,
    receiveWrestlerIds
  );
  if (validation.error) return validation;

  const { data: proposal, error: propErr } = await supabase
    .from("league_trade_proposals")
    .insert({
      league_id: leagueId,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      status: "pending",
    })
    .select("id")
    .single();
  if (propErr || !proposal?.id) return { error: propErr?.message ?? "Failed to create proposal." };

  const itemRows: { proposal_id: string; wrestler_id: string; direction: "give" | "receive" }[] = [
    ...giveWrestlerIds.map((wrestler_id) => ({ proposal_id: proposal.id, wrestler_id, direction: "give" as const })),
    ...receiveWrestlerIds.map((wrestler_id) => ({ proposal_id: proposal.id, wrestler_id, direction: "receive" as const })),
  ];
  if (itemRows.length > 0) {
    const { error: itemsErr } = await supabase.from("league_trade_proposal_items").insert(itemRows);
    if (itemsErr) return { error: itemsErr.message };
  }
  await recordEngagementEvent({
    eventName: "league.trade_proposed",
    userId: fromUserId,
    leagueId,
    metadata: { proposalId: proposal.id, toUserId },
  });
  return { id: proposal.id };
}

export async function cancelTradeProposal(
  proposalId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: proposal } = await supabase
    .from("league_trade_proposals")
    .select("from_user_id, status")
    .eq("id", proposalId)
    .single();
  if (!proposal) return { error: "Proposal not found." };
  if (proposal.from_user_id !== user.id) return { error: "Only the proposer can cancel this trade." };
  if (proposal.status !== "pending") return { error: "Only pending trades can be cancelled." };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("league_trade_proposals")
    .update({ status: "cancelled", cancelled_at: now })
    .eq("id", proposalId);
  return error ? { error: error.message } : {};
}

function uniqTrim(ids: string[] | undefined | null): string[] {
  return [...new Set((ids ?? []).map((x) => String(x).trim()).filter(Boolean))];
}

function computeRosterCounts(ids: Iterable<string>, genderById: Record<string, "F" | "M" | null>) {
  let f = 0;
  let m = 0;
  let total = 0;
  for (const id of ids) {
    total += 1;
    const g = genderById[id];
    if (g === "F") f += 1;
    else if (g === "M") m += 1;
  }
  return { total, f, m };
}

type AdminSupabase = NonNullable<ReturnType<typeof getAdminClient>>;

/**
 * Validates that the trade can still run with current active rosters: trade pieces present,
 * agreed recipient roster cuts still on the recipient's roster, and post-trade roster rules met.
 * Prevents executing when the recipient dropped their chosen cut early or roster size changed.
 */
async function assertTradeExecutable(
  admin: AdminSupabase,
  proposalId: string
): Promise<{ error?: string }> {
  const { data: proposal } = await admin
    .from("league_trade_proposals")
    .select("league_id, from_user_id, to_user_id, to_user_drop_ids")
    .eq("id", proposalId)
    .single();
  if (!proposal) return { error: "Proposal not found." };

  const { data: items } = await admin
    .from("league_trade_proposal_items")
    .select("wrestler_id, direction")
    .eq("proposal_id", proposalId);

  const giveIds = uniqTrim((items ?? []).filter((i) => (i as { direction: string }).direction === "give").map((i) => (i as { wrestler_id: string }).wrestler_id));
  const receiveIds = uniqTrim((items ?? []).filter((i) => (i as { direction: string }).direction === "receive").map((i) => (i as { wrestler_id: string }).wrestler_id));
  const dropIds = uniqTrim(((proposal as { to_user_drop_ids?: string[] | null }).to_user_drop_ids ?? []) as string[]);

  const rules = await getRosterRulesForLeagueId(admin, proposal.league_id);
  if (!rules) return { error: "League roster rules could not be loaded." };
  const minTotal = rules.minFemale + rules.minMale;
  const rosterSize = rules.rosterSize;

  const [{ data: fromRows }, { data: toRows }] = await Promise.all([
    admin
      .from("league_rosters")
      .select("wrestler_id")
      .eq("league_id", proposal.league_id)
      .eq("user_id", proposal.from_user_id)
      .is("released_at", null),
    admin
      .from("league_rosters")
      .select("wrestler_id")
      .eq("league_id", proposal.league_id)
      .eq("user_id", proposal.to_user_id)
      .is("released_at", null),
  ]);

  const fromRoster = new Set((fromRows ?? []).map((r: { wrestler_id: string }) => r.wrestler_id));
  const toRoster = new Set((toRows ?? []).map((r: { wrestler_id: string }) => r.wrestler_id));

  for (const id of giveIds) {
    if (!fromRoster.has(id))
      return { error: "Trade cannot execute: proposer no longer has a traded wrestler on their active roster." };
  }
  for (const id of receiveIds) {
    if (!toRoster.has(id))
      return { error: "Trade cannot execute: recipient no longer has a traded wrestler on their active roster." };
  }

  const delta = giveIds.length - receiveIds.length;
  const wouldBeWithoutDrops = toRoster.size + delta;
  const requiredDropCount = Math.max(0, wouldBeWithoutDrops - rosterSize);

  if (requiredDropCount !== dropIds.length) {
    if (requiredDropCount > dropIds.length) {
      return {
        error: `Trade cannot execute: recipient needs ${requiredDropCount} roster cut(s) to stay at or under ${rosterSize} after the swap, but this trade only records ${dropIds.length}. The recipient's roster may have changed after accepting.`,
      };
    }
    return {
      error:
        dropIds.length > 0
          ? `Trade cannot execute: recipient roster no longer requires the recorded roster cut(s) for this swap. The roster may have changed after accepting.`
          : `Trade cannot execute: recipient roster cut count no longer matches (need ${requiredDropCount}, have ${dropIds.length}).`,
    };
  }

  for (const id of dropIds) {
    if (!toRoster.has(id)) {
      return {
        error:
          "Trade cannot execute: the recipient's agreed roster cut is not on their active roster (they may have dropped that wrestler or replaced them).",
      };
    }
    if (receiveIds.includes(id)) {
      return { error: "Trade cannot execute: invalid state — roster cut overlaps a wrestler being traded away." };
    }
  }

  const allIds = [...new Set([...fromRoster, ...toRoster, ...giveIds, ...receiveIds, ...dropIds])];
  const { data: wrestlerRows } = await admin.from("wrestlers").select("id, gender").in("id", allIds);
  const genderById: Record<string, "F" | "M" | null> = {};
  for (const w of wrestlerRows ?? []) {
    genderById[(w as { id: string }).id] = normalizeGender((w as { gender: string | null }).gender);
  }

  const fromAfter = new Set(fromRoster);
  giveIds.forEach((id) => fromAfter.delete(id));
  receiveIds.forEach((id) => fromAfter.add(id));

  const toAfter = new Set(toRoster);
  receiveIds.forEach((id) => toAfter.delete(id));
  giveIds.forEach((id) => toAfter.add(id));
  dropIds.forEach((id) => toAfter.delete(id));

  const fromCounts = computeRosterCounts(fromAfter, genderById);
  const toCounts = computeRosterCounts(toAfter, genderById);

  if (fromCounts.total > rosterSize) {
    return { error: `Trade cannot execute: proposer would exceed the roster limit (${rosterSize}).` };
  }
  if (toCounts.total > rosterSize) {
    return { error: `Trade cannot execute: recipient would exceed the roster limit (${rosterSize}).` };
  }
  if (fromCounts.total < minTotal || fromCounts.f < rules.minFemale || fromCounts.m < rules.minMale) {
    return { error: "Trade cannot execute: proposer would violate roster minimums after the swap." };
  }
  if (toCounts.total < minTotal || toCounts.f < rules.minFemale || toCounts.m < rules.minMale) {
    return { error: "Trade cannot execute: recipient would violate roster minimums after the swap." };
  }

  return {};
}

async function cancelConflictingTradeProposals(
  admin: ReturnType<typeof getAdminClient>,
  params: {
    leagueId: string;
    approvedProposalId: string;
    leavingByFromUser: string[];
    leavingByToUser: string[];
  }
): Promise<{ cancelled: number; errors: string[] }> {
  const errors: string[] = [];
  let cancelled = 0;
  if (!admin) return { cancelled: 0, errors: ["Service role required to cancel conflicting trades."] };

  const now = new Date().toISOString();
  const leavingFrom = uniqTrim(params.leavingByFromUser);
  const leavingTo = uniqTrim(params.leavingByToUser);

  // Cancel other proposals where a party is offering a wrestler that will no longer be on their roster.
  // Direction semantics: 'give' = from_user_id gives; 'receive' = to_user_id gives.
  // Conflicts for:
  // - from_user offering: proposals where from_user_id = from_user and item.direction='give' includes wrestler
  // - to_user offering: proposals where to_user_id = to_user and item.direction='receive' includes wrestler
  const cancelForUser = async (userRole: "from_user_id" | "to_user_id", direction: "give" | "receive", wrestlerIds: string[]) => {
    if (wrestlerIds.length === 0) return;
    const { data: conflicts } = await admin
      .from("league_trade_proposal_items")
      .select("proposal_id, wrestler_id")
      .in("wrestler_id", wrestlerIds);

    const proposalIds = uniqTrim((conflicts ?? []).map((r) => (r as { proposal_id: string }).proposal_id))
      .filter((id) => id !== params.approvedProposalId);
    if (proposalIds.length === 0) return;

    // Load proposals and filter in memory to avoid needing joins.
    const { data: proposals } = await admin
      .from("league_trade_proposals")
      .select("id, league_id, from_user_id, to_user_id, status")
      .eq("league_id", params.leagueId)
      .in("id", proposalIds);

    const validIds: string[] = [];
    for (const p of proposals ?? []) {
      const row = p as { id: string; from_user_id: string; to_user_id: string; status: string };
      if (!["pending", "awaiting_gm_approval"].includes(row.status)) continue;
      const userId = userRole === "from_user_id" ? row.from_user_id : row.to_user_id;
      const matchesUser = userRole === "from_user_id" ? userId === (direction === "give" ? (proposals?.[0] as any)?.from_user_id : userId) : true;
      // We'll enforce correct user match in outer call by pre-filtering proposal sets below.
      void matchesUser;
      validIds.push(row.id);
    }

    // Further restrict by role/user and item direction for each proposal.
    // We do a second pass by reading items for those proposals and checking direction matches and wrestler overlap.
    const { data: items } = await admin
      .from("league_trade_proposal_items")
      .select("proposal_id, wrestler_id, direction")
      .in("proposal_id", validIds);

    const itemsByProposal: Record<string, { wrestler_id: string; direction: string }[]> = {};
    for (const it of items ?? []) {
      const r = it as { proposal_id: string; wrestler_id: string; direction: string };
      if (!itemsByProposal[r.proposal_id]) itemsByProposal[r.proposal_id] = [];
      itemsByProposal[r.proposal_id].push({ wrestler_id: r.wrestler_id, direction: r.direction });
    }

    for (const p of proposals ?? []) {
      const row = p as { id: string; from_user_id: string; to_user_id: string; status: string };
      if (!["pending", "awaiting_gm_approval"].includes(row.status)) continue;
      if (row.id === params.approvedProposalId) continue;

      // Match the relevant offering user depending on which side is losing wrestlers.
      const offeringUserId = userRole === "from_user_id" ? row.from_user_id : row.to_user_id;
      const mustMatchUser = userRole === "from_user_id" ? (offeringUserId === row.from_user_id) : (offeringUserId === row.to_user_id);
      if (!mustMatchUser) continue;

      const its = itemsByProposal[row.id] ?? [];
      const overlaps = its.some((x) => x.direction === direction && wrestlerIds.includes(x.wrestler_id));
      if (!overlaps) continue;

      const { error } = await admin
        .from("league_trade_proposals")
        .update({ status: "cancelled", cancelled_at: now, responded_at: now })
        .eq("id", row.id)
        .in("status", ["pending", "awaiting_gm_approval"]);
      if (error) errors.push(`${row.id}: ${error.message}`);
      else cancelled += 1;
    }
  };

  // We can’t easily infer the offering user id inside cancelForUser without passing it; do it directly:
  // from_user offers via direction='give'
  if (leavingFrom.length > 0) {
    const { data: proposals } = await admin
      .from("league_trade_proposals")
      .select("id, from_user_id, status")
      .eq("league_id", params.leagueId)
      .in("status", ["pending", "awaiting_gm_approval"]);
    const candidateIds = uniqTrim((proposals ?? []).map((p) => (p as { id: string }).id))
      .filter((id) => id !== params.approvedProposalId);
    if (candidateIds.length > 0) {
      const { data: items } = await admin
        .from("league_trade_proposal_items")
        .select("proposal_id, wrestler_id, direction")
        .in("proposal_id", candidateIds)
        .in("wrestler_id", leavingFrom);
      const conflictIds = uniqTrim((items ?? []).filter((i) => (i as { direction: string }).direction === "give").map((i) => (i as { proposal_id: string }).proposal_id));
      for (const id of conflictIds) {
        const { error } = await admin
          .from("league_trade_proposals")
          .update({ status: "cancelled", cancelled_at: now, responded_at: now })
          .eq("id", id)
          .in("status", ["pending", "awaiting_gm_approval"]);
        if (error) errors.push(`${id}: ${error.message}`);
        else cancelled += 1;
      }
    }
  }

  // to_user offers via direction='receive', plus drops already applied.
  if (leavingTo.length > 0) {
    const { data: proposals } = await admin
      .from("league_trade_proposals")
      .select("id, to_user_id, status")
      .eq("league_id", params.leagueId)
      .in("status", ["pending", "awaiting_gm_approval"]);
    const candidateIds = uniqTrim((proposals ?? []).map((p) => (p as { id: string }).id))
      .filter((id) => id !== params.approvedProposalId);
    if (candidateIds.length > 0) {
      const { data: items } = await admin
        .from("league_trade_proposal_items")
        .select("proposal_id, wrestler_id, direction")
        .in("proposal_id", candidateIds)
        .in("wrestler_id", leavingTo);
      const conflictIds = uniqTrim((items ?? []).filter((i) => (i as { direction: string }).direction === "receive").map((i) => (i as { proposal_id: string }).proposal_id));
      for (const id of conflictIds) {
        const { error } = await admin
          .from("league_trade_proposals")
          .update({ status: "cancelled", cancelled_at: now, responded_at: now })
          .eq("id", id)
          .in("status", ["pending", "awaiting_gm_approval"]);
        if (error) errors.push(`${id}: ${error.message}`);
        else cancelled += 1;
      }
    }
  }

  return { cancelled, errors };
}

export async function respondToTradeProposal(
  proposalId: string,
  accept: boolean,
  toUserDropIds?: string[]
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: proposal } = await supabase
    .from("league_trade_proposals")
    .select("league_id, from_user_id, to_user_id, status")
    .eq("id", proposalId)
    .single();
  if (!proposal || proposal.status !== "pending")
    return { error: "Proposal not found or already responded." };

  if (proposal.to_user_id !== user.id) return { error: "Only the recipient can accept or decline this proposal." };

  const now = new Date().toISOString();

  if (!accept) {
    const { error: updateErr } = await supabase
      .from("league_trade_proposals")
      .update({ status: "rejected", responded_at: now, to_responded_at: now })
      .eq("id", proposalId);
    if (updateErr) return { error: updateErr.message };
    return {};
  }

  // Accept: if trade is unbalanced such that recipient would exceed roster max, require drop selection.
  const { data: items } = await supabase
    .from("league_trade_proposal_items")
    .select("wrestler_id, direction")
    .eq("proposal_id", proposalId);

  const giveIds = uniqTrim((items ?? []).filter((i) => (i as { direction: string }).direction === "give").map((i) => (i as { wrestler_id: string }).wrestler_id));
  const receiveIds = uniqTrim((items ?? []).filter((i) => (i as { direction: string }).direction === "receive").map((i) => (i as { wrestler_id: string }).wrestler_id));

  // Load roster rules
  const rules = await getRosterRulesForLeagueId(supabase, proposal.league_id);
  if (!rules) return { error: "League roster rules could not be loaded." };
  const minTotal = rules.minFemale + rules.minMale;

  // Current rosters
  const [{ data: fromRows }, { data: toRows }] = await Promise.all([
    supabase
      .from("league_rosters")
      .select("wrestler_id")
      .eq("league_id", proposal.league_id)
      .eq("user_id", proposal.from_user_id)
      .is("released_at", null),
    supabase
      .from("league_rosters")
      .select("wrestler_id")
      .eq("league_id", proposal.league_id)
      .eq("user_id", proposal.to_user_id)
      .is("released_at", null),
  ]);
  const fromRoster = new Set((fromRows ?? []).map((r: { wrestler_id: string }) => r.wrestler_id));
  const toRoster = new Set((toRows ?? []).map((r: { wrestler_id: string }) => r.wrestler_id));

  // Sanity: items must still be on rosters.
  for (const id of giveIds) if (!fromRoster.has(id)) return { error: `Wrestler being traded (${id}) is no longer on the proposer's roster.` };
  for (const id of receiveIds) if (!toRoster.has(id)) return { error: `Wrestler being traded (${id}) is no longer on your roster.` };

  const dropIds = uniqTrim(toUserDropIds);
  const delta = giveIds.length - receiveIds.length; // recipient net gain
  const wouldBe = toRoster.size + delta;
  const requiredDrops = Math.max(0, wouldBe - rules.rosterSize);
  if (requiredDrops > 0 && dropIds.length !== requiredDrops) {
    return { error: `Accepting this trade would put you over the roster max. Please select ${requiredDrops} wrestler${requiredDrops === 1 ? "" : "s"} to drop.` };
  }

  // Drops must be on recipient roster and not already being traded away.
  for (const id of dropIds) {
    if (!toRoster.has(id)) return { error: "Selected drop must be on your roster." };
    if (receiveIds.includes(id)) return { error: "You can't drop a wrestler you're trading away." };
  }

  // Validate rosters after applying trade + drops (recipient only; proposer was validated at proposal time).
  const allIds = [...new Set([...fromRoster, ...toRoster, ...giveIds, ...receiveIds, ...dropIds])];
  const { data: wrestlerRows } = await supabase
    .from("wrestlers")
    .select("id, gender")
    .in("id", allIds);
  const genderById: Record<string, "F" | "M" | null> = {};
  for (const w of wrestlerRows ?? []) {
    genderById[(w as { id: string }).id] = normalizeGender((w as { gender: string | null }).gender);
  }

  const toAfter = new Set(toRoster);
  // remove recipient's outgoing first
  receiveIds.forEach((id) => toAfter.delete(id));
  // add incoming
  giveIds.forEach((id) => toAfter.add(id));
  // apply drops to make room
  dropIds.forEach((id) => toAfter.delete(id));

  const { total: toTotal, f: toF, m: toM } = computeRosterCounts(toAfter, genderById);
  if (toTotal > rules.rosterSize) {
    return { error: `After this trade your roster would have ${toTotal} wrestlers. Maximum is ${rules.rosterSize}.` };
  }
  if (toTotal < minTotal || toF < rules.minFemale || toM < rules.minMale) {
    return {
      error: `After this trade your roster would not meet the minimum (${minTotal} wrestlers, ${rules.minFemale} women, ${rules.minMale} men). You would have ${toTotal} (${toF} women, ${toM} men).`,
    };
  }

  const { error: updateErr } = await supabase
    .from("league_trade_proposals")
    .update({
      status: "awaiting_gm_approval",
      responded_at: now,
      to_responded_at: now,
      accepted_at: now,
      to_user_drop_ids: dropIds.length ? dropIds : null,
    })
    .eq("id", proposalId);
  if (updateErr) return { error: updateErr.message };
  return {};
}

/** Execute the trade (move wrestlers). Called when GM approves. */
async function executeTrade(proposalId: string): Promise<{ error?: string }> {
  const admin = getAdminClient();
  if (!admin) return { error: "Service role required to execute trade." };

  const { data: proposal } = await admin
    .from("league_trade_proposals")
    .select("league_id, from_user_id, to_user_id, status, executed_at, to_user_drop_ids")
    .eq("id", proposalId)
    .single();
  if (!proposal) return { error: "Proposal not found." };
  if ((proposal as { executed_at?: string | null }).executed_at) return {};
  const status = (proposal as { status?: string | null }).status ?? "";
  if (!["awaiting_gm_approval", "gm_approved"].includes(status)) {
    return { error: `Trade is not executable in status '${status}'.` };
  }

  const preflight = await assertTradeExecutable(admin, proposalId);
  if (preflight.error) return preflight;

  const { data: items } = await admin
    .from("league_trade_proposal_items")
    .select("wrestler_id, direction")
    .eq("proposal_id", proposalId);
  const today = new Date().toISOString().slice(0, 10);
  const nowTs = new Date().toISOString();

  // Apply recipient-selected drops first (if any).
  const dropIds = ((proposal as { to_user_drop_ids?: string[] | null }).to_user_drop_ids ?? []).map((x) => String(x).trim()).filter(Boolean);

  // Determine which wrestlers leave each roster as a result of this execution, for conflict cancellation.
  const leavingFromUser = uniqTrim((items ?? []).filter((i) => (i as { direction: string }).direction === "give").map((i) => (i as { wrestler_id: string }).wrestler_id));
  const leavingToUserFromTrade = uniqTrim((items ?? []).filter((i) => (i as { direction: string }).direction === "receive").map((i) => (i as { wrestler_id: string }).wrestler_id));
  const leavingToUser = uniqTrim([...leavingToUserFromTrade, ...dropIds]);

  // Cancel other pending/awaiting proposals that involve these leaving wrestlers offered by the same owner.
  await cancelConflictingTradeProposals(admin, {
    leagueId: proposal.league_id,
    approvedProposalId: proposalId,
    leavingByFromUser: leavingFromUser,
    leavingByToUser: leavingToUser,
  });

  for (const wid of dropIds) {
    const { data: dropRows, error: dropErr } = await admin
      .from("league_rosters")
      .update({ released_at: today, released_at_ts: nowTs })
      .eq("league_id", proposal.league_id)
      .eq("user_id", proposal.to_user_id)
      .eq("wrestler_id", wid)
      .is("released_at", null)
      .select("id");
    if (dropErr) {
      const isColumnError = /column.*released_at_ts does not exist/i.test(dropErr.message ?? "");
      if (isColumnError) {
        const res = await admin
          .from("league_rosters")
          .update({ released_at: today })
          .eq("league_id", proposal.league_id)
          .eq("user_id", proposal.to_user_id)
          .eq("wrestler_id", wid)
          .is("released_at", null)
          .select("id");
        if (res.error) return { error: res.error.message };
        if (!res.data?.length) {
          return {
            error:
              "Trade cannot execute: agreed roster cut was not released (wrestler no longer on recipient's active roster).",
          };
        }
      } else {
        return { error: dropErr.message };
      }
    } else if (!dropRows?.length) {
      return {
        error:
          "Trade cannot execute: agreed roster cut was not released (wrestler no longer on recipient's active roster).",
      };
    }
  }

  for (const it of items ?? []) {
    const w = it as { wrestler_id: string; direction: string };
    if (w.direction === "give") {
      const { data: row } = await admin
        .from("league_rosters")
        .select("contract")
        .eq("league_id", proposal.league_id)
        .eq("user_id", proposal.from_user_id)
        .eq("wrestler_id", w.wrestler_id)
        .is("released_at", null)
        .maybeSingle();
      if (!row) return { error: `Trade cannot be executed: proposer no longer has ${w.wrestler_id}.` };
      const { error: releaseGiveErr } = await admin
        .from("league_rosters")
        .update({ released_at: today, released_at_ts: nowTs })
        .eq("league_id", proposal.league_id)
        .eq("user_id", proposal.from_user_id)
        .eq("wrestler_id", w.wrestler_id)
        .is("released_at", null);
      if (releaseGiveErr) {
        const isColumnError = /column.*released_at_ts does not exist/i.test(releaseGiveErr.message ?? "");
        if (isColumnError) {
          const res = await admin
            .from("league_rosters")
            .update({ released_at: today })
            .eq("league_id", proposal.league_id)
            .eq("user_id", proposal.from_user_id)
            .eq("wrestler_id", w.wrestler_id)
            .is("released_at", null);
          if (res.error) return { error: res.error.message };
        } else {
          return { error: releaseGiveErr.message };
        }
      }
      const insertGivePayload: {
        league_id: string;
        user_id: string;
        wrestler_id: string;
        contract: string | null;
        acquired_at: string;
        released_at: null;
        acquired_at_ts?: string;
      } = {
        league_id: proposal.league_id,
        user_id: proposal.to_user_id,
        wrestler_id: w.wrestler_id,
        contract: (row as { contract: string | null }).contract,
        acquired_at: today,
        released_at: null,
        acquired_at_ts: timestamptzForAcquiredAtDate(today),
      };
      const { error: insertGiveErr } = await admin.from("league_rosters").insert(insertGivePayload);
      if (insertGiveErr) {
        const isColumnError = /column.*acquired_at_ts does not exist/i.test(insertGiveErr.message ?? "");
        if (isColumnError) {
          const { error: insertGiveErr2 } = await admin.from("league_rosters").insert({
            league_id: proposal.league_id,
            user_id: proposal.to_user_id,
            wrestler_id: w.wrestler_id,
            contract: (row as { contract: string | null }).contract,
            acquired_at: today,
            released_at: null,
          });
          if (insertGiveErr2) return { error: insertGiveErr2.message };
        } else {
          return { error: insertGiveErr.message };
        }
      }
    } else {
      const { data: row } = await admin
        .from("league_rosters")
        .select("contract")
        .eq("league_id", proposal.league_id)
        .eq("user_id", proposal.to_user_id)
        .eq("wrestler_id", w.wrestler_id)
        .is("released_at", null)
        .maybeSingle();
      if (!row) return { error: `Trade cannot be executed: recipient no longer has ${w.wrestler_id}.` };
      const { error: releaseReceiveErr } = await admin
        .from("league_rosters")
        .update({ released_at: today, released_at_ts: nowTs })
        .eq("league_id", proposal.league_id)
        .eq("user_id", proposal.to_user_id)
        .eq("wrestler_id", w.wrestler_id)
        .is("released_at", null);
      if (releaseReceiveErr) {
        const isColumnError = /column.*released_at_ts does not exist/i.test(releaseReceiveErr.message ?? "");
        if (isColumnError) {
          const res = await admin
            .from("league_rosters")
            .update({ released_at: today })
            .eq("league_id", proposal.league_id)
            .eq("user_id", proposal.to_user_id)
            .eq("wrestler_id", w.wrestler_id)
            .is("released_at", null);
          if (res.error) return { error: res.error.message };
        } else {
          return { error: releaseReceiveErr.message };
        }
      }
      const insertReceivePayload: {
        league_id: string;
        user_id: string;
        wrestler_id: string;
        contract: string | null;
        acquired_at: string;
        released_at: null;
        acquired_at_ts?: string;
      } = {
        league_id: proposal.league_id,
        user_id: proposal.from_user_id,
        wrestler_id: w.wrestler_id,
        contract: (row as { contract: string | null }).contract,
        acquired_at: today,
        released_at: null,
        acquired_at_ts: timestamptzForAcquiredAtDate(today),
      };
      const { error: insertReceiveErr } = await admin.from("league_rosters").insert(insertReceivePayload);
      if (insertReceiveErr) {
        const isColumnError = /column.*acquired_at_ts does not exist/i.test(insertReceiveErr.message ?? "");
        if (isColumnError) {
          const { error: insertReceiveErr2 } = await admin.from("league_rosters").insert({
            league_id: proposal.league_id,
            user_id: proposal.from_user_id,
            wrestler_id: w.wrestler_id,
            contract: (row as { contract: string | null }).contract,
            acquired_at: today,
            released_at: null,
          });
          if (insertReceiveErr2) return { error: insertReceiveErr2.message };
        } else {
          return { error: insertReceiveErr.message };
        }
      }
    }
  }

  await admin
    .from("league_trade_proposals")
    .update({ executed_at: new Date().toISOString() })
    .eq("id", proposalId);
  await recordEngagementEvent({
    eventName: "league.trade_executed",
    userId: proposal.from_user_id,
    leagueId: proposal.league_id,
    metadata: { proposalId, toUserId: proposal.to_user_id },
  });
  const fromUid = (proposal as { from_user_id: string }).from_user_id;
  const toUid = (proposal as { to_user_id: string }).to_user_id;
  void awardUserXp({
    userId: fromUid,
    delta: XP_AMOUNTS.trade_executed,
    reason: "trade_executed",
    idempotencyKey: `trade_executed:${proposalId}:${fromUid}`,
    metadata: { proposalId, leagueId: proposal.league_id },
  });
  void awardUserXp({
    userId: toUid,
    delta: XP_AMOUNTS.trade_executed,
    reason: "trade_executed",
    idempotencyKey: `trade_executed:${proposalId}:${toUid}`,
    metadata: { proposalId, leagueId: proposal.league_id },
  });
  return {};
}

/** Execute trade with service role (for cron auto-execution). */
export async function executeTradeWithServiceRole(
  proposalId: string
): Promise<{ error?: string }> {
  return await executeTrade(proposalId);
}

const TRADE_TIMER_FORTY_EIGHT_H_MS = 48 * 60 * 60 * 1000;

/**
 * Trade timer maintenance (same rules as GET /api/cron/process-trades):
 * - Expire `pending` proposals with no response for 48h.
 * - Auto-execute `awaiting_gm_approval` when GM has not acted for 48h after both owners accepted
 *   (treated as approval).
 *
 * Call from the cron route and opportunistically from league/trade pages so trades still complete
 * if scheduled cron is not configured.
 */
export async function processTradeTimerDeadlines(): Promise<{
  expired: number;
  autoExecuted: number;
  expireErrors: string[];
  execErrors: string[];
}> {
  const admin = getAdminClient();
  const empty = { expired: 0, autoExecuted: 0, expireErrors: [] as string[], execErrors: [] as string[] };
  if (!admin) return empty;

  const nowMs = Date.now();
  const cutoffIso = new Date(nowMs - TRADE_TIMER_FORTY_EIGHT_H_MS).toISOString();

  const [{ count: pendingDueCount }, { count: awaitingDueCount }] = await Promise.all([
    admin
      .from("league_trade_proposals")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
      .lt("created_at", cutoffIso),
    admin
      .from("league_trade_proposals")
      .select("*", { count: "exact", head: true })
      .eq("status", "awaiting_gm_approval")
      .lt("accepted_at", cutoffIso),
  ]);

  // Fast exit for the common case: nothing is due.
  if ((pendingDueCount ?? 0) === 0 && (awaitingDueCount ?? 0) === 0) return empty;

  const { data: pendingOld } = await admin
    .from("league_trade_proposals")
    .select("id")
    .eq("status", "pending")
    .lt("created_at", cutoffIso);

  let expired = 0;
  const expireErrors: string[] = [];
  for (const row of pendingOld ?? []) {
    const id = (row as { id: string }).id;
    const { error } = await admin
      .from("league_trade_proposals")
      .update({ status: "expired", expired_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "pending");
    if (error) expireErrors.push(`${id}: ${error.message}`);
    else expired += 1;
  }

  const { data: awaitingOld } = await admin
    .from("league_trade_proposals")
    .select("id, accepted_at, executed_at")
    .eq("status", "awaiting_gm_approval")
    .lt("accepted_at", cutoffIso);

  let autoExecuted = 0;
  const execErrors: string[] = [];
  const sortedAwaiting = [...(awaitingOld ?? [])].sort((a, b) =>
    String((a as { accepted_at?: string | null }).accepted_at ?? "").localeCompare(
      String((b as { accepted_at?: string | null }).accepted_at ?? "")
    )
  );
  for (const row of sortedAwaiting) {
    const r = row as { id: string; accepted_at: string | null; executed_at: string | null };
    if (r.executed_at) continue;

    const nowIso = new Date().toISOString();

    const preflight = await assertTradeExecutable(admin, r.id);
    if (preflight.error) {
      const { error: voidErr } = await admin
        .from("league_trade_proposals")
        .update({ status: "cancelled", cancelled_at: nowIso })
        .eq("id", r.id)
        .eq("status", "awaiting_gm_approval");
      if (voidErr) execErrors.push(`${r.id}: ${preflight.error} (also failed to void: ${voidErr.message})`);
      else execErrors.push(`${r.id}: ${preflight.error} (trade voided)`);
      continue;
    }

    const { error: claimErr } = await admin
      .from("league_trade_proposals")
      .update({ status: "gm_approved", gm_responded_at: nowIso, responded_at: nowIso })
      .eq("id", r.id)
      .eq("status", "awaiting_gm_approval");
    if (claimErr) {
      execErrors.push(`${r.id}: ${claimErr.message}`);
      continue;
    }

    const exec = await executeTradeWithServiceRole(r.id);
    if (exec.error) {
      await admin
        .from("league_trade_proposals")
        .update({ status: "awaiting_gm_approval", gm_responded_at: null })
        .eq("id", r.id)
        .eq("status", "gm_approved");
      execErrors.push(`${r.id}: ${exec.error}`);
      continue;
    }
    autoExecuted += 1;
  }

  return { expired, autoExecuted, expireErrors, execErrors };
}

/** Commissioner approves or rejects a trade that was accepted by the other owner. */
export async function respondToTradeByGm(
  proposalId: string,
  approve: boolean
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: proposal } = await supabase
    .from("league_trade_proposals")
    .select("league_id, from_user_id, to_user_id, status, executed_at")
    .eq("id", proposalId)
    .single();
  if (!proposal || proposal.status !== "awaiting_gm_approval")
    return { error: "Proposal not found or not awaiting GM approval." };
  if ((proposal as { executed_at?: string | null }).executed_at) {
    return { error: "Trade already executed." };
  }

  const { data: league } = await supabase
    .from("leagues")
    .select("commissioner_id")
    .eq("id", proposal.league_id)
    .single();
  if (league?.commissioner_id !== user.id) return { error: "Only the GM can approve or reject trades." };

  const now = new Date().toISOString();

  if (approve) {
    const admin = getAdminClient();
    if (!admin) return { error: "Server configuration error (cannot validate trade)." };
    const preflight = await assertTradeExecutable(admin, proposalId);
    if (preflight.error) return preflight;
  }

  const status = approve ? "gm_approved" : "gm_rejected";
  const { error: updateErr } = await supabase
    .from("league_trade_proposals")
    .update({ status, responded_at: now, gm_responded_at: now })
    .eq("id", proposalId);
  if (updateErr) return { error: updateErr.message };

  if (approve) {
    const exec = await executeTrade(proposalId);
    if (exec.error) {
      await supabase
        .from("league_trade_proposals")
        .update({ status: "awaiting_gm_approval", gm_responded_at: null })
        .eq("id", proposalId);
      return exec;
    }
  }
  return {};
}

// --- Trade votes (advisory) ---

export async function upsertTradeVote(
  proposalId: string,
  vote: -1 | 1
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: proposal } = await supabase
    .from("league_trade_proposals")
    .select("league_id, from_user_id, to_user_id, status, accepted_at")
    .eq("id", proposalId)
    .single();
  if (!proposal) return { error: "Trade not found." };

  if (proposal.status !== "awaiting_gm_approval") return { error: "Voting is only available after both owners accept." };
  if (proposal.from_user_id === user.id || proposal.to_user_id === user.id) return { error: "Trade parties cannot vote on their own trade." };

  const acceptedAt = (proposal as { accepted_at?: string | null }).accepted_at;
  if (!acceptedAt) return { error: "Trade is missing accepted timestamp." };
  const acceptedMs = Date.parse(acceptedAt);
  const nowMs = Date.now();
  const windowMs = 48 * 60 * 60 * 1000;
  if (!Number.isFinite(acceptedMs) || nowMs - acceptedMs > windowMs) return { error: "Voting window has ended." };

  // Ensure user is a league member.
  const { data: member } = await supabase
    .from("league_members")
    .select("user_id")
    .eq("league_id", proposal.league_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return { error: "You are not in this league." };

  const now = new Date().toISOString();
  const res = await supabase
    .from("league_trade_votes")
    .upsert({
      proposal_id: proposalId,
      league_id: proposal.league_id,
      user_id: user.id,
      vote,
      updated_at: now,
    }, { onConflict: "proposal_id,user_id" });
  if (res.error) {
    const e = res.error;
    const missing =
      e.code === "42P01" || /relation.*does not exist/i.test(e.message ?? "") || /schema cache/i.test(e.message ?? "");
    if (missing) return { error: "Trade voting is not enabled yet (missing table). Please try again after the next deploy." };
    return { error: e.message };
  }
  return {};
}

export async function getTradeVoteTotals(
  proposalIds: string[]
): Promise<Record<string, { up: number; down: number }>> {
  const supabase = await createClient();
  const ids = uniqTrim(proposalIds);
  if (ids.length === 0) return {};
  const res = await supabase
    .from("league_trade_votes")
    .select("proposal_id, vote")
    .in("proposal_id", ids);
  const out: Record<string, { up: number; down: number }> = {};
  for (const id of ids) out[id] = { up: 0, down: 0 };

  if (res.error) {
    const e = res.error;
    const missing =
      e.code === "42P01" || /relation.*does not exist/i.test(e.message ?? "") || /schema cache/i.test(e.message ?? "");
    if (missing) return out;
    return out;
  }
  const data = res.data;
  for (const row of data ?? []) {
    const r = row as { proposal_id: string; vote: number };
    if (!out[r.proposal_id]) out[r.proposal_id] = { up: 0, down: 0 };
    if (r.vote === 1) out[r.proposal_id].up += 1;
    if (r.vote === -1) out[r.proposal_id].down += 1;
  }
  return out;
}

export async function getMyTradeVotes(
  proposalIds: string[]
): Promise<Record<string, -1 | 1 | 0>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};
  const ids = uniqTrim(proposalIds);
  if (ids.length === 0) return {};
  const res = await supabase
    .from("league_trade_votes")
    .select("proposal_id, vote")
    .eq("user_id", user.id)
    .in("proposal_id", ids);
  const out: Record<string, -1 | 1 | 0> = {};
  for (const id of ids) out[id] = 0;
  if (res.error) return out;
  const data = res.data;
  for (const row of data ?? []) {
    const r = row as { proposal_id: string; vote: number };
    out[r.proposal_id] = (r.vote === -1 ? -1 : 1);
  }
  return out;
}

// --- Release proposals ---

export type ReleaseProposal = {
  id: string;
  league_id: string;
  user_id: string;
  wrestler_id: string;
  status: string;
  created_at: string;
};

export async function getReleaseProposalsForLeague(
  leagueId: string
): Promise<ReleaseProposal[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("league_release_proposals")
    .select("id, league_id, user_id, wrestler_id, status, created_at, responded_at")
    .eq("league_id", leagueId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as ReleaseProposal[];
}

export async function createReleaseProposal(
  leagueId: string,
  userId: string,
  wrestlerId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== userId) return { error: "Not authenticated." };
  const { error } = await supabase.from("league_release_proposals").insert({
    league_id: leagueId,
    user_id: userId,
    wrestler_id: wrestlerId,
    status: "pending",
  });
  return error ? { error: error.message } : {};
}

export async function respondToReleaseProposal(
  proposalId: string,
  approve: boolean
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: proposal } = await supabase
    .from("league_release_proposals")
    .select("league_id, user_id, wrestler_id, status")
    .eq("id", proposalId)
    .single();
  if (!proposal || proposal.status !== "pending")
    return { error: "Proposal not found or already responded." };

  const { data: league } = await supabase
    .from("leagues")
    .select("commissioner_id")
    .eq("id", proposal.league_id)
    .single();
  if (league?.commissioner_id !== user.id) return { error: "Only the GM can respond." };

  const status = approve ? "approved" : "rejected";
  const { error: updateErr } = await supabase
    .from("league_release_proposals")
    .update({ status, responded_at: new Date().toISOString() })
    .eq("id", proposalId);
  if (updateErr) return { error: updateErr.message };
  if (approve) {
    const res = await removeWrestlerFromRoster(proposal.league_id, proposal.user_id, proposal.wrestler_id);
    if (res.error) return res;
    await insertLeagueActivityRow(supabase, {
      league_id: proposal.league_id,
      activity_type: "drop",
      user_id: proposal.user_id,
      wrestler_id: proposal.wrestler_id,
      secondary_wrestler_id: null,
    });
  }
  return {};
}

// --- Free agent proposals ---

export type FreeAgentProposal = {
  id: string;
  league_id: string;
  user_id: string;
  wrestler_id: string;
  drop_wrestler_id: string | null;
  status: string;
  created_at: string;
};

export async function getFreeAgentProposalsForLeague(
  leagueId: string
): Promise<FreeAgentProposal[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("league_free_agent_proposals")
    .select("id, league_id, user_id, wrestler_id, drop_wrestler_id, status, created_at, responded_at")
    .eq("league_id", leagueId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as FreeAgentProposal[];
}

export async function createFreeAgentProposal(
  leagueId: string,
  userId: string,
  wrestlerId: string,
  dropWrestlerId?: string | null
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== userId) return { error: "Not authenticated." };

  const { data: leagueMeta } = await supabase
    .from("leagues")
    .select("season_slug, league_type")
    .eq("id", leagueId)
    .maybeSingle();
  const cap = await assertFaSigningAllowedForLeague(
    supabase,
    leagueId,
    userId,
    (leagueMeta as { season_slug?: string | null } | null)?.season_slug,
    (leagueMeta as { league_type?: string | null } | null)?.league_type,
    { addWrestlerId: wrestlerId, dropWrestlerId: dropWrestlerId ?? null }
  );
  if (cap.error) return cap;

  const { error } = await supabase.from("league_free_agent_proposals").insert({
    league_id: leagueId,
    user_id: userId,
    wrestler_id: wrestlerId,
    drop_wrestler_id: dropWrestlerId ?? null,
    status: "pending",
  });
  return error ? { error: error.message } : {};
}

export async function respondToFreeAgentProposal(
  proposalId: string,
  approve: boolean
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: proposal } = await supabase
    .from("league_free_agent_proposals")
    .select("league_id, user_id, wrestler_id, drop_wrestler_id, status")
    .eq("id", proposalId)
    .single();
  if (!proposal || proposal.status !== "pending")
    return { error: "Proposal not found or already responded." };

  const { data: league } = await supabase
    .from("leagues")
    .select("commissioner_id")
    .eq("id", proposal.league_id)
    .single();
  if (league?.commissioner_id !== user.id) return { error: "Only the GM can respond." };

  const status = approve ? "approved" : "rejected";
  const { error: updateErr } = await supabase
    .from("league_free_agent_proposals")
    .update({ status, responded_at: new Date().toISOString() })
    .eq("id", proposalId);
  if (updateErr) return { error: updateErr.message };
  if (approve) {
    const { data: leagueMetaApprove } = await supabase
      .from("leagues")
      .select("season_slug, league_type")
      .eq("id", proposal.league_id)
      .maybeSingle();
    const capApprove = await assertFaSigningAllowedForLeague(
      supabase,
      proposal.league_id,
      proposal.user_id,
      (leagueMetaApprove as { season_slug?: string | null } | null)?.season_slug,
      (leagueMetaApprove as { league_type?: string | null } | null)?.league_type,
      {
        addWrestlerId: proposal.wrestler_id,
        dropWrestlerId: proposal.drop_wrestler_id ?? null,
      }
    );
    if (capApprove.error) return capApprove;

    if (proposal.drop_wrestler_id) {
      const dropRes = await removeWrestlerFromRoster(proposal.league_id, proposal.user_id, proposal.drop_wrestler_id);
      if (dropRes.error) return dropRes;
    }
    const addRes = await addWrestlerToRoster(proposal.league_id, proposal.user_id, proposal.wrestler_id, null, true);
    if (addRes.error) return addRes;
    await insertLeagueActivityRow(supabase, {
      league_id: proposal.league_id,
      activity_type: "fa_add",
      user_id: proposal.user_id,
      wrestler_id: proposal.wrestler_id,
      secondary_wrestler_id: proposal.drop_wrestler_id ?? null,
    });
  }
  return {};
}

// --- Owner self-service: drop and add FA without commissioner approval (first come, first serve) ---

/** Owner drops a wrestler from their own roster immediately. Fails if drop would break roster minimums. */
export async function dropWrestlerImmediate(
  leagueId: string,
  wrestlerId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };
  const { data: member } = await supabase
    .from("league_members")
    .select("user_id")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return { error: "You are not in this league." };
  const eventLock = await getInEventLockMessage(supabase);
  if (eventLock) return { error: eventLock };

  const wid = wrestlerId.trim();
  const tradeLock = await assertWrestlerNotTradeLocked(leagueId, user.id, wid);
  if (tradeLock.error) return tradeLock;

  const { data: leagueDropMeta } = await supabase
    .from("leagues")
    .select("league_type, season_slug")
    .eq("id", leagueId)
    .maybeSingle();
  const dropLeagueType = (leagueDropMeta as { league_type?: string | null } | null)?.league_type ?? null;
  const dropSeasonSlug = (leagueDropMeta as { season_slug?: string | null } | null)?.season_slug;

  const rules = await getRosterRulesForLeagueId(supabase, leagueId);
  if (rules) {
    const { data: rosterRows } = await supabase
      .from("league_rosters")
      .select("wrestler_id")
      .eq("league_id", leagueId)
      .eq("user_id", user.id)
      .is("released_at", null);
    const currentIds = (rosterRows ?? []).map((r: { wrestler_id: string }) => r.wrestler_id);
    if (!currentIds.includes(wid)) return { error: "Wrestler not on your roster." };
    const { data: wrestlerRows } = await supabase
      .from("wrestlers")
      .select("id, gender")
      .in("id", currentIds);
    const genderById: Record<string, "F" | "M" | null> = {};
    for (const w of wrestlerRows ?? []) {
      genderById[(w as { id: string }).id] = normalizeGender((w as { gender: string | null }).gender);
    }
    let total = currentIds.length;
    let female = 0;
    let male = 0;
    for (const id of currentIds) {
      const g = genderById[id];
      if (g === "F") female++;
      else if (g === "M") male++;
    }
    const dropGender = genderById[wid];
    const afterTotal = total - 1;
    const afterFemale = female - (dropGender === "F" ? 1 : 0);
    const afterMale = male - (dropGender === "M" ? 1 : 0);
    const minTotal = rules.minFemale + rules.minMale;
    if (
      !leagueUsesSalaryCap(dropLeagueType) &&
      (afterTotal < minTotal || afterFemale < rules.minFemale || afterMale < rules.minMale)
    ) {
      return {
        error: `Dropping this wrestler would leave your roster below the minimum (${minTotal} wrestlers, ${rules.minFemale} women, ${rules.minMale} men). Add a free agent at the same time to stay in compliance.`,
      };
    }
  }

  const capDrop = await assertFaSigningAllowedForLeague(
    supabase,
    leagueId,
    user.id,
    dropSeasonSlug,
    dropLeagueType,
    { dropWrestlerId: wid }
  );
  if (capDrop.error) return capDrop;

  const res = await removeWrestlerFromRoster(leagueId, user.id, wid, undefined, true);
  if (res.error) return res;
  await insertLeagueActivityRow(supabase, {
    league_id: leagueId,
    activity_type: "drop",
    user_id: user.id,
    wrestler_id: wid,
    secondary_wrestler_id: null,
  });
  return {};
}

/** Owner adds a free agent to their own roster immediately. Optionally drops one to make room. No proposal. */
export async function addFreeAgentImmediate(
  leagueId: string,
  wrestlerId: string,
  dropWrestlerId?: string | null
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };
  const { data: member } = await supabase
    .from("league_members")
    .select("user_id")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return { error: "You are not in this league." };
  const eventLock = await getInEventLockMessage(supabase);
  if (eventLock) return { error: eventLock };

  const { data: leagueMetaFa } = await supabase
    .from("leagues")
    .select("season_slug, league_type")
    .eq("id", leagueId)
    .maybeSingle();
  const faLeagueType = (leagueMetaFa as { league_type?: string | null } | null)?.league_type ?? null;
  const isSalaryCapFa = leagueUsesSalaryCap(faLeagueType);

  const capFa = await assertFaSigningAllowedForLeague(
    supabase,
    leagueId,
    user.id,
    (leagueMetaFa as { season_slug?: string | null } | null)?.season_slug,
    faLeagueType,
    { addWrestlerId: wrestlerId, dropWrestlerId: dropWrestlerId ?? null }
  );
  if (capFa.error) return capFa;

  const widToAdd = wrestlerId.trim();
  const widToDrop = dropWrestlerId?.trim() || null;

  if (widToDrop) {
    const tradeLock = await assertWrestlerNotTradeLocked(leagueId, user.id, widToDrop);
    if (tradeLock.error) return tradeLock;
  }

  // Pre-validate combined operation so we don't drop first and then fail the add.
  // (removeWrestlerFromRoster does not enforce roster minimums; addWrestlerToRoster does.)
  const admin = getAdminClient();
  if (widToAdd && widToDrop && !admin) {
    return { error: "Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is not set." };
  }

  const { data: rosterRows } = await supabase
    .from("league_rosters")
    .select("wrestler_id")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .is("released_at", null);

  const currentIds = (rosterRows ?? []).map((r: { wrestler_id: string }) => r.wrestler_id);
  if (currentIds.includes(widToAdd)) return { error: "That wrestler is already on your roster." };

  const rules = await getRosterRulesForLeagueId(supabase, leagueId);
  if (!rules) return { error: "League roster rules could not be loaded." };

  if (isSalaryCapFa) {
    const maxRoster = rules?.rosterSize ?? SALARY_CAP_MAX_ROSTER_SIZE;
    if (!widToDrop && currentIds.length >= maxRoster) {
      return { error: `Roster full (max ${maxRoster} wrestlers). Drop someone first.` };
    }
    if (widToDrop && !currentIds.includes(widToDrop)) {
      return { error: "Selected drop must be on your roster." };
    }
    if (widToDrop) {
      const dropRes = await removeWrestlerFromRoster(leagueId, user.id, widToDrop, undefined, true);
      if (dropRes.error) return dropRes;
    }
    const addRes = await addWrestlerToRoster(leagueId, user.id, widToAdd, null, true);
    if (addRes.error) {
      if (widToDrop && admin) {
        await addWrestlerToRoster(leagueId, user.id, widToDrop, null, true);
      }
      return addRes;
    }
    await insertLeagueActivityRow(supabase, {
      league_id: leagueId,
      activity_type: "fa_add",
      user_id: user.id,
      wrestler_id: widToAdd,
      secondary_wrestler_id: widToDrop,
    });
    return {};
  }

  const dropGenderRequired = widToDrop ? widToDrop : null;
  const allIds = [...new Set([...(currentIds ?? []), widToAdd, ...(dropGenderRequired ? [dropGenderRequired] : [])])];
  const { data: wrestlerRows } = await supabase
    .from("wrestlers")
    .select("id, gender")
    .in("id", allIds);

  const genderById: Record<string, "F" | "M" | null> = {};
  for (const w of wrestlerRows ?? []) {
    const row = w as { id: string; gender: string | null };
    genderById[row.id] = normalizeGender(row.gender);
  }

  let female = 0;
  let male = 0;
  for (const id of currentIds) {
    const g = genderById[id];
    if (g === "F") female++;
    else if (g === "M") male++;
  }

  if (widToDrop) {
    if (!currentIds.includes(widToDrop)) return { error: "Selected drop must be on your roster." };
    const dropGender = genderById[widToDrop];
    if (dropGender === "F") female -= 1;
    else if (dropGender === "M") male -= 1;
  }

  const addGender = genderById[widToAdd];
  if (addGender === "F") female += 1;
  else if (addGender === "M") male += 1;

  const afterTotal = currentIds.length + (widToDrop ? 0 : 1);
  if (afterTotal > rules.rosterSize) {
    return { error: `Roster full (max ${rules.rosterSize} wrestlers).` };
  }

  const minTotal = rules.minFemale + rules.minMale;
  if (afterTotal < minTotal || female < rules.minFemale || male < rules.minMale) {
    return {
      error: `Swap would break roster minimums (${rules.minFemale} women, ${rules.minMale} men). No changes were made.`,
    };
  }

  // Apply changes: drop (if any), then add. If add fails, rollback the drop.
  const today = new Date().toISOString().slice(0, 10);
  let droppedRow: { wrestler_id: string; contract: string | null; acquired_at: string } | null = null;

  if (widToDrop) {
    const dropFetch = await admin!
      .from("league_rosters")
      .select("wrestler_id, contract, acquired_at")
      .eq("league_id", leagueId)
      .eq("user_id", user.id)
      .eq("wrestler_id", widToDrop)
      .is("released_at", null)
      .maybeSingle();

    const dropData = dropFetch.data as { wrestler_id: string; contract: string | null; acquired_at: string } | null;
    if (!dropData) return { error: "Selected drop must be on your roster." };
    droppedRow = {
      wrestler_id: dropData.wrestler_id,
      contract: dropData.contract ?? null,
      acquired_at: dropData.acquired_at ? String(dropData.acquired_at).slice(0, 10) : today,
    };

    const releasedAtTs = timestamptzForReleasedAtDate(today, new Date());
    const { error: dropUpdateErr } = await admin!
      .from("league_rosters")
      .update({ released_at: today, released_at_ts: releasedAtTs })
      .eq("league_id", leagueId)
      .eq("user_id", user.id)
      .eq("wrestler_id", widToDrop)
      .is("released_at", null);
    if (dropUpdateErr) {
      const isColumnError = /column.*released_at_ts does not exist/i.test(dropUpdateErr.message ?? "");
      if (!isColumnError) return { error: dropUpdateErr.message };
      const { error: drop2 } = await admin!
        .from("league_rosters")
        .update({ released_at: today })
        .eq("league_id", leagueId)
        .eq("user_id", user.id)
        .eq("wrestler_id", widToDrop)
        .is("released_at", null);
      if (drop2) return { error: drop2.message };
    }
  }

  const addRes = await addWrestlerToRoster(leagueId, user.id, widToAdd, null, true);
  if (addRes.error) {
    // Roll back drop so we never end up half-applied.
    if (widToDrop && droppedRow) {
      await admin!
        .from("league_rosters")
        .insert({
          league_id: leagueId,
          user_id: user.id,
          wrestler_id: droppedRow.wrestler_id,
          contract: droppedRow.contract,
          acquired_at: droppedRow.acquired_at,
          released_at: null,
        });
    }
    return addRes;
  }

  if (widToDrop) {
    await insertLeagueActivityRow(supabase, {
      league_id: leagueId,
      activity_type: "drop",
      user_id: user.id,
      wrestler_id: widToDrop,
      secondary_wrestler_id: null,
    });
  }
  await insertLeagueActivityRow(supabase, {
    league_id: leagueId,
    activity_type: "fa_add",
    user_id: user.id,
    wrestler_id: widToAdd,
    secondary_wrestler_id: widToDrop,
  });

  return {};
}

export type LeagueRosterActivityItem = {
  id: string;
  league_id: string;
  activity_type: "drop" | "fa_add";
  user_id: string;
  wrestler_id: string;
  secondary_wrestler_id: string | null;
  created_at: string;
};

/**
 * Recent drops and FA signings from league_activity, plus approved release/FA proposals
 * that were never written to league_activity, plus roster rows with released_at (backfill
 * for drops that never got an activity row). Dedupes by user/wrestler/day where possible.
 * Note: roster-derived drops can include wrestlers removed via trades, not only releases.
 */
export async function getLeagueRosterActivity(
  leagueId: string,
  limit = 50
): Promise<LeagueRosterActivityItem[]> {
  const supabase = await createClient();
  const [activityRes, releaseRes, faRes, rosterReleasesRes] = await Promise.all([
    supabase
      .from("league_activity")
      .select("id, league_id, activity_type, user_id, wrestler_id, secondary_wrestler_id, created_at")
      .eq("league_id", leagueId)
      .order("created_at", { ascending: false })
      .limit(limit * 2),
    supabase
      .from("league_release_proposals")
      .select("id, user_id, wrestler_id, responded_at, created_at")
      .eq("league_id", leagueId)
      .eq("status", "approved")
      .order("responded_at", { ascending: false, nullsFirst: false })
      .limit(limit),
    supabase
      .from("league_free_agent_proposals")
      .select("id, user_id, wrestler_id, drop_wrestler_id, responded_at, created_at")
      .eq("league_id", leagueId)
      .eq("status", "approved")
      .order("responded_at", { ascending: false, nullsFirst: false })
      .limit(limit),
    supabase
      .from("league_rosters")
      .select("id, user_id, wrestler_id, released_at")
      .eq("league_id", leagueId)
      .not("released_at", "is", null)
      .order("released_at", { ascending: false })
      .limit(Math.max(limit * 6, 120)),
  ]);

  const activityRows = (activityRes.data ?? []) as LeagueRosterActivityItem[];
  const seen = new Set(
    activityRows.map((a) => `${a.activity_type}-${a.user_id}-${a.wrestler_id}-${(a.created_at || "").slice(0, 10)}`)
  );

  const fromReleases = ((releaseRes.data ?? []) as { id: string; user_id: string; wrestler_id: string; responded_at: string | null; created_at: string }[])
    .map((r) => {
      const created_at = r.responded_at || r.created_at;
      const key = `drop-${r.user_id}-${r.wrestler_id}-${(created_at || "").slice(0, 10)}`;
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        id: `release-${r.id}`,
        league_id: leagueId,
        activity_type: "drop" as const,
        user_id: r.user_id,
        wrestler_id: r.wrestler_id,
        secondary_wrestler_id: null as string | null,
        created_at: created_at || r.created_at,
      };
    })
    .filter(Boolean) as LeagueRosterActivityItem[];

  const fromFa = ((faRes.data ?? []) as { id: string; user_id: string; wrestler_id: string; drop_wrestler_id: string | null; responded_at: string | null; created_at: string }[])
    .map((f) => {
      const created_at = f.responded_at || f.created_at;
      const key = `fa_add-${f.user_id}-${f.wrestler_id}-${(created_at || "").slice(0, 10)}`;
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        id: `fa-${f.id}`,
        league_id: leagueId,
        activity_type: "fa_add" as const,
        user_id: f.user_id,
        wrestler_id: f.wrestler_id,
        secondary_wrestler_id: f.drop_wrestler_id ?? null,
        created_at: created_at || f.created_at,
      };
    })
    .filter(Boolean) as LeagueRosterActivityItem[];

  const fromRosterReleases = ((rosterReleasesRes.data ?? []) as {
    id: string;
    user_id: string;
    wrestler_id: string;
    released_at: string;
  }[])
    .map((row) => {
      const d = (row.released_at || "").slice(0, 10);
      const key = `drop-${row.user_id}-${row.wrestler_id}-${d}`;
      if (seen.has(key)) return null;
      seen.add(key);
      const created_at = d.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T12:00:00.000Z` : row.released_at;
      return {
        id: `roster-drop-${row.id}`,
        league_id: leagueId,
        activity_type: "drop" as const,
        user_id: row.user_id,
        wrestler_id: row.wrestler_id,
        secondary_wrestler_id: null as string | null,
        created_at,
      };
    })
    .filter(Boolean) as LeagueRosterActivityItem[];

  const merged = [...activityRows, ...fromReleases, ...fromFa, ...fromRosterReleases].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return merged.slice(0, limit);
}
