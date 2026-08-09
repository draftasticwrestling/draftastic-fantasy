import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminClient } from "@/lib/supabase/admin";
import { getRosterRulesForLeague } from "@/lib/leagueStructure";

export type RosterValidationFailure = {
  userId: string;
  expectedSize: number;
  actualSize: number;
  female: number;
  male: number;
  minFemale: number;
  minMale: number;
};

/**
 * Per-member roster completeness vs league rules (size + gender mins).
 * Used by draft approval and offline draft submit-for-review.
 */
export async function getLeagueRosterValidationFailures(
  leagueId: string,
  client?: SupabaseClient | null
): Promise<RosterValidationFailure[]> {
  const admin = client ?? getAdminClient();
  if (!admin) return [];
  const [{ data: league }, { data: members }, { data: rows }, { data: genders }] = await Promise.all([
    admin.from("leagues").select("season_slug, league_type, include_nxt").eq("id", leagueId).maybeSingle(),
    admin.from("league_members").select("user_id").eq("league_id", leagueId),
    admin.from("league_rosters").select("user_id, wrestler_id").eq("league_id", leagueId).is("released_at", null),
    admin.from("wrestlers").select("id, gender"),
  ]);
  const memberIds = ((members ?? []) as { user_id: string }[]).map((m) => m.user_id);
  const rules = getRosterRulesForLeague(
    memberIds.length,
    (league as { season_slug?: string | null } | null)?.season_slug ?? null,
    Boolean((league as { include_nxt?: boolean | null } | null)?.include_nxt),
    (league as { league_type?: string | null } | null)?.league_type ?? null
  );
  if (!rules) return [];
  const genderById = new Map<string, "F" | "M" | null>();
  for (const w of (genders ?? []) as { id: string; gender: string | null }[]) {
    const g = String(w.gender ?? "").trim().toLowerCase();
    genderById.set(w.id, g === "female" || g === "f" ? "F" : g === "male" || g === "m" ? "M" : null);
  }
  const rosterByUser = new Map<string, string[]>();
  for (const r of (rows ?? []) as { user_id: string; wrestler_id: string }[]) {
    const list = rosterByUser.get(r.user_id) ?? [];
    list.push(r.wrestler_id);
    rosterByUser.set(r.user_id, list);
  }
  const failures: RosterValidationFailure[] = [];
  for (const userId of memberIds) {
    const roster = rosterByUser.get(userId) ?? [];
    let female = 0;
    let male = 0;
    for (const wid of roster) {
      const g = genderById.get(wid) ?? null;
      if (g === "F") female += 1;
      if (g === "M") male += 1;
    }
    if (roster.length !== rules.rosterSize || female < rules.minFemale || male < rules.minMale) {
      failures.push({
        userId,
        expectedSize: rules.rosterSize,
        actualSize: roster.length,
        female,
        male,
        minFemale: rules.minFemale,
        minMale: rules.minMale,
      });
    }
  }
  return failures;
}
