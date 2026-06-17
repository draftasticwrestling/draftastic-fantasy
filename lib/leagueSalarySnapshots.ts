import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminClient } from "@/lib/supabase/admin";
import { isValidSalaryCapCost } from "@/lib/salaryCap";

/**
 * Copy current global wrestler salary_cap_cost into a league snapshot.
 * Called when a public league is created so values stay fixed for the 12-week season.
 */
export async function snapshotLeagueSalaryCosts(leagueId: string): Promise<{ ok: boolean; error?: string }> {
  const admin = getAdminClient();
  if (!admin) return { ok: false, error: "Admin client unavailable." };

  const { data: wrestlers, error: wErr } = await admin
    .from("wrestlers")
    .select("id, salary_cap_cost");
  if (wErr) return { ok: false, error: wErr.message };

  const rows = (wrestlers ?? [])
    .map((w) => {
      const row = w as { id?: string; salary_cap_cost?: number | null };
      const id = String(row.id ?? "").trim();
      const cost = row.salary_cap_cost;
      if (!id || typeof cost !== "number" || !isValidSalaryCapCost(cost)) return null;
      return { league_id: leagueId, wrestler_id: id, salary_cap_cost: cost };
    })
    .filter(Boolean) as Array<{ league_id: string; wrestler_id: string; salary_cap_cost: number }>;

  if (rows.length === 0) return { ok: true };

  const { error } = await admin.from("league_wrestler_salary_snapshots").upsert(rows, {
    onConflict: "league_id,wrestler_id",
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
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
