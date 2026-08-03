#!/usr/bin/env node
/**
 * Backfill league_wrestler_salary_snapshots from official seed files (not global wrestlers table).
 * May 2026 tiers for leagues created before 2026-06-17;
 * June 2026 tiers for leagues created before 2026-07-07;
 * July 2026 tiers for leagues created before 2026-08-02;
 * August 2026 tiers on/after.
 * NXT wrestlers are always $5.
 *
 * Usage: node scripts/backfill-league-salary-snapshots.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(root, ".env") });

const VALID = new Set([5, 10, 15, 20, 25]);
const JUNE_REPRICE_START = "2026-06-17";
const JULY_REPRICE_START = "2026-07-07";
const AUGUST_REPRICE_START = "2026-08-02";
const NXT_COST = 5;

function parseSeedValues(sql) {
  const values = [];
  const re = /\('([^']*(?:''[^']*)*)',\s*(\d+)\)/g;
  let m;
  while ((m = re.exec(sql))) {
    values.push({ name: m[1].replace(/''/g, "'"), cost: Number(m[2]) });
  }
  return values;
}

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function seedMapFromRows(rows) {
  const out = {};
  for (const row of rows) {
    if (!VALID.has(row.cost)) continue;
    out[row.name.toLowerCase()] = row.cost;
    out[slugify(row.name)] = row.cost;
  }
  return out;
}

function isNxtBrand(brand) {
  if (!brand) return false;
  const l = String(brand).trim().toLowerCase();
  return l === "nxt" || l.includes("nxt");
}

function buildCostsFromSeed(wrestlers, leagueCreatedAt, maySeed, juneSeed, julySeed, augustSeed) {
  const ymd = String(leagueCreatedAt ?? "").slice(0, 10);
  const seed =
    ymd >= AUGUST_REPRICE_START
      ? augustSeed
      : ymd >= JULY_REPRICE_START
        ? julySeed
        : ymd >= JUNE_REPRICE_START
          ? juneSeed
          : maySeed;
  const out = {};
  for (const w of wrestlers) {
    const id = String(w.id ?? "");
    if (!id) continue;
    if (isNxtBrand(w.brand)) {
      out[id] = NXT_COST;
      continue;
    }
    const name = String(w.name ?? "").toLowerCase();
    const cost = seed[id] ?? seed[name] ?? seed[slugify(w.name ?? "")];
    if (typeof cost === "number" && VALID.has(cost)) out[id] = cost;
  }
  return out;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const admin = createClient(url, key);
  const maySql = fs.readFileSync(path.join(root, "supabase/seed_salary_cap_wrestler_values_2026-05-16.sql"), "utf8");
  const juneSql = fs.readFileSync(path.join(root, "supabase/seed_salary_cap_wrestler_values.sql"), "utf8");
  const julySql = fs.readFileSync(
    path.join(root, "supabase/seed_salary_cap_wrestler_values_2026-07-07.sql"),
    "utf8"
  );
  const augustSql = fs.readFileSync(
    path.join(root, "supabase/seed_salary_cap_wrestler_values_2026-08-02.sql"),
    "utf8"
  );
  const maySeed = seedMapFromRows(parseSeedValues(maySql));
  const juneSeed = seedMapFromRows(parseSeedValues(juneSql));
  const julySeed = seedMapFromRows(parseSeedValues(julySql));
  const augustSeed = seedMapFromRows(parseSeedValues(augustSql));

  const { data: wrestlers, error: wErr } = await admin.from("wrestlers").select("id, name, brand");
  if (wErr) {
    console.error(wErr.message);
    process.exit(1);
  }

  const { data: leagues, error: lErr } = await admin
    .from("leagues")
    .select("id, slug, created_at")
    .eq("league_type", "salary_cap");
  if (lErr) {
    console.error(lErr.message);
    process.exit(1);
  }

  for (const league of leagues ?? []) {
    const { count, error: cErr } = await admin
      .from("league_wrestler_salary_snapshots")
      .select("wrestler_id", { count: "exact", head: true })
      .eq("league_id", league.id);
    if (cErr) {
      console.error(league.slug, cErr.message);
      continue;
    }
    if ((count ?? 0) > 0) {
      console.log(`skip ${league.slug} (${count} snapshots already)`);
      continue;
    }

    const costById = buildCostsFromSeed(
      wrestlers ?? [],
      league.created_at,
      maySeed,
      juneSeed,
      julySeed,
      augustSeed
    );
    const rows = Object.entries(costById).map(([wrestler_id, salary_cap_cost]) => ({
      league_id: league.id,
      wrestler_id,
      salary_cap_cost,
    }));

    if (rows.length === 0) {
      console.log(`no priced wrestlers for ${league.slug}`);
      continue;
    }

    const ymd = String(league.created_at ?? "").slice(0, 10);
    const seedLabel =
      ymd >= AUGUST_REPRICE_START
        ? "august"
        : ymd >= JULY_REPRICE_START
          ? "july"
          : ymd >= JUNE_REPRICE_START
            ? "june"
            : "may";
    const { error } = await admin.from("league_wrestler_salary_snapshots").insert(rows);
    if (error) console.error(league.slug, error.message);
    else console.log(`backfilled ${league.slug}: ${rows.length} wrestlers (${seedLabel} seed)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
