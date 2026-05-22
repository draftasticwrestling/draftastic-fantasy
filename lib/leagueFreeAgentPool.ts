import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SalaryCapWrestlerOption } from "@/app/leagues/[slug]/salary-cap/SalaryCapRosterBuilder";
import { leagueIncludesNxt } from "@/lib/leagueStructure";
import { loadSalaryCap2026StatsByWrestlerId } from "@/lib/salaryCap2026Stats";
import { loadWrestlerCurrentChampionshipContext } from "@/lib/wrestlerCurrentChampionships";
import { isHiddenCanonicalListSlug } from "@/lib/scoring/personaResolution.js";
import { isMainBrandWrestlerRosterForLeague } from "@/lib/wrestlerRosterFromBrand";
import type { SalaryCapLeaguePoolInput } from "@/lib/salaryCapWrestlerPool";

function read2kRating(row: Record<string, unknown>, key: string): number | null {
  const v = row[key];
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

/** Free agents for exclusive draft leagues: eligible pool wrestlers not rostered in this league. */
export async function buildLeagueFreeAgentPool(
  supabase: SupabaseClient,
  league: SalaryCapLeaguePoolInput,
  rosteredWrestlerIds: Set<string>
): Promise<SalaryCapWrestlerOption[]> {
  const poolOpts = { includeNxt: leagueIncludesNxt(league) };
  const [wrestlersResult, championshipContext] = await Promise.all([
    supabase
      .from("wrestlers")
      .select('id, name, brand, image_url, gender, "Status", "2K26 rating", "2K25 rating"')
      .order("name", { ascending: true }),
    loadWrestlerCurrentChampionshipContext(supabase),
  ]);

  const pool = (wrestlersResult.data ?? [])
    .filter((w) => {
      const row = w as { id: string; brand?: string | null };
      if (isHiddenCanonicalListSlug(row.id)) return false;
      if (rosteredWrestlerIds.has(row.id)) return false;
      return isMainBrandWrestlerRosterForLeague(row.brand, poolOpts);
    })
    .map((w) => {
      const row = w as {
        id: string;
        name: string | null;
        brand?: string | null;
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
        salaryCapCost: 0,
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
