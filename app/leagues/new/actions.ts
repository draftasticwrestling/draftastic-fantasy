"use server";

import { redirect } from "next/navigation";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import { createLeague } from "@/lib/leagues";
import { getIsSiteAdmin } from "@/lib/auth/siteAdmin";
import {
  STANDARD_USER_CREATE_SEASON_SLUG,
  PUBLIC_SALARY_CAP_SEASON_SLUG,
  roadToWarGamesCreateOpen,
} from "@/lib/leagueSeasons";
import { SALARY_CAP_LEAGUE_TYPE } from "@/lib/leagueStructure";
import { leaguePostJoinPath } from "@/lib/leagueOnboarding";

export type CreateLeagueState = { error?: string } | null;

/** Matches DB / createLeague; site admins may pick any of these. */
const ADMIN_LEAGUE_TYPES = new Set([
  "season_overall",
  "head_to_head",
  "combo",
  "legacy",
  "salary_cap",
]);

/** Road to War Games private-league formats and team-count limits. */
const R2WG_TEAM_RANGE: Record<string, { min: number; max: number }> = {
  season_overall: { min: 3, max: 6 },
  head_to_head: { min: 4, max: 8 },
};

const ADMIN_MIN_TEAMS = 3;
const ADMIN_MAX_TEAMS = 16;

export async function createLeagueAction(
  _prev: CreateLeagueState,
  formData: FormData
): Promise<CreateLeagueState> {
  const isSiteAdmin = await getIsSiteAdmin();
  /** Standard rules: Road to War Games season, Total Season Points (3–6) or Head-to-Head (4–8), NXT included, no access code. */
  const enforceStandardRules =
    !isSiteAdmin ||
    (isSiteAdmin && formData.get("enforce_standard_create_rules") === "1");

  const name = (formData.get("name") as string)?.trim() ?? "";
  const season_slug = (formData.get("season_slug") as string)?.trim() ?? "";
  const team_count = Math.floor(Number(formData.get("team_count")));
  const league_type = (formData.get("league_type") as string)?.trim() ?? "";
  const include_nxt_raw = formData.get("include_nxt");
  const include_nxt = include_nxt_raw === "1" || include_nxt_raw === "on";
  const visibility_type_raw = (formData.get("visibility_type") as string)?.trim().toLowerCase() ?? "private";
  const visibility_type = visibility_type_raw === "public" ? "public" : "private";
  if (enforceStandardRules) {
    if (visibility_type === "public") {
      return {
        error: "Public leagues can't be created here. Join an open public league from Play Now instead.",
      };
    }
    if (!roadToWarGamesCreateOpen()) {
      return {
        error:
          "Road to War Games league creation is closed for this season (new leagues must start at least six weeks before Survivor Series: War Games).",
      };
    }
    if (season_slug !== STANDARD_USER_CREATE_SEASON_SLUG) {
      return {
        error:
          "New private leagues use the Road to War Games season. Other seasons are available with full admin options.",
      };
    }
    const range = R2WG_TEAM_RANGE[league_type];
    if (!range) {
      return {
        error:
          "Choose Total Season Points or Head-to-Head. Combo, Legacy, and Salary Cap private leagues are coming soon.",
      };
    }
    if (team_count < range.min || team_count > range.max) {
      const label = league_type === "head_to_head" ? "Head-to-Head" : "Total Season Points";
      return { error: `${label} leagues use ${range.min}–${range.max} factions.` };
    }
  } else {
    if (!ADMIN_LEAGUE_TYPES.has(league_type)) {
      return { error: "Select a league format." };
    }
    if (include_nxt) {
      if (!isSiteAdmin) {
        return { error: "Only site administrators can create leagues that include NXT." };
      }
      if (league_type !== "head_to_head" && league_type !== "salary_cap") {
        return {
          error: "Include NXT is only available for Head-to-Head leagues (admin testing).",
        };
      }
    }
    if (
      !Number.isFinite(team_count) ||
      team_count < ADMIN_MIN_TEAMS ||
      team_count > ADMIN_MAX_TEAMS
    ) {
      return { error: `Choose between ${ADMIN_MIN_TEAMS} and ${ADMIN_MAX_TEAMS} teams.` };
    }
  }

  if (visibility_type === "private" && !name) {
    return { error: "Enter a league name." };
  }
  if (!season_slug && visibility_type !== "public") {
    return { error: "Select a season." };
  }

  const { supabase, user } = await getServerAuth();
  if (!user) {
    return {
      error: "You're not signed in. Sign out and sign in again, then try creating the league.",
    };
  }

  const effectiveVisibility = visibility_type;
  const effectiveSeasonSlug =
    effectiveVisibility === "public" ? PUBLIC_SALARY_CAP_SEASON_SLUG : season_slug;
  const effectiveLeagueType =
    effectiveVisibility === "public" ? SALARY_CAP_LEAGUE_TYPE : league_type;
  const effectiveMaxTeams = effectiveVisibility === "public" ? null : team_count;
  // Road to War Games private leagues always include NXT; admin full-mode respects the checkbox.
  const effectiveIncludeNxt = enforceStandardRules ? true : include_nxt;

  const { league, error } = await createLeague({
    name: effectiveVisibility === "public" ? "Public League" : name,
    season_slug: effectiveSeasonSlug,
    max_teams: effectiveMaxTeams,
    league_type: effectiveLeagueType,
    include_nxt: effectiveIncludeNxt,
    visibility_type: effectiveVisibility,
  });
  if (error) return { error };
  if (!league) return { error: "Failed to create league." };

  const dest = leaguePostJoinPath(league.slug, {
    league_type: league.league_type,
    season_slug: league.season_slug ?? null,
  });
  if (dest.includes("/onboarding")) {
    redirect(dest);
  }
  redirect(`${dest}?invite=1`);
}
