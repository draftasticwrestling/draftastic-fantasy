"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createLeague } from "@/lib/leagues";

export type CreateLeagueState = { error?: string } | null;

const VALID_LEAGUE_TYPES = ["season_overall", "head_to_head", "legacy"] as const;

export async function createLeagueAction(
  _prev: CreateLeagueState,
  formData: FormData
): Promise<CreateLeagueState> {
  const name = (formData.get("name") as string)?.trim() ?? "";
  const season_slug = (formData.get("season_slug") as string)?.trim() ?? "";
  const season_year = Number(formData.get("season_year"));
  const draft_date = (formData.get("draft_date") as string)?.trim() || null;
  const team_count = Math.floor(Number(formData.get("team_count")));
  const league_type = (formData.get("league_type") as string)?.trim() ?? "";

  if (!name) {
    return { error: "Enter a league name." };
  }
  if (!season_slug) {
    return { error: "Select a season." };
  }
  if (league_type === "head_to_head") {
    if (team_count < 4 || team_count > 16) {
      return { error: "Head-to-Head leagues require between 4 and 16 teams." };
    }
  } else if (team_count < 3 || team_count > 16) {
    return { error: "Number of teams must be between 3 and 16." };
  }
  if (!VALID_LEAGUE_TYPES.includes(league_type as (typeof VALID_LEAGUE_TYPES)[number])) {
    return { error: "Select a league format." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: "You're not signed in. Sign out and sign in again, then try creating the league.",
    };
  }

  const { league, error } = await createLeague({
    name,
    season_slug,
    season_year,
    draft_date,
    max_teams: team_count,
    league_type,
  });
  if (error) return { error };
  if (!league) return { error: "Failed to create league." };

  redirect(`/leagues/${league.slug}?invite=1`);
}
