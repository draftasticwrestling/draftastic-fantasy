import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminClient } from "@/lib/supabase/admin";
import { isValidSalaryCapCost } from "@/lib/salaryCap";
import {
  buildSalaryCapCostsFromSeed,
  type SalaryCapWrestlerSeedRow,
} from "@/lib/salaryCapSeedPricing";

/**
 * Freeze official seed salary tiers for a league at creation.
 * Values never change for that league when global prices are updated monthly.
 */
export async function snapshotLeagueSalaryCosts(leagueId: string): Promise<{ ok: boolean; error?: string }> {
  const admin = getAdminClient();
  if (!admin) return { ok: false, error: "Admin client unavailable." };

  if (await leagueHasSalarySnapshots(admin, leagueId)) {
    return { ok: true };
  }

  const { data: league, error: lErr } = await admin
    .from("leagues")
    .select("created_at")
    .eq("id", leagueId)
    .maybeSingle();
  if (lErr) return { ok: false, error: lErr.message };
  const createdAt = (league as { created_at?: string } | null)?.created_at;
  if (!createdAt) return { ok: false, error: "League not found." };

  const { data: wrestlers, error: wErr } = await admin.from("wrestlers").select("id, name, brand");
  if (wErr) return { ok: false, error: wErr.message };

  const costById = buildSalaryCapCostsFromSeed((wrestlers ?? []) as SalaryCapWrestlerSeedRow[], createdAt);
  const rows = Object.entries(costById).map(([wrestler_id, salary_cap_cost]) => ({
    league_id: leagueId,
    wrestler_id,
    salary_cap_cost,
  }));

  if (rows.length === 0) return { ok: true };

  const { error } = await admin.from("league_wrestler_salary_snapshots").upsert(rows, {
    onConflict: "league_id,wrestler_id",
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getLeagueSnapshotSalaryCostsMap(
  supabase: Pick<SupabaseClient, "from">,
  leagueId: string
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("league_wrestler_salary_snapshots")
    .select("wrestler_id, salary_cap_cost")
    .eq("league_id", leagueId);
  if (error) return {};

  const out: Record<string, number> = {};
  for (const row of data ?? []) {
    const r = row as { wrestler_id?: string; salary_cap_cost?: number | null };
    const id = String(r.wrestler_id ?? "");
    const cost = r.salary_cap_cost;
    if (id && typeof cost === "number" && isValidSalaryCapCost(cost)) {
      out[id] = cost;
    }
  }
  return out;
}

/** League-locked cost when snapshots exist; otherwise null (caller falls back to global). */
export async function getLeagueSnapshotSalaryCost(
  supabase: Pick<SupabaseClient, "from">,
  leagueId: string,
  wrestlerId: string
): Promise<number | null> {
  const { data, error } = await supabase
    .from("league_wrestler_salary_snapshots")
    .select("salary_cap_cost")
    .eq("league_id", leagueId)
    .eq("wrestler_id", wrestlerId)
    .maybeSingle();
  if (error) return null;
  const cost = (data as { salary_cap_cost?: number | null } | null)?.salary_cap_cost;
  return typeof cost === "number" && isValidSalaryCapCost(cost) ? cost : null;
}

export async function leagueHasSalarySnapshots(
  supabase: Pick<SupabaseClient, "from">,
  leagueId: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from("league_wrestler_salary_snapshots")
    .select("wrestler_id", { count: "exact", head: true })
    .eq("league_id", leagueId)
    .limit(1);
  if (error) return false;
  return (count ?? 0) > 0;
}
