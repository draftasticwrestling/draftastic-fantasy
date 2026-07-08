import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isPlacedLeagueMember } from "@/lib/leaguePlacement";
import { leagueOnboardingPath, resolveMemberOnboardingState } from "@/lib/leagueOnboarding";
import { PLAY_PATH } from "@/lib/playFunnel";
import { isPublicSalaryCapLeague } from "@/lib/publicLeagueSchedule";

export type OnboardingChecklistStep = {
  key: string;
  label: string;
  detail: string | null;
  completed: boolean;
  href: string | null;
};

export type OnboardingProgress = {
  steps: OnboardingChecklistStep[];
  completedCount: number;
  allComplete: boolean;
  primaryCtaHref: string;
  primaryCtaLabel: string;
  showEmptyCareerHero: boolean;
};

type LeagueMemberRow = {
  league_id: string;
  onboarding_completed_at?: string | null;
  placement_status?: string | null;
  leagues?: {
    slug?: string | null;
    name?: string | null;
    league_type?: string | null;
    visibility_type?: string | null;
    season_slug?: string | null;
    draft_status?: string | null;
    is_archived?: boolean | null;
  } | null;
};

async function hasViewedHowItWorks(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { count } = await supabase
    .from("engagement_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("event_name", "page.how_it_works_view")
    .limit(1);
  return (count ?? 0) > 0;
}

export async function getOnboardingProgress(
  supabase: SupabaseClient,
  userId: string,
  leagueRows: LeagueMemberRow[],
  rosterCountByLeagueId: Map<string, number>
): Promise<OnboardingProgress> {
  const activeLeagues = leagueRows.filter((row) => !row.leagues?.is_archived);
  const hasLeague = activeLeagues.length > 0;
  const readHowItWorks = await hasViewedHowItWorks(supabase, userId);

  let hasFaction = false;
  let isPlaying = false;
  let rosterHref: string | null = null;

  for (const row of activeLeagues) {
    const slug = row.leagues?.slug?.trim() ?? "";
    const leagueMeta = {
      slug,
      league_type: row.leagues?.league_type ?? null,
      season_slug: row.leagues?.season_slug ?? null,
    };
    const rosterCount = rosterCountByLeagueId.get(row.league_id) ?? 0;
    const leagueCtx = {
      visibility_type: row.leagues?.visibility_type ?? null,
      league_type: row.leagues?.league_type ?? null,
      season_slug: row.leagues?.season_slug ?? null,
    };

    if (slug) {
      const { needsOnboarding } = await resolveMemberOnboardingState(
        supabase,
        row.league_id,
        leagueMeta,
        userId
      );
      if (!needsOnboarding || rosterCount > 0) {
        hasFaction = true;
        rosterHref = isPublicSalaryCapLeague(leagueCtx)
          ? `/leagues/${encodeURIComponent(slug)}/salary-cap`
          : `/leagues/${encodeURIComponent(slug)}`;
      } else if (needsOnboarding) {
        rosterHref = leagueOnboardingPath(slug);
      }
    }

    if (
      isPlacedLeagueMember(
        {
          placement_status: row.placement_status as "pending" | "active" | null | undefined,
          onboarding_completed_at: row.onboarding_completed_at ?? null,
          active_roster_count: rosterCount,
        },
        leagueCtx
      )
    ) {
      isPlaying = true;
    }
  }

  const steps: OnboardingChecklistStep[] = [
    {
      key: "account",
      label: "Create account",
      detail: null,
      completed: true,
      href: null,
    },
    {
      key: "how_it_works",
      label: 'Read "How it Works"',
      detail: "Two-minute overview of scoring and public leagues.",
      completed: readHowItWorks,
      href: "/how-it-works",
    },
    {
      key: "join_league",
      label: "Join a league",
      detail: "It's free — public leagues open every Monday.",
      completed: hasLeague,
      href: PLAY_PATH,
    },
    {
      key: "pick_team",
      label: "Pick your team",
      detail: "Name your faction and build your roster.",
      completed: hasFaction,
      href: rosterHref ?? PLAY_PATH,
    },
    {
      key: "start_playing",
      label: "Start playing",
      detail: "Earn points when WWE events are scored.",
      completed: isPlaying,
      href: rosterHref ?? PLAY_PATH,
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const allComplete = completedCount === steps.length;

  let primaryCtaHref = PLAY_PATH;
  let primaryCtaLabel = "Join your first league";
  if (hasLeague && !hasFaction && rosterHref) {
    primaryCtaHref = rosterHref;
    primaryCtaLabel = "Pick your team";
  } else if (hasLeague && hasFaction && !isPlaying && rosterHref) {
    primaryCtaHref = rosterHref;
    primaryCtaLabel = "Finish roster setup";
  } else if (allComplete && activeLeagues[0]?.leagues?.slug) {
    primaryCtaHref = `/leagues/${encodeURIComponent(activeLeagues[0].leagues!.slug!)}`;
    primaryCtaLabel = "Go to your league";
  }

  return {
    steps,
    completedCount,
    allComplete,
    primaryCtaHref,
    primaryCtaLabel,
    showEmptyCareerHero: !hasLeague,
  };
}
