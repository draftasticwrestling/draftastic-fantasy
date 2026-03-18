/**
 * Owner features: next event, lineups (active wrestlers per event), trade/release/free-agent proposals.
 */

import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getRosterRulesForLeague } from "@/lib/leagueStructure";
import { getActivePerEvent } from "@/lib/leagueStructure";
import { classifyEventType } from "@/lib/scoring/parsers/eventClassifier.js";
import { removeWrestlerFromRoster } from "@/lib/leagues";
import { addWrestlerToRoster } from "@/lib/leagues";

function normalizeGender(g: string | null | undefined): "F" | "M" | null {
  if (g == null || typeof g !== "string") return null;
  const lower = g.trim().toLowerCase();
  if (lower === "female" || lower === "f") return "F";
  if (lower === "male" || lower === "m") return "M";
  return null;
}

export type UpcomingEvent = { id: string; name: string; date: string; eventType: string };

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

  const { data: members } = await supabase
    .from("league_members")
    .select("user_id")
    .eq("league_id", leagueId);
  const count = (members ?? []).length;
  const activePer = getActivePerEvent(
    getRosterRulesForLeague(count)?.rosterSize ?? 0
  );
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
  const { data: proposals, error } = await supabase
    .from("league_trade_proposals")
    .select("id, league_id, from_user_id, to_user_id, status, created_at, responded_at, to_responded_at, accepted_at, gm_responded_at, executed_at, cancelled_at, expired_at, to_user_drop_ids")
    .eq("league_id", leagueId)
    .order("created_at", { ascending: false });
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

  const { count: memberCount } = await supabase
    .from("league_members")
    .select("*", { count: "exact", head: true })
    .eq("league_id", leagueId);
  const teamCount = memberCount ?? 0;
  const rules = getRosterRulesForLeague(teamCount);
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
  if (toTotal > rules.rosterSize) {
    return { error: `After this trade the other manager's roster would have ${toTotal} wrestlers. Maximum is ${rules.rosterSize}.` };
  }
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
  const { count: memberCount } = await supabase
    .from("league_members")
    .select("*", { count: "exact", head: true })
    .eq("league_id", proposal.league_id);
  const teamCount = memberCount ?? 0;
  const rules = getRosterRulesForLeague(teamCount);
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

  const { data: items } = await admin
    .from("league_trade_proposal_items")
    .select("wrestler_id, direction")
    .eq("proposal_id", proposalId);
  const today = new Date().toISOString().slice(0, 10);

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
    await admin
      .from("league_rosters")
      .update({ released_at: today })
      .eq("league_id", proposal.league_id)
      .eq("user_id", proposal.to_user_id)
      .eq("wrestler_id", wid)
      .is("released_at", null);
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
      await admin
        .from("league_rosters")
        .update({ released_at: today })
        .eq("league_id", proposal.league_id)
        .eq("user_id", proposal.from_user_id)
        .eq("wrestler_id", w.wrestler_id)
        .is("released_at", null);
      await admin.from("league_rosters").insert({
        league_id: proposal.league_id,
        user_id: proposal.to_user_id,
        wrestler_id: w.wrestler_id,
        contract: (row as { contract: string | null }).contract,
        acquired_at: today,
        released_at: null,
      });
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
      await admin
        .from("league_rosters")
        .update({ released_at: today })
        .eq("league_id", proposal.league_id)
        .eq("user_id", proposal.to_user_id)
        .eq("wrestler_id", w.wrestler_id)
        .is("released_at", null);
      await admin.from("league_rosters").insert({
        league_id: proposal.league_id,
        user_id: proposal.from_user_id,
        wrestler_id: w.wrestler_id,
        contract: (row as { contract: string | null }).contract,
        acquired_at: today,
        released_at: null,
      });
    }
  }

  await admin
    .from("league_trade_proposals")
    .update({ executed_at: new Date().toISOString() })
    .eq("id", proposalId);
  return {};
}

/** Execute trade with service role (for cron auto-execution). */
export async function executeTradeWithServiceRole(
  proposalId: string
): Promise<{ error?: string }> {
  return await executeTrade(proposalId);
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
  if (league?.commissioner_id !== user.id) return { error: "Only the commissioner can approve or reject trades." };

  const now = new Date().toISOString();
  const status = approve ? "gm_approved" : "gm_rejected";
  const { error: updateErr } = await supabase
    .from("league_trade_proposals")
    .update({ status, responded_at: now, gm_responded_at: now })
    .eq("id", proposalId);
  if (updateErr) return { error: updateErr.message };

  if (approve) {
    const exec = await executeTrade(proposalId);
    if (exec.error) return exec;
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
  const { error } = await supabase
    .from("league_trade_votes")
    .upsert({
      proposal_id: proposalId,
      league_id: proposal.league_id,
      user_id: user.id,
      vote,
      updated_at: now,
    }, { onConflict: "proposal_id,user_id" });
  return error ? { error: error.message } : {};
}

export async function getTradeVoteTotals(
  proposalIds: string[]
): Promise<Record<string, { up: number; down: number }>> {
  const supabase = await createClient();
  const ids = uniqTrim(proposalIds);
  if (ids.length === 0) return {};
  const { data } = await supabase
    .from("league_trade_votes")
    .select("proposal_id, vote")
    .in("proposal_id", ids);
  const out: Record<string, { up: number; down: number }> = {};
  for (const id of ids) out[id] = { up: 0, down: 0 };
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
  const { data } = await supabase
    .from("league_trade_votes")
    .select("proposal_id, vote")
    .eq("user_id", user.id)
    .in("proposal_id", ids);
  const out: Record<string, -1 | 1 | 0> = {};
  for (const id of ids) out[id] = 0;
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
  if (league?.commissioner_id !== user.id) return { error: "Only the commissioner can respond." };

  const status = approve ? "approved" : "rejected";
  const { error: updateErr } = await supabase
    .from("league_release_proposals")
    .update({ status, responded_at: new Date().toISOString() })
    .eq("id", proposalId);
  if (updateErr) return { error: updateErr.message };
  if (approve) {
    const res = await removeWrestlerFromRoster(proposal.league_id, proposal.user_id, proposal.wrestler_id);
    if (res.error) return res;
    const admin = getAdminClient();
    if (admin) {
      await admin.from("league_activity").insert({
        league_id: proposal.league_id,
        activity_type: "drop",
        user_id: proposal.user_id,
        wrestler_id: proposal.wrestler_id,
        secondary_wrestler_id: null,
      });
    }
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
  if (league?.commissioner_id !== user.id) return { error: "Only the commissioner can respond." };

  const status = approve ? "approved" : "rejected";
  const { error: updateErr } = await supabase
    .from("league_free_agent_proposals")
    .update({ status, responded_at: new Date().toISOString() })
    .eq("id", proposalId);
  if (updateErr) return { error: updateErr.message };
  if (approve) {
    if (proposal.drop_wrestler_id) {
      const dropRes = await removeWrestlerFromRoster(proposal.league_id, proposal.user_id, proposal.drop_wrestler_id);
      if (dropRes.error) return dropRes;
    }
    const addRes = await addWrestlerToRoster(proposal.league_id, proposal.user_id, proposal.wrestler_id, null, true);
    if (addRes.error) return addRes;
    const admin = getAdminClient();
    if (admin) {
      await admin.from("league_activity").insert({
        league_id: proposal.league_id,
        activity_type: "fa_add",
        user_id: proposal.user_id,
        wrestler_id: proposal.wrestler_id,
        secondary_wrestler_id: proposal.drop_wrestler_id ?? null,
      });
    }
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

  const wid = wrestlerId.trim();
  const { count: memberCount } = await supabase
    .from("league_members")
    .select("*", { count: "exact", head: true })
    .eq("league_id", leagueId);
  const teamCount = memberCount ?? 0;
  const rules = getRosterRulesForLeague(teamCount);
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
    if (afterTotal < minTotal || afterFemale < rules.minFemale || afterMale < rules.minMale) {
      return {
        error: `Dropping this wrestler would leave your roster below the minimum (${minTotal} wrestlers, ${rules.minFemale} women, ${rules.minMale} men). Add a free agent at the same time to stay in compliance.`,
      };
    }
  }

  const res = await removeWrestlerFromRoster(leagueId, user.id, wid, undefined, true);
  if (res.error) return res;
  const admin = getAdminClient();
  if (admin) {
    await admin.from("league_activity").insert({
      league_id: leagueId,
      activity_type: "drop",
      user_id: user.id,
      wrestler_id: wid,
      secondary_wrestler_id: null,
    });
  }
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
  if (dropWrestlerId?.trim()) {
    const dropRes = await removeWrestlerFromRoster(leagueId, user.id, dropWrestlerId.trim(), undefined, true);
    if (dropRes.error) return dropRes;
  }
  const addRes = await addWrestlerToRoster(leagueId, user.id, wrestlerId.trim(), null, true);
  if (addRes.error) return addRes;
  const admin = getAdminClient();
  if (admin) {
    await admin.from("league_activity").insert({
      league_id: leagueId,
      activity_type: "fa_add",
      user_id: user.id,
      wrestler_id: wrestlerId.trim(),
      secondary_wrestler_id: dropWrestlerId?.trim() || null,
    });
  }
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
 * that were never written to league_activity (e.g. before we added the insert).
 * Merges and dedupes so the feed shows all drops/adds including historical ones.
 */
export async function getLeagueRosterActivity(
  leagueId: string,
  limit = 50
): Promise<LeagueRosterActivityItem[]> {
  const supabase = await createClient();
  const [activityRes, releaseRes, faRes] = await Promise.all([
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

  const merged = [...activityRows, ...fromReleases, ...fromFa].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return merged.slice(0, limit);
}
