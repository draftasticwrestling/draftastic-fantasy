"use server";

import { revalidatePath } from "next/cache";
import {
  setLineupForEvent,
  createTradeProposal,
  respondToTradeProposal,
  respondToTradeByGm,
  cancelTradeProposal,
  upsertTradeVote,
  dropWrestlerImmediate,
  addFreeAgentImmediate,
} from "@/lib/leagueOwner";
import type { SalaryCapWrestlerOption } from "@/app/leagues/[slug]/salary-cap/SalaryCapRosterBuilder";
import { getLeagueBySlug, getRostersForLeague } from "@/lib/leagues";
import { leagueUsesSalaryCap, SALARY_CAP_BUDGET_DEFAULT } from "@/lib/leagueStructure";
import {
  FA_SALARY_CAP_WEEKLY_BUDGET,
  getSalaryCapWeeklyFaBudgetStatus,
} from "@/lib/salaryCapWeeklyLimits";
import { getSalaryCapLeagueMeta, getSalaryCapSpentForUser } from "@/lib/salaryCap";
import { buildSalaryCapWrestlerPool } from "@/lib/salaryCapWrestlerPool";
import { getServerAuth } from "@/lib/supabase/serverAuth";

export type SalaryCapFreeAgentPoolPayload = {
  pool: SalaryCapWrestlerOption[];
  budget: number;
  spent: number;
  weeklyAddRemaining: number;
  myRosterIds: string[];
};

export async function setLineupAction(
  leagueSlug: string,
  eventId: string,
  wrestlerIds: string[]
): Promise<{ error?: string }> {
  const { getLeagueBySlug } = await import("@/lib/leagues");
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };
  const { user } = await getServerAuth();
  if (!user) return { error: "Not authenticated." };
  const result = await setLineupForEvent(league.id, user.id, eventId, wrestlerIds);
  if (result.error) return result;
  revalidatePath(`/leagues/${leagueSlug}/team`);
  revalidatePath(`/leagues/${leagueSlug}/faction`);
  revalidatePath(`/leagues/${leagueSlug}/faction-actions`);
  revalidatePath(`/leagues/${leagueSlug}`);
  return {};
}

export async function proposeTradeAction(
  leagueSlug: string,
  toUserId: string,
  giveWrestlerIds: string[],
  receiveWrestlerIds: string[]
): Promise<{ error?: string }> {
  const { getLeagueBySlug } = await import("@/lib/leagues");
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };
  const { user } = await getServerAuth();
  if (!user) return { error: "Not authenticated." };
  const result = await createTradeProposal(league.id, user.id, toUserId, giveWrestlerIds, receiveWrestlerIds);
  if (result.error) return result;
  revalidatePath(`/leagues/${leagueSlug}/team`);
  return {};
}

/** Owner drops a wrestler from their roster immediately (first come, first serve; no commissioner approval). */
export async function dropWrestlerAction(
  leagueSlug: string,
  wrestlerId: string
): Promise<{ error?: string }> {
  const { getLeagueBySlug } = await import("@/lib/leagues");
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };
  const result = await dropWrestlerImmediate(league.id, wrestlerId);
  if (result.error) return result;
  revalidatePath(`/leagues/${leagueSlug}/team`);
  revalidatePath(`/leagues/${leagueSlug}/faction`);
  revalidatePath(`/leagues/${leagueSlug}/faction-actions`);
  revalidatePath(`/leagues/${leagueSlug}`);
  revalidatePath(`/leagues/${leagueSlug}/proposals`);
  revalidatePath(`/leagues/${leagueSlug}/transactions`);
  revalidatePath(`/leagues/${leagueSlug}/wrestlers/league-leaders`);
  revalidatePath(`/leagues/${leagueSlug}/wrestlers/free-agents`);
  return {};
}

/** Lazy-load salary cap FA pool (same data as onboarding roster builder). */
export async function loadSalaryCapFreeAgentPoolAction(
  leagueSlug: string
): Promise<SalaryCapFreeAgentPoolPayload | { error: string }> {
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };
  if (!leagueUsesSalaryCap(league.league_type)) {
    return { error: "This league is not a salary cap league." };
  }

  const { supabase, user } = await getServerAuth();
  if (!user) return { error: "Not authenticated." };

  const { data: member } = await supabase
    .from("league_members")
    .select("user_id")
    .eq("league_id", league.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return { error: "You are not in this league." };

  const [pool, meta, { spent }, weekly, rosters] = await Promise.all([
    buildSalaryCapWrestlerPool(supabase, league),
    getSalaryCapLeagueMeta(supabase, league.id),
    getSalaryCapSpentForUser(supabase, league.id, user.id),
    getSalaryCapWeeklyFaBudgetStatus(supabase, league.id, user.id),
    getRostersForLeague(league.id),
  ]);

  const leagueBudget = (league as { salary_cap_budget?: number | null }).salary_cap_budget;
  const budget =
    meta?.budget ??
    (typeof leagueBudget === "number" && leagueBudget > 0 ? leagueBudget : SALARY_CAP_BUDGET_DEFAULT);

  const myRosterIds = (rosters[user.id] ?? []).map((e) => e.wrestler_id);
  const weeklyAddRemaining = weekly?.addRemaining ?? FA_SALARY_CAP_WEEKLY_BUDGET;

  return { pool, budget, spent, weeklyAddRemaining, myRosterIds };
}

/** Owner adds a free agent to their roster immediately (first come, first serve; no commissioner approval). */
export async function addFreeAgentAction(
  leagueSlug: string,
  wrestlerId: string,
  dropWrestlerId?: string | null
): Promise<{ error?: string }> {
  const { getLeagueBySlug } = await import("@/lib/leagues");
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };
  const result = await addFreeAgentImmediate(league.id, wrestlerId, dropWrestlerId);
  if (result.error) return result;
  revalidatePath(`/leagues/${leagueSlug}/team`);
  revalidatePath(`/leagues/${leagueSlug}/faction`);
  revalidatePath(`/leagues/${leagueSlug}/faction-actions`);
  revalidatePath(`/leagues/${leagueSlug}`);
  revalidatePath(`/leagues/${leagueSlug}/proposals`);
  revalidatePath(`/leagues/${leagueSlug}/transactions`);
  revalidatePath(`/leagues/${leagueSlug}/wrestlers/league-leaders`);
  revalidatePath(`/leagues/${leagueSlug}/wrestlers/free-agents`);
  return {};
}

export async function respondToTradeAction(
  leagueSlug: string,
  proposalId: string,
  accept: boolean,
  toUserDropIds?: string[]
): Promise<{ error?: string }> {
  const result = await respondToTradeProposal(proposalId, accept, toUserDropIds);
  if (result.error) return result;
  revalidatePath(`/leagues/${leagueSlug}/team`);
  revalidatePath(`/leagues/${leagueSlug}/faction`);
  revalidatePath(`/leagues/${leagueSlug}/faction-actions`);
  revalidatePath(`/leagues/${leagueSlug}`);
  revalidatePath(`/leagues/${leagueSlug}/proposals`);
  return {};
}

export async function cancelTradeAction(
  leagueSlug: string,
  proposalId: string
): Promise<{ error?: string }> {
  const result = await cancelTradeProposal(proposalId);
  if (result.error) return result;
  revalidatePath(`/leagues/${leagueSlug}/team`);
  revalidatePath(`/leagues/${leagueSlug}/faction`);
  revalidatePath(`/leagues/${leagueSlug}/faction-actions`);
  revalidatePath(`/leagues/${leagueSlug}`);
  revalidatePath(`/leagues/${leagueSlug}/proposals`);
  return {};
}

export async function voteOnTradeAction(
  leagueSlug: string,
  proposalId: string,
  vote: -1 | 1
): Promise<{ error?: string }> {
  const result = await upsertTradeVote(proposalId, vote);
  if (result.error) return result;
  revalidatePath(`/leagues/${leagueSlug}/proposals`);
  return {};
}

/** Commissioner approves or rejects a trade that was accepted by the other owner. */
export async function respondToTradeByGmAction(
  leagueSlug: string,
  proposalId: string,
  approve: boolean
): Promise<{ error?: string }> {
  const result = await respondToTradeByGm(proposalId, approve);
  if (result.error) return result;
  revalidatePath(`/leagues/${leagueSlug}/team`);
  revalidatePath(`/leagues/${leagueSlug}/faction`);
  revalidatePath(`/leagues/${leagueSlug}/faction-actions`);
  revalidatePath(`/leagues/${leagueSlug}`);
  revalidatePath(`/leagues/${leagueSlug}/proposals`);
  return {};
}

export async function updateFactionInfoAction(
  leagueSlug: string,
  teamName: string | null
): Promise<{ error?: string }> {
  const { getLeagueBySlug, updateLeagueMemberFactionInfo } = await import("@/lib/leagues");
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };
  const { user } = await getServerAuth();
  const result = await updateLeagueMemberFactionInfo(league.id, { teamName, factionEmoji: null });
  if (result.error) return result;
  revalidatePath(`/leagues/${leagueSlug}`);
  revalidatePath(`/leagues/${leagueSlug}/team`);
  revalidatePath(`/leagues/${leagueSlug}/edit-team-info`);
  revalidatePath(`/leagues/${leagueSlug}/standings`);
  if (user) revalidatePath(`/leagues/${leagueSlug}/team/${user.id}`);
  return {};
}

export async function updateLeagueManagerAvatarAction(
  leagueSlug: string,
  managerAvatarUrl: string | null
): Promise<{ error?: string }> {
  const { getLeagueBySlug, updateLeagueMemberManagerAvatar } = await import("@/lib/leagues");
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };
  const result = await updateLeagueMemberManagerAvatar(league.id, managerAvatarUrl);
  if (result.error) return result;
  revalidatePath(`/leagues/${leagueSlug}`);
  revalidatePath(`/leagues/${leagueSlug}/edit-team-info`);
  revalidatePath(`/leagues/${leagueSlug}/standings`);
  revalidatePath(`/leagues/${leagueSlug}/team`);
  const { user } = await getServerAuth();
  if (user) revalidatePath(`/leagues/${leagueSlug}/team/${user.id}`);
  return {};
}

export async function updateLeagueCatchphraseAction(
  leagueSlug: string,
  catchphrase: string | null
): Promise<{ error?: string }> {
  const { getLeagueBySlug, updateLeagueMemberCatchphrase } = await import("@/lib/leagues");
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };
  const result = await updateLeagueMemberCatchphrase(league.id, catchphrase);
  if (result.error) return result;
  revalidatePath(`/leagues/${leagueSlug}`);
  revalidatePath(`/leagues/${leagueSlug}/edit-team-info`);
  revalidatePath(`/leagues/${leagueSlug}/standings`);
  revalidatePath(`/leagues/${leagueSlug}/team`);
  const { user } = await getServerAuth();
  if (user) revalidatePath(`/leagues/${leagueSlug}/team/${user.id}`);
  return {};
}
