import { supabase } from "@/lib/supabase";
import { EXAMPLE_LEAGUE } from "@/lib/league";
import WrestlerList from "../../wrestlers/WrestlerList";
import type { WrestlerRow } from "../../wrestlers/WrestlerList";
import { aggregateWrestlerPoints } from "@/lib/scoring/aggregateWrestlerPoints.js";
import { aggregateWrestlerMatchStats } from "@/lib/scoring/aggregateWrestlerMatchStats.js";
import {
  computeHybridPublicBeltHoldBySlug,
  getCurrentChampionsBySlug,
  inferReignsFromEvents,
  mergeReigns,
} from "@/lib/scoring/endOfMonthBeltPoints.js";
import {
  mergeCurrentChampionTitleStrings,
  mergeGetMatchStatsForWrestler,
  mergeGetMonthlyBeltForWrestler,
  mergeGetPointsForWrestler,
} from "@/lib/scoring/draftAliasListMerge";
import { EVENT_STATUSES_FOR_SCORING } from "@/lib/eventsScoring";
import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";
import { getListPersonaFootnote, isHiddenCanonicalListSlug } from "@/lib/scoring/personaResolution.js";
import { brandByWrestlerSlugFromRows } from "@/lib/wrestlerBrandLookup";

const LEAGUE_START_DATE = "2025-05-02";

function read2kRating(row: Record<string, unknown>, key: string): number | null {
  const v = row[key];
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

type ChampionshipReign = {
  champion_slug?: string | null;
  champion_id?: string | null;
  champion?: string | null;
  champion_name?: string | null;
  title?: string | null;
  title_name?: string | null;
  won_date?: string | null;
  start_date?: string | null;
  lost_date?: string | null;
  end_date?: string | null;
};

export const metadata = {
  title: `Free Agents — ${EXAMPLE_LEAGUE.name} — Draftastic Fantasy`,
  description: "Wrestlers not assigned to any manager's faction.",
};

export default async function LeagueFreeAgentsPage() {
  const [
    wrestlersResult,
    { data: assignments },
    { data: events },
    { data: rawReigns },
  ] = await Promise.all([
    (async () => {
      // Column is "Status" (capital S) in DB; avoid .or("status...")
      const r = await supabase
        .from("wrestlers")
        .select('id, name, gender, brand, image_url, dob, "2K26 rating", "2K25 rating"')
        .order("name", { ascending: true });
      return r;
    })(),
    supabase
      .from("roster_assignments")
      .select("wrestler_id")
      .eq("league_slug", EXAMPLE_LEAGUE.slug),
    supabase
      .from("events")
      .select("id, name, date, matches")
      .in("status", [...EVENT_STATUSES_FOR_SCORING])
      .gte("date", LEAGUE_START_DATE)
      .order("date", { ascending: true }),
    supabase
      .from("championship_history")
      .select("champion_slug, champion, title, title_name, won_date, start_date, lost_date, end_date")
      .order("won_date", { ascending: true }),
  ]);

  const tableReigns = (rawReigns ?? []) as ChampionshipReign[];
  const inferredReigns = inferReignsFromEvents(events ?? []);
  const reigns = mergeReigns(tableReigns, inferredReigns) as ChampionshipReign[];
  const currentChampionsBySlug = getCurrentChampionsBySlug(reigns);
  const wrestlersForBrands = wrestlersResult.data ?? [];
  const brandBySlug = brandByWrestlerSlugFromRows(
    wrestlersForBrands.map((w) => ({
      id: (w as { id: string }).id,
      brand: (w as { brand?: string | null }).brand ?? null,
    }))
  );
  const pointsBySlug = aggregateWrestlerPoints(events ?? [], brandBySlug);
  const matchStatsBySlug = aggregateWrestlerMatchStats(events ?? []);
  const endOfMonthBeltBySlug = computeHybridPublicBeltHoldBySlug(reigns);

  const assignedIds = new Set(
    (assignments ?? []).map((r: { wrestler_id: string }) => r.wrestler_id.toLowerCase())
  );
  const wrestlers = wrestlersResult.data ?? [];
  const freeAgentsRaw = (
    (wrestlers ?? [])
      .filter((w: { id: string }) => !assignedIds.has((w.id as string).toLowerCase()))
      .filter((w: { id: string }) => !isHiddenCanonicalListSlug(w.id))
  ) as { id: string; name: string | null; gender: string | null; brand: string | null; image_url?: string | null; dob?: string | null }[];

  const rows: WrestlerRow[] = freeAgentsRaw.map((w) => {
    const slugKey = w.id;
    const nameKey = w.name ? normalizeWrestlerName(w.name) : "";
    const idKey = normalizeWrestlerName(String(slugKey));
    const canonicalKey = nameKey || (slugKey ? normalizeWrestlerName(String(slugKey)) : "") || slugKey;
    const points = mergeGetPointsForWrestler(pointsBySlug, slugKey, nameKey);
    const matchStats = mergeGetMatchStatsForWrestler(matchStatsBySlug, slugKey, nameKey);
    const extraBelt = mergeGetMonthlyBeltForWrestler(endOfMonthBeltBySlug, slugKey, nameKey);
    const beltPoints = points.beltPoints + extraBelt;
    const totalPoints = points.rsPoints + points.plePoints + beltPoints;
    const directChamp =
      currentChampionsBySlug[canonicalKey] ?? currentChampionsBySlug[idKey] ?? null;
    const aliasChamp = mergeCurrentChampionTitleStrings(currentChampionsBySlug, slugKey, nameKey);
    const titles: string[] = (() => {
      const seen = new Set<string>();
      const out: string[] = [];
      for (const list of [directChamp, aliasChamp]) {
        if (!list) continue;
        for (const t of list) {
          if (t && !seen.has(t)) {
            seen.add(t);
            out.push(t);
          }
        }
      }
      return out;
    })();
    return {
      id: w.id,
      name: w.name ?? null,
      gender: w.gender ?? null,
      brand: w.brand ?? null,
      image_url: w.image_url ?? null,
      dob: w.dob ?? null,
      rating_2k26: read2kRating(w as Record<string, unknown>, "2K26 rating"),
      rating_2k25: read2kRating(w as Record<string, unknown>, "2K25 rating"),
      rsPoints: points.rsPoints,
      plePoints: points.plePoints,
      beltPoints,
      totalPoints,
      mw: matchStats.mw,
      win: matchStats.win,
      loss: matchStats.loss,
      nc: matchStats.nc,
      dqw: matchStats.dqw,
      dql: matchStats.dql,
      personaDisplay: getListPersonaFootnote(w.id) ?? null,
      currentChampionship: titles.length > 0 ? titles.join(", ") : null,
    };
  });

  return (
    <>
      <h1 style={{ marginBottom: 8 }}>Free agents</h1>
      <p style={{ color: "#555", marginBottom: 32 }}>
        Wrestlers in the pool who are not currently assigned to any manager’s faction. Use the Draft page to add them to a roster.
      </p>

      {rows.length === 0 ? (
        <p style={{ color: "#666" }}>No free agents — every wrestler in the pool is on a roster.</p>
      ) : (
        <>
          <WrestlerList wrestlers={rows} />
          <p style={{ marginTop: 24, color: "#666" }}>
            Total: {rows.length} free agents. Use the Draft page to assign them to a manager.
          </p>
        </>
      )}
    </>
  );
}
