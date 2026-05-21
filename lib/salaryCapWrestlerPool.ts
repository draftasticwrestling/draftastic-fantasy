import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SalaryCapWrestlerOption } from "@/app/leagues/[slug]/salary-cap/SalaryCapRosterBuilder";
import { leagueIncludesNxt } from "@/lib/leagueStructure";
import { isValidSalaryCapCost } from "@/lib/salaryCap";
import { loadSalaryCap2026StatsByWrestlerId } from "@/lib/salaryCap2026Stats";
import { loadWrestlerCurrentChampionshipContext } from "@/lib/wrestlerCurrentChampionships";
import { isHiddenCanonicalListSlug } from "@/lib/scoring/personaResolution.js";
import { isMainBrandWrestlerRosterForLeague } from "@/lib/wrestlerRosterFromBrand";

function read2kRating(row: Record<string, unknown>, key: string): number | null {
  const v = row[key];
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export type SalaryCapLeaguePoolInput = {
  id: string;
  include_nxt?: boolean | null;
  league_type?: string | null;
};

/** Wrestlers with salary values + 2026 stats + championship context (salary cap builder / FA picker). */
export async function buildSalaryCapWrestlerPool(
  supabase: SupabaseClient,
  league: SalaryCapLeaguePoolInput
): Promise<SalaryCapWrestlerOption[]> {
  const poolOpts = { includeNxt: leagueIncludesNxt(league) };
  const [wrestlersResult, championshipContext] = await Promise.all([
    supabase
      .from("wrestlers")
      .select('id, name, brand, image_url, gender, "Status", "2K26 rating", "2K25 rating", salary_cap_cost')
      .order("name", { ascending: true }),
    loadWrestlerCurrentChampionshipContext(supabase),
  ]);

  const pool = (wrestlersResult.data ?? [])
    .filter((w) => {
      const row = w as { id: string; brand?: string | null; salary_cap_cost?: number | null };
      if (isHiddenCanonicalListSlug(row.id)) return false;
      if (!isMainBrandWrestlerRosterForLeague(row.brand, poolOpts)) return false;
      return typeof row.salary_cap_cost === "number" && isValidSalaryCapCost(row.salary_cap_cost);
    })
    .map((w) => {
      const row = w as {
        id: string;
        name: string | null;
        brand?: string | null;
        salary_cap_cost: number;
        image_url?: string | null;
        gender?: string | null;
        Status?: string | null;
        "2K26 rating"?: unknown;
        "2K25 rating"?: unknown;
      };
      const raw = row as Record<string, unknown>;
      const name = row.name ?? row.id;
      const champ = championshipContext.resolve({
        id: row.id,
        name,
        gender: row.gender ?? null,
      });
      return {
        id: row.id,
        name,
        salaryCapCost: row.salary_cap_cost,
        brand: row.brand,
        imageUrl: row.image_url ?? null,
        gender: row.gender ?? null,
        status: (raw.Status ?? raw.status) != null ? String(raw.Status ?? raw.status) : null,
        rating2k26: read2kRating(raw, "2K26 rating"),
        rating2k25: read2kRating(raw, "2K25 rating"),
        currentChampionship: champ.displayLine,
        championBeltImageUrl: champ.beltImageUrl,
      };
    });

  const stats2026ById = await loadSalaryCap2026StatsByWrestlerId(
    supabase,
    pool.map((w) => ({ id: w.id, name: w.name }))
  );

  return pool.map((w) => ({
    ...w,
    stats2026: stats2026ById[w.id] ?? null,
  }));
}
