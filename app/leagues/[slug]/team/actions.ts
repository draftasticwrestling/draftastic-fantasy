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

export async function setLineupAction(
  leagueSlug: string,
  eventId: string,
  wrestlerIds: string[]
): Promise<{ error?: string }> {
  const { getLeagueBySlug } = await import("@/lib/leagues");
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };
  const supabase = await (await import("@/lib/supabase/server")).createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };
  const result = await setLineupForEvent(league.id, user.id, eventId, wrestlerIds);
  if (result.error) return result;
  revalidatePath(`/leagues/${leagueSlug}/team`);
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
  const supabase = await (await import("@/lib/supabase/server")).createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
  revalidatePath(`/leagues/${leagueSlug}`);
  revalidatePath(`/leagues/${leagueSlug}/proposals`);
  revalidatePath(`/leagues/${leagueSlug}/transactions`);
  return {};
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
  revalidatePath(`/leagues/${leagueSlug}`);
  revalidatePath(`/leagues/${leagueSlug}/proposals`);
  revalidatePath(`/leagues/${leagueSlug}/transactions`);
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
  const supabase = await (await import("@/lib/supabase/server")).createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
  const supabase = await (await import("@/lib/supabase/server")).createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
  const supabase = await (await import("@/lib/supabase/server")).createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) revalidatePath(`/leagues/${leagueSlug}/team/${user.id}`);
  return {};
}
