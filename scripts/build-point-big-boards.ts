/**
 * Rank the point-based Big Boards.
 * Injured wrestlers stay on the lists. Auto-pick skips them at pick time.
 * Run: npx tsx scripts/build-point-big-boards.ts
 */
import { writeFileSync } from "node:fs";
import { config } from "dotenv";
config({ path: ".env" });
import { createClient } from "@supabase/supabase-js";
import { EVENT_STATUSES_FOR_SCORING } from "../lib/eventsScoring";
import {
  isDraftableWrestler,
  isDraftableWrestlerForDraftTesting,
  normalizeWrestlerRowFromApi,
} from "../lib/leagueDraft";
import { ROAD_TO_WAR_GAMES_2026 } from "../lib/leagueSeasons";
import { addDaysYmd } from "../lib/salaryCapMonthlyPricing";
import { aggregateWrestlerPoints, getPointsForWrestler } from "../lib/scoring/aggregateWrestlerPoints.js";
import {
  computeWeeklyBeltHoldPointsAccumulated,
  getMonthlyBeltForWrestler,
} from "../lib/scoring/endOfMonthBeltPoints.js";
import { firstEligibleWeekEndSundayForLeagueStart } from "../lib/beltWeeklyHold";
import { normalizeDraftPoolGender } from "../lib/wrestlerDraftGender";
import { brandByWrestlerSlugFromRows } from "../lib/wrestlerBrandLookup";

const AS_OF = "2026-11-15";
const NINETY_FROM = addDaysYmd(AS_OF, -90);

type Ranked = { id: string; name: string; points: number; gender: string | null; injured: boolean };

type Wrestler = {
  id: string;
  name: string | null;
  gender: string | null;
  brand: string | null;
  status?: string | null;
  classification?: string | null;
};

async function main() {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const [{ data: wrestlers, error: wErr }, { data: cache2026, error: cErr }, { data: events, error: eErr }, { data: reigns, error: rErr }] =
    await Promise.all([
      admin.from("wrestlers").select('id, name, gender, brand, "Status", classification'),
      admin.from("wrestler_stats_cache").select("wrestler_id, total_points").eq("season_key", "2026"),
      admin
        .from("events")
        .select("id, name, date, matches")
        .in("status", [...EVENT_STATUSES_FOR_SCORING])
        .gte("date", ROAD_TO_WAR_GAMES_2026.season_start_ymd)
        .lte("date", AS_OF),
      admin.from("championship_history").select("*"),
    ]);
  if (wErr) throw wErr;
  if (cErr) throw cErr;
  if (eErr) throw eErr;
  if (rErr) throw rErr;

  const roster: Wrestler[] = (wrestlers ?? []).map((row) => {
    const raw = row as Record<string, unknown>;
    const normalized = normalizeWrestlerRowFromApi(raw);
    return {
      id: String(row.id),
      name: (row as { name?: string | null }).name ?? null,
      gender: (row as { gender?: string | null }).gender ?? null,
      brand: (row as { brand?: string | null }).brand ?? null,
      status: normalized.status,
      classification: normalized.classification,
    };
  });
  const draftable = roster.filter((w) =>
    isDraftableWrestlerForDraftTesting({
      id: w.id,
      status: w.status,
      classification: w.classification,
      brand: w.brand ?? undefined,
    })
  );
  const brandBySlug = brandByWrestlerSlugFromRows(roster.map((w) => ({ id: w.id, brand: w.brand })));
  const eventRows = (events ?? []).map((event) => ({
    id: String(event.id),
    name: String(event.name ?? ""),
    date: String(event.date ?? "").slice(0, 10),
    matches: (event.matches as object[] | null) ?? undefined,
  }));

  const points2026 = new Map<string, number>();
  for (const row of cache2026 ?? []) {
    const id = String(row.wrestler_id ?? "");
    if (!id) continue;
    points2026.set(id, Number(row.total_points ?? 0));
  }

  const windowPoints = (from: string, to: string) => {
    const slice = eventRows.filter((event) => event.date >= from && event.date <= to);
    const scored = aggregateWrestlerPoints(slice, brandBySlug);
    const hold = computeWeeklyBeltHoldPointsAccumulated(
      reigns ?? [],
      firstEligibleWeekEndSundayForLeagueStart(from),
      to
    );
    const totals = new Map<string, number>();
    for (const wrestler of draftable) {
      const nameKey = wrestler.name ?? "";
      const eventPoints = getPointsForWrestler(scored, wrestler.id, nameKey);
      const reignPoints = getMonthlyBeltForWrestler(hold, wrestler.id, nameKey, to);
      const total = eventPoints.rsPoints + eventPoints.plePoints + eventPoints.beltPoints + Number(reignPoints || 0);
      totals.set(wrestler.id, total);
    }
    return { totals, events: slice.length };
  };

  const r2wg = windowPoints(ROAD_TO_WAR_GAMES_2026.season_start_ymd, AS_OF);
  const ninety = windowPoints(NINETY_FROM, AS_OF);

  function rank(points: Map<string, number>): Ranked[] {
    const rows: Ranked[] = draftable.map((wrestler) => ({
      id: wrestler.id,
      name: wrestler.name ?? wrestler.id,
      points: points.get(wrestler.id) ?? 0,
      gender: wrestler.gender,
      injured: !isDraftableWrestler({
        id: wrestler.id,
        status: wrestler.status,
        classification: wrestler.classification,
        brand: wrestler.brand ?? undefined,
      }),
    }));
    rows.sort((a, b) => b.points - a.points || a.id.localeCompare(b.id));
    return rows.slice(0, 100);
  }

  const boards = {
    y2026: rank(points2026),
    previous_season: rank(r2wg.totals),
    ninety_day: rank(ninety.totals),
  };

  console.log(`events since ${ROAD_TO_WAR_GAMES_2026.season_start_ymd}: ${eventRows.length}`);
  console.log(`90-day window: ${NINETY_FROM} through ${AS_OF} (${ninety.events} events)`);
  console.log(`Road to War Games window: ${ROAD_TO_WAR_GAMES_2026.season_start_ymd} through ${AS_OF} (${r2wg.events} events)`);
  for (const [id, top] of Object.entries(boards)) {
    const female = top.filter((w) => normalizeDraftPoolGender(w.gender) === "F").length;
    const injured = top.filter((w) => w.injured);
    console.log(`\n${id}: female ${female}, injured ${injured.length}`);
    top.slice(0, 8).forEach((w, i) => console.log(`  ${i + 1}. ${w.name} ${w.points}${w.injured ? " (injured)" : ""}`));
    if (injured.length) console.log("  injured:", injured.map((w) => w.name).join(", "));
  }

  writeFileSync(
    "/tmp/draftastic-point-boards.json",
    JSON.stringify(
      Object.fromEntries(Object.entries(boards).map(([id, rows]) => [id, rows.map((row) => row.id)])),
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
