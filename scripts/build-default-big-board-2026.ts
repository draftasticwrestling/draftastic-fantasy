/**
 * Build Default Big Board from wrestler_stats_cache season_key=2026.
 * Run: npx tsx scripts/build-default-big-board-2026.ts
 */
import { config } from "dotenv";
config({ path: ".env" });
import { createClient } from "@supabase/supabase-js";
import {
  isDraftableWrestlerForDraftTesting,
  normalizeWrestlerRowFromApi,
} from "../lib/leagueDraft";
import { normalizeDraftPoolGender } from "../lib/wrestlerDraftGender";

async function main() {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const [{ data: cache, error: cErr }, { data: wrestlers, error: wErr }] = await Promise.all([
    admin
      .from("wrestler_stats_cache")
      .select("wrestler_id, total_points, updated_at")
      .eq("season_key", "2026")
      .order("total_points", { ascending: false }),
    admin.from("wrestlers").select('id, name, gender, brand, "Status", classification'),
  ]);
  if (cErr) throw cErr;
  if (wErr) throw wErr;

  const byId = new Map(
    (wrestlers ?? []).map((w) => {
      const raw = w as Record<string, unknown>;
      const normalized = normalizeWrestlerRowFromApi(raw);
      return [
        String(w.id),
        {
          ...normalized,
          name: (w as { name?: string | null }).name ?? null,
          gender: (w as { gender?: string | null }).gender ?? null,
          brand: (w as { brand?: string | null }).brand ?? null,
        },
      ] as const;
    })
  );

  const updatedAt = (cache ?? []).find((r) => r.updated_at)?.updated_at ?? null;
  console.log("cache updated_at sample:", updatedAt);
  console.log("cache rows:", cache?.length ?? 0);

  const ranked: Array<{ id: string; name: string; points: number; gender: string | null; brand: string | null }> = [];
  for (const row of cache ?? []) {
    const id = String(row.wrestler_id ?? "");
    if (!id) continue;
    const w = byId.get(id);
    if (!w) continue;
    // Match autopick pool: injured OK, inactive/alumni/etc. excluded.
    if (!isDraftableWrestlerForDraftTesting(w)) continue;
    const points = Number(row.total_points ?? 0);
    if (!Number.isFinite(points)) continue;
    ranked.push({
      id,
      name: String(w.name ?? id),
      points,
      gender: w.gender ?? null,
      brand: w.brand ?? null,
    });
  }

  ranked.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return a.id.localeCompare(b.id);
  });

  const top = ranked.slice(0, 100);
  console.log(`draftable with 2026 points rows: ${ranked.length}; taking top ${top.length}`);

  let female = 0;
  for (const w of top) {
    if (normalizeDraftPoolGender(w.gender) === "F") female++;
  }
  console.log(`female in top 100: ${female}`);
  console.log("top 15:");
  top.slice(0, 15).forEach((w, i) => console.log(`${i + 1}. ${w.name} (${w.id}) ${w.points} [${w.brand}]`));
  console.log("...");
  top.slice(95).forEach((w, i) => console.log(`${i + 96}. ${w.name} (${w.id}) ${w.points} [${w.brand}]`));

  console.log("\nIDS_JSON=");
  console.log(JSON.stringify(top.map((w) => w.id), null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
