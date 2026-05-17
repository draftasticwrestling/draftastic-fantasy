"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLeagueBySlug } from "@/lib/leagues";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  hasSavedDraftPreferences,
  leagueDestinationAfterOnboarding,
  leagueUsesMemberOnboarding,
  resolveMemberOnboardingState,
} from "@/lib/leagueOnboarding";
import { leagueUsesSalaryCap } from "@/lib/leagueStructure";

export async function completeLeagueOnboardingAction(
  leagueSlug: string
): Promise<{ error?: string; redirectTo?: string }> {
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { error: "League not found." };

  const { supabase, user } = await getServerAuth();
  if (!user) return { error: "Not authenticated." };

  const { data: member } = await supabase
    .from("league_members")
    .select("team_name, role")
    .eq("league_id", league.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return { error: "You are not a member of this league." };

  if (!member.team_name?.trim()) {
    return { error: "Choose a faction name before continuing." };
  }

  if (!leagueUsesSalaryCap(league.league_type)) {
    const hasPrefs = await hasSavedDraftPreferences(league.id, user.id);
    if (!hasPrefs) {
      return {
        error: "Save your auto-draft preferences before finishing setup.",
      };
    }
  }

  const admin = getAdminClient();
  const db = admin ?? supabase;
  const { error } = await db
    .from("league_members")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("league_id", league.id)
    .eq("user_id", user.id);

  if (error) {
    if (error.message.includes("onboarding_completed_at")) {
      return { error: "Onboarding tracking is not available yet. Run league_members_onboarding.sql in Supabase." };
    }
    return { error: error.message };
  }

  revalidatePath(`/leagues/${leagueSlug}`);
  revalidatePath(`/leagues/${leagueSlug}/onboarding`);
  revalidatePath(`/leagues/${leagueSlug}/salary-cap`);

  const isCommissioner = league.commissioner_id === user.id;
  const redirectTo = leagueDestinationAfterOnboarding(
    { slug: league.slug, league_type: league.league_type, commissioner_id: league.commissioner_id },
    user.id,
    { showInviteModal: isCommissioner }
  );

  return { redirectTo };
}

export async function finishLeagueOnboardingAndRedirect(leagueSlug: string): Promise<void> {
  const result = await completeLeagueOnboardingAction(leagueSlug);
  if (result.error) {
    redirect(`/leagues/${leagueSlug}/onboarding?error=${encodeURIComponent(result.error)}`);
  }
  redirect(result.redirectTo ?? `/leagues/${leagueSlug}`);
}

/** Used by draft preferences page when ?from=onboarding */
export async function completeOnboardingFromDraftPrefsAction(leagueSlug: string): Promise<void> {
  await finishLeagueOnboardingAndRedirect(leagueSlug);
}

export async function checkOnboardingDraftPrefsAction(
  leagueSlug: string
): Promise<{ ok: boolean; error?: string }> {
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) return { ok: false, error: "League not found." };
  const { user } = await getServerAuth();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (leagueUsesSalaryCap(league.league_type)) return { ok: true };
  const hasPrefs = await hasSavedDraftPreferences(league.id, user.id);
  if (!hasPrefs) {
    return { ok: false, error: "Save your preferences on the preferences page first." };
  }
  return { ok: true };
}

export async function assertOnboardingRequired(
  leagueSlug: string
): Promise<{ league: NonNullable<Awaited<ReturnType<typeof getLeagueBySlug>>>; userId: string }> {
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) redirect("/leagues");

  const { supabase, user } = await getServerAuth();
  if (!user) redirect(`/auth/sign-in?next=${encodeURIComponent(`/leagues/${leagueSlug}/onboarding`)}`);

  if (!leagueUsesMemberOnboarding(league)) {
    redirect(`/leagues/${leagueSlug}`);
  }

  const { needsOnboarding } = await resolveMemberOnboardingState(supabase, league.id, league, user.id);
  if (!needsOnboarding) {
    redirect(
      leagueUsesSalaryCap(league.league_type)
        ? `/leagues/${leagueSlug}/salary-cap`
        : `/leagues/${leagueSlug}`
    );
  }

  return { league, userId: user.id };
}
