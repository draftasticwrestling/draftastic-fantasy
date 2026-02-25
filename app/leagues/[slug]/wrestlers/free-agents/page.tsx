import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLeagueBySlug, getRostersForLeague } from "@/lib/leagues";
import WrestlerList from "@/app/wrestlers/WrestlerList";
import { aggregateWrestlerPoints } from "@/lib/scoring/aggregateWrestlerPoints.js";
import {
  computeEndOfMonthBeltPoints,
  inferReignsFromEvents,
} from "@/lib/scoring/endOfMonthBeltPoints.js";
import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";
import { isPersonaOnlySlug, getPersonasForDisplay } from "@/lib/scoring/personaResolution.js";

function firstMonthEndOnOrAfter(startDate: string): string {
  const d = new Date(startDate + "T12:00:00");
  const year = d.getFullYear();
  const month = d.getMonth();
  const lastDay = new Date(year, month + 1, 0);
  return lastDay.toISOString().slice(0, 10);
}

function getEffectiveLeagueStartDate(league: { start_date: string | null; created_at?: string }): string {
  if (league.start_date) return league.start_date;
  if (league.created_at) return league.created_at.slice(0, 10);
  return "2025-05-02";
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  const title = league
    ? `Free Agents — ${league.name} — Draftastic Fantasy`
    : "Free Agents — Draftastic Fantasy";
  return { title };
}

export default async function WrestlersFreeAgentsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const league = await getLeagueBySlug(slug);
  if (!league) {
    redirect("/leagues");
  }

  const startDate = getEffectiveLeagueStartDate(league);

  const [
    { data: wrestlers, error },
    { data: eventsSinceStart },
    { data: events2025 },
    { data: events2026 },
    rosters,
  ] = await Promise.all([
    supabase
      .from("wrestlers")
      .select("id, name, gender, brand, image_url, dob")
      .order("name", { ascending: true }),
    supabase
      .from("events")
      .select("id, name, date, matches")
      .eq("status", "completed")
      .gte("date", startDate)
      .order("date", { ascending: true }),
    supabase
      .from("events")
      .select("id, name, date, matches")
      .eq("status", "completed")
      .gte("date", "2025-01-01")
      .lte("date", "2025-12-31")
      .order("date", { ascending: true }),
    supabase
      .from("events")
      .select("id, name, date, matches")
      .eq("status", "completed")
      .gte("date", "2026-01-01")
      .lte("date", "2026-12-31")
      .order("date", { ascending: true }),
    getRostersForLeague(league.id),
  ]);

  const onRosterIds = new Set<string>();
  for (const entries of Object.values(rosters ?? {})) {
    for (const e of entries) {
      onRosterIds.add(String(e.wrestler_id).toLowerCase());
    }
  }

  const { data: rawReigns } = await supabase
    .from("championship_history")
    .select("champion_slug, champion_id, champion, champion_name, title, title_name, won_date, start_date, lost_date, end_date")
    .order("won_date", { ascending: true });
  const tableReigns = (rawReigns ?? []) as ChampionshipReign[];
  const inferredReigns = inferReignsFromEvents(eventsSinceStart ?? []);
  const reigns = tableReigns.length > 0 ? tableReigns : inferredReigns;

  const pointsBySlug = aggregateWrestlerPoints(eventsSinceStart ?? []);
  const points2025BySlug = aggregateWrestlerPoints(events2025 ?? []);
  const points2026BySlug = aggregateWrestlerPoints(events2026 ?? []);
  const firstEligibleMonthEnd = firstMonthEndOnOrAfter(startDate);
  const endOfMonthBeltPoints = computeEndOfMonthBeltPoints(reigns, firstEligibleMonthEnd);

  const wrestlersFiltered = (wrestlers ?? []).filter(
    (w) => !isPersonaOnlySlug(w.id) && !onRosterIds.has(String(w.id).toLowerCase())
  );
  const rows = wrestlersFiltered.map((w) => {
    const points = pointsBySlug[w.id] ?? { rsPoints: 0, plePoints: 0, beltPoints: 0 };
    const points2025 = points2025BySlug[w.id] ?? { rsPoints: 0, plePoints: 0, beltPoints: 0 };
    const points2026 = points2026BySlug[w.id] ?? { rsPoints: 0, plePoints: 0, beltPoints: 0 };
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
      rsPoints2025: points2025.rsPoints,
      plePoints2025: points2025.plePoints,
      beltPoints2025: points2025.beltPoints,
      totalPoints2025: points2025.rsPoints + points2025.plePoints + points2025.beltPoints,
      rsPoints2026: points2026.rsPoints,
      plePoints2026: points2026.plePoints,
      beltPoints2026: points2026.beltPoints,
      totalPoints2026: points2026.rsPoints + points2026.plePoints + points2026.beltPoints,
      personaDisplay: getPersonasForDisplay(w.id) ?? null,
    };
  });

  return (
    <main className="app-page" style={{ maxWidth: 1200, margin: "0 auto" }}>
      <p style={{ marginBottom: 16 }}>
        <Link href={`/leagues/${slug}`} className="app-link" style={{ fontWeight: 600 }}>
          ← {league.name}
        </Link>
      </p>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 8 }}>Free Agents</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 24 }}>
        Wrestlers not on any team in this league. Same table and filters as League Leaders; add them from your team page (Roster) or during the draft.
      </p>

      {error && (
        <p style={{ color: "var(--color-red)", marginBottom: 16 }}>
          Error loading wrestlers: {error.message}
        </p>
      )}

      {rows.length === 0 && !error && (
        <p style={{ color: "var(--color-text-muted)" }}>
          No free agents. Every wrestler in the pool is already on a team in this league.
        </p>
      )}

      {rows.length > 0 && (
        <WrestlerList
          wrestlers={rows}
          defaultSortColumn="totalPoints"
          defaultSortDir="desc"
        />
      )}
    </main>
  );
}
