"use server";

import { revalidatePath } from "next/cache";
import { respondToReleaseProposal, respondToFreeAgentProposal } from "@/lib/leagueOwner";

export async function respondToReleaseAction(
  leagueSlug: string,
  proposalId: string,
  approve: boolean
): Promise<{ error?: string }> {
  const result = await respondToReleaseProposal(proposalId, approve);
  if (result.error) return result;
  revalidatePath(`/leagues/${leagueSlug}/proposals`);
  revalidatePath(`/leagues/${leagueSlug}/team`);
  revalidatePath(`/leagues/${leagueSlug}`);
  return {};
}

export async function respondToFreeAgentAction(
  leagueSlug: string,
  proposalId: string,
  approve: boolean
): Promise<{ error?: string }> {
  const result = await respondToFreeAgentProposal(proposalId, approve);
  if (result.error) return result;
  revalidatePath(`/leagues/${leagueSlug}/proposals`);
  revalidatePath(`/leagues/${leagueSlug}/team`);
  revalidatePath(`/leagues/${leagueSlug}`);
  return {};
}
