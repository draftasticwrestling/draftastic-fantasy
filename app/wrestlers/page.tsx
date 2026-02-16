import { supabase } from "@/lib/supabase";
import Link from "next/link";
import WrestlerList from "./WrestlerList";
import { aggregateWrestlerPoints } from "@/lib/scoring/aggregateWrestlerPoints.js";
import {
  computeEndOfMonthBeltPoints,
  FIRST_END_OF_MONTH_POINTS_DATE,
  inferReignsFromEvents,
} from "@/lib/scoring/endOfMonthBeltPoints.js";
import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";
import { isPersonaOnlySlug, getPersonasForDisplay } from "@/lib/scoring/personaResolution.js";

const LEAGUE_START_DATE = "2025-05-02";

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
  const [{ data: wrestlers, error }, { data: events }] = await Promise.all([
    supabase
      .from("wrestlers")
      .select("id, name, gender, brand, image_url, dob")
      .order("name", { ascending: true }),
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
    return {
      id: w.id,
      name: w.name ?? null,
      gender: w.gender ?? null,
      brand: w.brand ?? null,
      image_url: (w as { image_url?: string }).image_url ?? null,
      dob: (w as { dob?: string }).dob ?? null,
      rsPoints: points.rsPoints,
      plePoints: points.plePoints,
      beltPoints,
      totalPoints,
      personaDisplay: getPersonasForDisplay(w.id) ?? null,
    };
  });

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 1200, marginLeft: 0, marginRight: "auto" }}>
      <p style={{ marginBottom: 24 }}>
        <Link href="/">← Home</Link>
      </p>

      <h1>Wrestlers</h1>
      <p>Wrestlers from Pro Wrestling Boxscore eligible for your league draft.</p>

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
    </main>
  );
}
