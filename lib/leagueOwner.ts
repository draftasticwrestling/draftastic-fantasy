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
  items: { wrestler_id: string; direction: "give" | "receive" }[];
};

export async function getTradeProposalsForLeague(
  leagueId: string
): Promise<TradeProposal[]> {
  const supabase = await createClient();
  const { data: proposals, error } = await supabase
    .from("league_trade_proposals")
    .select("id, league_id, from_user_id, to_user_id, status, created_at")
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

export async function respondToTradeProposal(
  proposalId: string,
  accept: boolean
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

  const league = await supabase
    .from("leagues")
    .select("commissioner_id")
    .eq("id", proposal.league_id)
    .single();
  const isCommissioner = league?.data?.commissioner_id === user.id;
  const isToUser = proposal.to_user_id === user.id;
  if (!isCommissioner && !isToUser) return { error: "You cannot respond to this proposal." };

  const status = accept ? "accepted" : "rejected";
  const { error: updateErr } = await supabase
    .from("league_trade_proposals")
    .update({ status, responded_at: new Date().toISOString() })
    .eq("id", proposalId);
  if (updateErr) return { error: updateErr.message };

  if (accept) {
    const { data: items } = await supabase
      .from("league_trade_proposal_items")
      .select("wrestler_id, direction")
      .eq("proposal_id", proposalId);
    const admin = getAdminClient();
    if (!admin) return { error: "Service role required to execute trade." };
    const today = new Date().toISOString().slice(0, 10);
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
        await admin
          .from("league_rosters")
          .update({ released_at: today })
          .eq("league_id", proposal.league_id)
          .eq("user_id", proposal.from_user_id)
          .eq("wrestler_id", w.wrestler_id)
          .is("released_at", null);
        if (row) {
          await admin.from("league_rosters").insert({
            league_id: proposal.league_id,
            user_id: proposal.to_user_id,
            wrestler_id: w.wrestler_id,
            contract: (row as { contract: string | null }).contract,
            acquired_at: today,
            released_at: null,
          });
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
        await admin
          .from("league_rosters")
          .update({ released_at: today })
          .eq("league_id", proposal.league_id)
          .eq("user_id", proposal.to_user_id)
          .eq("wrestler_id", w.wrestler_id)
          .is("released_at", null);
        if (row) {
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
    }
  }
  return {};
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
    .select("id, league_id, user_id, wrestler_id, status, created_at")
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
    .select("id, league_id, user_id, wrestler_id, drop_wrestler_id, status, created_at")
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
  }
  return {};
}
