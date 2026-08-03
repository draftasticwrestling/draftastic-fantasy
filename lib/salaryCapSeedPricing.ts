import "server-only";

import fs from "fs";
import path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isValidSalaryCapCost } from "@/lib/salaryCap";
import { getLeagueSnapshotSalaryCostsMap } from "@/lib/leagueSalarySnapshots";
import { wrestlerRosterFromBrand } from "@/lib/wrestlerRosterFromBrand";

export const SALARY_CAP_NXT_COST = 5;
const JUNE_REPRICE_START = "2026-06-17";
const JULY_REPRICE_START = "2026-07-07";
const AUGUST_REPRICE_START = "2026-08-02";

export function isNxtSalaryCapWrestler(brand: string | null | undefined): boolean {
  return wrestlerRosterFromBrand(brand) === "NXT";
}

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Parse `values ('Name', 25), ...` rows from official seed SQL files. */
export function parseSalaryCapSeedSql(sql: string): Array<{ name: string; cost: number }> {
  const values: Array<{ name: string; cost: number }> = [];
  const re = /\('([^']*(?:''[^']*)*)',\s*(\d+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) {
    values.push({ name: m[1].replace(/''/g, "'"), cost: Number(m[2]) });
  }
  return values;
}

function seedMapFromRows(rows: Array<{ name: string; cost: number }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    if (!isValidSalaryCapCost(row.cost)) continue;
    out[row.name.toLowerCase()] = row.cost;
    out[slugifyName(row.name)] = row.cost;
  }
  return out;
}

let cachedMaySeedByKey: Record<string, number> | null = null;
let cachedJuneSeedByKey: Record<string, number> | null = null;
let cachedJulySeedByKey: Record<string, number> | null = null;
let cachedAugustSeedByKey: Record<string, number> | null = null;

function loadSeedMaps(): {
  maySeedByKey: Record<string, number>;
  juneSeedByKey: Record<string, number>;
  julySeedByKey: Record<string, number>;
  augustSeedByKey: Record<string, number>;
} {
  if (cachedMaySeedByKey && cachedJuneSeedByKey && cachedJulySeedByKey && cachedAugustSeedByKey) {
    return {
      maySeedByKey: cachedMaySeedByKey,
      juneSeedByKey: cachedJuneSeedByKey,
      julySeedByKey: cachedJulySeedByKey,
      augustSeedByKey: cachedAugustSeedByKey,
    };
  }
  const root = process.cwd();
  const maySql = fs.readFileSync(
    path.join(root, "supabase/seed_salary_cap_wrestler_values_2026-05-16.sql"),
    "utf8"
  );
  const juneSql = fs.readFileSync(path.join(root, "supabase/seed_salary_cap_wrestler_values.sql"), "utf8");
  const julySql = fs.readFileSync(
    path.join(root, "supabase/seed_salary_cap_wrestler_values_2026-07-07.sql"),
    "utf8"
  );
  const augustSql = fs.readFileSync(
    path.join(root, "supabase/seed_salary_cap_wrestler_values_2026-08-02.sql"),
    "utf8"
  );
  cachedMaySeedByKey = seedMapFromRows(parseSalaryCapSeedSql(maySql));
  cachedJuneSeedByKey = seedMapFromRows(parseSalaryCapSeedSql(juneSql));
  cachedJulySeedByKey = seedMapFromRows(parseSalaryCapSeedSql(julySql));
  cachedAugustSeedByKey = seedMapFromRows(parseSalaryCapSeedSql(augustSql));
  return {
    maySeedByKey: cachedMaySeedByKey,
    juneSeedByKey: cachedJuneSeedByKey,
    julySeedByKey: cachedJulySeedByKey,
    augustSeedByKey: cachedAugustSeedByKey,
  };
}

/** Which monthly seed tier applies when a league is created. */
export function seedMapForLeagueCreatedAt(createdAt: string): Record<string, number> {
  const ymd = String(createdAt ?? "").slice(0, 10);
  const { maySeedByKey, juneSeedByKey, julySeedByKey, augustSeedByKey } = loadSeedMaps();
  if (ymd >= AUGUST_REPRICE_START) return augustSeedByKey;
  if (ymd >= JULY_REPRICE_START) return julySeedByKey;
  if (ymd >= JUNE_REPRICE_START) return juneSeedByKey;
  return maySeedByKey;
}

export type SalaryCapWrestlerSeedRow = {
  id: string;
  name: string | null;
  brand?: string | null;
};

/** Build per-wrestler costs from official seed files. NXT is always $5. */
export function buildSalaryCapCostsFromSeed(
  wrestlers: SalaryCapWrestlerSeedRow[],
  leagueCreatedAt: string
): Record<string, number> {
  const seed = seedMapForLeagueCreatedAt(leagueCreatedAt);
  const out: Record<string, number> = {};
  for (const w of wrestlers) {
    const id = String(w.id ?? "").trim();
    if (!id) continue;
    if (isNxtSalaryCapWrestler(w.brand)) {
      out[id] = SALARY_CAP_NXT_COST;
      continue;
    }
    const name = (w.name ?? "").toLowerCase();
    const cost = seed[id] ?? seed[name] ?? seed[slugifyName(w.name ?? "")];
    if (typeof cost === "number" && isValidSalaryCapCost(cost)) {
      out[id] = cost;
    }
  }
  return out;
}

export function resolveSalaryCapCostFromSeedMap(params: {
  wrestlerId: string;
  wrestlerName?: string | null;
  brand?: string | null;
  seedByKey: Record<string, number>;
}): number | null {
  if (isNxtSalaryCapWrestler(params.brand)) return SALARY_CAP_NXT_COST;
  const name = (params.wrestlerName ?? "").toLowerCase();
  const cost =
    params.seedByKey[params.wrestlerId] ??
    params.seedByKey[name] ??
    params.seedByKey[slugifyName(params.wrestlerName ?? "")];
  return typeof cost === "number" && isValidSalaryCapCost(cost) ? cost : null;
}

/** Frozen league pool + roster prices. Snapshots when present; else seed at league creation. */
export async function getLeagueFrozenSalaryCosts(
  supabase: Pick<SupabaseClient, "from">,
  leagueId: string
): Promise<Record<string, number>> {
  const snapshots = await getLeagueSnapshotSalaryCostsMap(supabase, leagueId);
  if (Object.keys(snapshots).length > 0) return snapshots;

  const { data: league } = await supabase
    .from("leagues")
    .select("created_at")
    .eq("id", leagueId)
    .maybeSingle();
  const createdAt = (league as { created_at?: string } | null)?.created_at ?? "";
  if (!createdAt) return {};

  const { data: wrestlers } = await supabase.from("wrestlers").select("id, name, brand");
  return buildSalaryCapCostsFromSeed((wrestlers ?? []) as SalaryCapWrestlerSeedRow[], createdAt);
}
