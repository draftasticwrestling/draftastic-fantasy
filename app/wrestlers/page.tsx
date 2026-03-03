import { supabase } from "@/lib/supabase";
import Link from "next/link";
import WrestlerList from "./WrestlerList";
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

export const metadata = {
  title: "Wrestlers — Draftastic Fantasy",
  description: "Wrestlers eligible for the draft. Roster rules: min 4 male, 4 female.",
};

/** Championship history table (Pro Wrestling Boxscore). One row per title reign. */
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

export default async function WrestlersPage() {
  const [wrestlersResult, { data: events }] = await Promise.all([
    (async () => {
      // Column is "Status" (capital S) in DB; avoid .or("status...") and select "Status" only
      const r = await supabase
        .from("wrestlers")
        .select('id, name, gender, brand, image_url, dob, "Status", "2K26 rating", "2K25 rating"')
        .order("name", { ascending: true });
      return r;
    })(),
    supabase
      .from("events")
      .select("id, name, date, matches")
      .eq("status", "completed")
      .gte("date", LEAGUE_START_DATE)
      .order("date", { ascending: true }),
  ]);

  const { data: rawReigns } = await supabase
    .from("championship_history")
    .select("champion_slug, champion_id, champion, champion_name, title, title_name, won_date, start_date, lost_date, end_date")
    .order("won_date", { ascending: true });
  const tableReigns = (rawReigns ?? []) as ChampionshipReign[];
  const inferredReigns = inferReignsFromEvents(events ?? []);
  const reigns = tableReigns.length > 0 ? tableReigns : inferredReigns;

  const pointsBySlug = aggregateWrestlerPoints(events ?? []);
  const endOfMonthBeltPoints = computeEndOfMonthBeltPoints(reigns, FIRST_END_OF_MONTH_POINTS_DATE);
  const currentChampionsBySlug = getCurrentChampionsBySlug(reigns);

  const wrestlers = wrestlersResult.data ?? [];
  const wrestlersFiltered = (wrestlers ?? []).filter((w) => !isPersonaOnlySlug(w.id));
  const rows = wrestlersFiltered.map((w) => {
    const points = pointsBySlug[w.id] ?? { rsPoints: 0, plePoints: 0, beltPoints: 0 };
    const slugKey = w.id;
    const nameKey = w.name ? normalizeWrestlerName(w.name) : "";
    const extraBelt =
      (typeof endOfMonthBeltPoints[slugKey] === "number" ? endOfMonthBeltPoints[slugKey] : null) ??
      (nameKey && typeof endOfMonthBeltPoints[nameKey] === "number" ? endOfMonthBeltPoints[nameKey] : null) ??
      0;
    const beltPoints = points.beltPoints + extraBelt;
    const totalPoints = points.rsPoints + points.plePoints + beltPoints;
    const titles =
      currentChampionsBySlug[slugKey] ?? (nameKey ? currentChampionsBySlug[nameKey] : null) ?? [];
    const raw = w as Record<string, unknown>;
    return {
      id: w.id,
      name: w.name ?? null,
      gender: w.gender ?? null,
      brand: w.brand ?? null,
      image_url: (w as { image_url?: string }).image_url ?? null,
      dob: (w as { dob?: string }).dob ?? null,
      rating_2k26: read2kRating(w as Record<string, unknown>, "2K26 rating"),
      rating_2k25: read2kRating(w as Record<string, unknown>, "2K25 rating"),
      rsPoints: points.rsPoints,
      plePoints: points.plePoints,
      beltPoints,
      totalPoints,
      personaDisplay: getPersonasForDisplay(w.id) ?? null,
      status: (raw.Status ?? raw.status) != null ? String(raw.Status ?? raw.status) : null,
      currentChampionship: titles.length > 0 ? titles.join(", ") : null,
    };
  });

  const error = wrestlersResult.error;
  return (
    <>
      <section
        style={{
          background: "#f0f7ff",
          border: "1px solid #b3d4ff",
          borderRadius: 8,
          padding: "12px 16px",
          marginTop: 24,
          marginBottom: 32,
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Roster rules (draft)</h2>
        <ul style={{ marginBottom: 0 }}>
          <li>Roster size: 8–15 wrestlers (draft 12 to start).</li>
          <li>Minimum <strong>4 male</strong> and <strong>4 female</strong> wrestlers.</li>
          <li>Contracts: 4× three-year, 4× two-year, 4× one-year (assigned by round at draft).</li>
        </ul>
      </section>

      {error && (
        <p style={{ color: "red" }}>
          Error loading wrestlers: {error.message}. Check .env (NEXT_PUBLIC_SUPABASE_*).
        </p>
      )}

      {rows.length === 0 && !error && (
        <p>No wrestlers in the database yet.</p>
      )}

      {rows.length > 0 && <WrestlerList wrestlers={rows} />}
    </>
  );
}
