"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createLeague } from "@/lib/leagues";
import {
  leagueCreationAccessIsConfigured,
  consumeLeagueCreationAccessCode,
} from "@/lib/leagueCreationAccess";
import { getIsSiteAdmin } from "@/lib/auth/siteAdmin";
import { STANDARD_USER_CREATE_SEASON_SLUG } from "@/lib/leagueSeasons";

export type CreateLeagueState = { error?: string } | null;

/** Matches DB / createLeague; site admins may pick any of these. */
const ADMIN_LEAGUE_TYPES = new Set(["season_overall", "head_to_head", "combo", "legacy"]);

const BETA_MIN_TEAMS = 3;
const BETA_MAX_TEAMS = 6;
const ADMIN_MIN_TEAMS = 3;
const ADMIN_MAX_TEAMS = 16;

export async function createLeagueAction(
  _prev: CreateLeagueState,
  formData: FormData
): Promise<CreateLeagueState> {
  const isSiteAdmin = await getIsSiteAdmin();
  /** Standard beta rules: mailing-list code (if configured), Road to SummerSlam season, season_overall only, 3–6 teams. */
  const enforceStandardRules =
    !isSiteAdmin ||
    (isSiteAdmin && formData.get("enforce_standard_create_rules") === "1");

  const name = (formData.get("name") as string)?.trim() ?? "";
  const season_slug = (formData.get("season_slug") as string)?.trim() ?? "";
  const team_count = Math.floor(Number(formData.get("team_count")));
  const league_type = (formData.get("league_type") as string)?.trim() ?? "";
  const accessCode = (formData.get("access_code") as string)?.trim() ?? "";

  if (enforceStandardRules) {
    if (!accessCode) {
      return { error: "Enter the beta access code from your mailing list invite." };
    }
  }

  if (!name) {
    return { error: "Enter a league name." };
  }
  if (!season_slug) {
    return { error: "Select a season." };
  }

  if (enforceStandardRules) {
    if (season_slug !== STANDARD_USER_CREATE_SEASON_SLUG) {
      return {
        error:
          "During the beta, new leagues use the Road to SummerSlam season window. Other seasons are available when creating a league with full admin options.",
      };
    }
    if (league_type !== "season_overall") {
      return {
        error:
          "For the Road to SummerSlam beta, only Total Season Points leagues are available. Head-to-Head and other formats are coming soon.",
      };
    }
    if (team_count < BETA_MIN_TEAMS || team_count > BETA_MAX_TEAMS) {
      return { error: `Choose between ${BETA_MIN_TEAMS} and ${BETA_MAX_TEAMS} teams for this season.` };
    }
  } else {
    if (!ADMIN_LEAGUE_TYPES.has(league_type)) {
      return { error: "Select a league format." };
    }
    if (
      !Number.isFinite(team_count) ||
      team_count < ADMIN_MIN_TEAMS ||
      team_count > ADMIN_MAX_TEAMS
    ) {
      return { error: `Choose between ${ADMIN_MIN_TEAMS} and ${ADMIN_MAX_TEAMS} teams.` };
    }
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: "You're not signed in. Sign out and sign in again, then try creating the league.",
    };
  }

  if (enforceStandardRules) {
    if (!(await leagueCreationAccessIsConfigured())) {
      return {
        error:
          "League creation access codes are not configured yet. Please contact Draftastic support.",
      };
    }
    const consume = await consumeLeagueCreationAccessCode(accessCode);
    if (!consume.ok) {
      return {
        error:
          consume.error ??
          "That access code isn’t valid. Check the email we sent you, or contact us if you need help.",
      };
    }
  }

  const { league, error } = await createLeague({
    name,
    season_slug,
    max_teams: team_count,
    league_type,
  });
  if (error) return { error };
  if (!league) return { error: "Failed to create league." };

  redirect(`/leagues/${league.slug}?invite=1`);
}
