import { supabase } from "@/lib/supabase";
import { EXAMPLE_LEAGUE } from "@/lib/league";
import WrestlerList from "../../wrestlers/WrestlerList";
import type { WrestlerRow } from "../../wrestlers/WrestlerList";
import { aggregateWrestlerPoints } from "@/lib/scoring/aggregateWrestlerPoints.js";
import {
  computeEndOfMonthBeltPoints,
  FIRST_END_OF_MONTH_POINTS_DATE,
  getCurrentChampionsBySlug,
  inferReignsFromEvents,
} from "@/lib/scoring/endOfMonthBeltPoints.js";
import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";
import { isPersonaOnlySlug, getPersonasForDisplay } from "@/lib/scoring/personaResolution.js";

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
  description: "Wrestlers not assigned to any league owner.",
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
      .eq("status", "completed")
      .gte("date", LEAGUE_START_DATE)
      .order("date", { ascending: true }),
    supabase
      .from("championship_history")
      .select("champion_slug, champion_id, champion, champion_name, title, title_name, won_date, start_date, lost_date, end_date")
      .order("won_date", { ascending: true }),
  ]);

  const tableReigns = (rawReigns ?? []) as ChampionshipReign[];
  const inferredReigns = inferReignsFromEvents(events ?? []);
  const reigns = tableReigns.length > 0 ? tableReigns : inferredReigns;
  const currentChampionsBySlug = getCurrentChampionsBySlug(reigns);
  const pointsBySlug = aggregateWrestlerPoints(events ?? []);
  const endOfMonthBeltBySlug = computeEndOfMonthBeltPoints(reigns, FIRST_END_OF_MONTH_POINTS_DATE);

  const assignedIds = new Set(
    (assignments ?? []).map((r: { wrestler_id: string }) => r.wrestler_id.toLowerCase())
  );
  const wrestlers = wrestlersResult.data ?? [];
  const freeAgentsRaw = (
    (wrestlers ?? [])
      .filter((w: { id: string }) => !assignedIds.has((w.id as string).toLowerCase()))
      .filter((w: { id: string }) => !isPersonaOnlySlug(w.id))
  ) as { id: string; name: string | null; gender: string | null; brand: string | null; image_url?: string | null; dob?: string | null }[];

  const rows: WrestlerRow[] = freeAgentsRaw.map((w) => {
    const points = pointsBySlug[w.id] ?? { rsPoints: 0, plePoints: 0, beltPoints: 0 };
    const nameKey = w.name ? normalizeWrestlerName(w.name) : "";
    const extraBelt =
      (typeof endOfMonthBeltBySlug[w.id] === "number" ? endOfMonthBeltBySlug[w.id] : null) ??
      (nameKey && typeof endOfMonthBeltBySlug[nameKey] === "number" ? endOfMonthBeltBySlug[nameKey] : null) ??
      0;
    const beltPoints = points.beltPoints + extraBelt;
    const totalPoints = points.rsPoints + points.plePoints + beltPoints;
    const titles =
      currentChampionsBySlug[w.id] ?? (nameKey ? currentChampionsBySlug[nameKey] : null) ?? [];
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
      personaDisplay: getPersonasForDisplay(w.id) ?? null,
      currentChampionship: titles.length > 0 ? titles.join(", ") : null,
    };
  });

  return (
    <>
      <h1 style={{ marginBottom: 8 }}>Free agents</h1>
      <p style={{ color: "#555", marginBottom: 32 }}>
        Wrestlers in the pool who are not currently assigned to any owner. Use the Draft page to add them to a roster.
      </p>

      {rows.length === 0 ? (
        <p style={{ color: "#666" }}>No free agents — every wrestler in the pool is on a roster.</p>
      ) : (
        <>
          <WrestlerList wrestlers={rows} />
          <p style={{ marginTop: 24, color: "#666" }}>
            Total: {rows.length} free agents. Use the Draft page to assign them to an owner.
          </p>
        </>
      )}
    </>
  );
}
