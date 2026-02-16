import { supabase } from "@/lib/supabase";

export type DraftPickRow = {
  id: string;
  league_slug: string;
  season: number;
  pick_type: "round" | "discovery";
  round_number: number | null;
  discovery_number: number | null;
  original_owner_slug: string;
  current_owner_slug: string;
  contract_years?: number;
  created_at?: string;
};

/** Human-readable label for a pick (e.g. "Round 1 (3 yr)", "Discovery 2 (2 yr)"). */
export function getPickLabel(pick: {
  pick_type: string;
  round_number: number | null;
  discovery_number: number | null;
  contract_years?: number;
}): string {
  let name: string;
  if (pick.pick_type === "round" && pick.round_number != null) {
    name = `Round ${pick.round_number}`;
  } else if (pick.pick_type === "discovery" && pick.discovery_number != null) {
    name = `Discovery ${pick.discovery_number}`;
  } else {
    name = "Pick";
  }
  const years = pick.contract_years;
  if (years != null && years >= 1 && years <= 3) {
    return `${name} (${years} yr)`;
  }
  return name;
}

/**
 * Fetch all draft picks for the league and season, grouped by current owner.
 */
export async function getDraftPicksByOwner(leagueSlug: string, season: number): Promise<Record<string, DraftPickRow[]>> {
  const { data, error } = await supabase
    .from("draft_picks")
    .select("id, league_slug, season, pick_type, round_number, discovery_number, original_owner_slug, current_owner_slug, contract_years, created_at")
    .eq("league_slug", leagueSlug)
    .eq("season", season)
    .order("pick_type")
    .order("round_number", { nullsFirst: false })
    .order("discovery_number", { nullsFirst: false });

  if (error) {
    return {};
  }

  const byOwner: Record<string, DraftPickRow[]> = {};
  for (const row of (data ?? []) as DraftPickRow[]) {
    const owner = row.current_owner_slug;
    if (!byOwner[owner]) byOwner[owner] = [];
    byOwner[owner].push(row);
  }
  return byOwner;
}

/**
 * Fetch draft picks for a single owner (picks they currently hold).
 */
export async function getDraftPicksForOwner(leagueSlug: string, season: number, ownerSlug: string): Promise<DraftPickRow[]> {
  const byOwner = await getDraftPicksByOwner(leagueSlug, season);
  const picks = byOwner[ownerSlug] ?? [];
  return picks.sort((a, b) => {
    if (a.pick_type !== b.pick_type) return a.pick_type === "round" ? -1 : 1;
    if (a.pick_type === "round" && a.round_number != null && b.round_number != null) return a.round_number - b.round_number;
    if (a.pick_type === "discovery" && a.discovery_number != null && b.discovery_number != null) return a.discovery_number - b.discovery_number;
    return 0;
  });
}

export const DEFAULT_SEASON = 3;
