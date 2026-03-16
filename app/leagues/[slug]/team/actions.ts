"use server";

import { revalidatePath } from "next/cache";
import {
  setLineupForEvent,
  createTradeProposal,
  respondToTradeProposal,
  respondToTradeByGm,
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
  return {};
}

export async function respondToTradeAction(
  leagueSlug: string,
  proposalId: string,
  accept: boolean
): Promise<{ error?: string }> {
  const result = await respondToTradeProposal(proposalId, accept);
  if (result.error) return result;
  revalidatePath(`/leagues/${leagueSlug}/team`);
  revalidatePath(`/leagues/${leagueSlug}`);
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

export async function updateTeamNameAction(
  leagueSlug: string,
  teamName: string | null
): Promise<{ error?: string }> {
  const { getLeagueBySlug, updateLeagueMemberTeamName } = await import("@/lib/leagues");
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };
  const supabase = await (await import("@/lib/supabase/server")).createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const result = await updateLeagueMemberTeamName(league.id, teamName);
  if (result.error) return result;
  revalidatePath(`/leagues/${leagueSlug}`);
  revalidatePath(`/leagues/${leagueSlug}/team`);
  revalidatePath(`/leagues/${leagueSlug}/edit-team-info`);
  if (user) revalidatePath(`/leagues/${leagueSlug}/team/${user.id}`);
  return {};
}
