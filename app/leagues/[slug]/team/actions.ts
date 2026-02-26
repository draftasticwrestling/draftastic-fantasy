"use server";

import { revalidatePath } from "next/cache";
import {
  setLineupForEvent,
  createTradeProposal,
  createReleaseProposal,
  createFreeAgentProposal,
  respondToTradeProposal,
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

export async function proposeReleaseAction(
  leagueSlug: string,
  wrestlerId: string
): Promise<{ error?: string }> {
  const { getLeagueBySlug } = await import("@/lib/leagues");
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };
  const supabase = await (await import("@/lib/supabase/server")).createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };
  const result = await createReleaseProposal(league.id, user.id, wrestlerId);
  if (result.error) return result;
  revalidatePath(`/leagues/${leagueSlug}/team`);
  return {};
}

export async function proposeFreeAgentAction(
  leagueSlug: string,
  wrestlerId: string,
  dropWrestlerId?: string | null
): Promise<{ error?: string }> {
  const { getLeagueBySlug } = await import("@/lib/leagues");
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };
  const supabase = await (await import("@/lib/supabase/server")).createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };
  const result = await createFreeAgentProposal(league.id, user.id, wrestlerId, dropWrestlerId);
  if (result.error) return result;
  revalidatePath(`/leagues/${leagueSlug}/team`);
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
