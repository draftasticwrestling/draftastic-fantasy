#!/usr/bin/env node
/**
 * Replace league_wrestler_salary_snapshots for one or more salary cap leagues.
 * Uses official seed files by league created_at (May / June / July / August tiers).
 *
 * Usage:
 *   node scripts/resnapshot-league-salary-costs.mjs salary-cap-test-1
 *   node scripts/resnapshot-league-salary-costs.mjs --all-pre-june
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

function seedForLeagueCreatedAt(createdAt, maySeed, juneSeed, julySeed, augustSeed) {
  const ymd = String(createdAt ?? "").slice(0, 10);
  if (ymd >= AUGUST_REPRICE_START) return { seed: augustSeed, label: "august" };
  if (ymd >= JULY_REPRICE_START) return { seed: julySeed, label: "july" };
  if (ymd >= JUNE_REPRICE_START) return { seed: juneSeed, label: "june" };
  return { seed: maySeed, label: "may" };
}

function buildCostsFromSeed(wrestlers, leagueCreatedAt, maySeed, juneSeed, julySeed, augustSeed) {
  const { seed } = seedForLeagueCreatedAt(
    leagueCreatedAt,
    maySeed,
    juneSeed,
    julySeed,
    augustSeed
  );
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

async function resnapshotLeague(admin, league, wrestlers, maySeed, juneSeed, julySeed, augustSeed) {
  const { label } = seedForLeagueCreatedAt(
    league.created_at,
    maySeed,
    juneSeed,
    julySeed,
    augustSeed
  );
  const costById = buildCostsFromSeed(
    wrestlers,
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

  const { error: delErr } = await admin
    .from("league_wrestler_salary_snapshots")
    .delete()
    .eq("league_id", league.id);
  if (delErr) {
    console.error(league.slug, "delete failed:", delErr.message);
    return false;
  }

  if (rows.length === 0) {
    console.log(`${league.slug}: no priced wrestlers (${label} seed)`);
    return true;
  }

  const { error } = await admin.from("league_wrestler_salary_snapshots").insert(rows);
  if (error) {
    console.error(league.slug, "insert failed:", error.message);
    return false;
  }

  console.log(`${league.slug}: ${rows.length} snapshots (${label} seed, created ${String(league.created_at).slice(0, 10)})`);
  return true;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const allPreJune = args.includes("--all-pre-june");
  const slugs = args.filter((a) => !a.startsWith("--"));
  if (!allPreJune && slugs.length === 0) {
    console.error("Usage: node scripts/resnapshot-league-salary-costs.mjs <slug> [slug2...]");
    console.error("       node scripts/resnapshot-league-salary-costs.mjs --all-pre-june");
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

  let query = admin.from("leagues").select("id, slug, created_at").eq("league_type", "salary_cap");
  if (!allPreJune) query = query.in("slug", slugs);
  const { data: leagues, error: lErr } = await query;
  if (lErr) {
    console.error(lErr.message);
    process.exit(1);
  }

  const targets = (leagues ?? []).filter((league) => {
    if (!allPreJune) return true;
    return String(league.created_at ?? "").slice(0, 10) < JUNE_REPRICE_START;
  });

  if (targets.length === 0) {
    console.error("No matching salary cap leagues found.");
    process.exit(1);
  }

  let ok = 0;
  for (const league of targets) {
    if (
      await resnapshotLeague(
        admin,
        league,
        wrestlers ?? [],
        maySeed,
        juneSeed,
        julySeed,
        augustSeed
      )
    )
      ok++;
  }

  console.log(`Done: ${ok}/${targets.length} leagues resnapshotted.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
