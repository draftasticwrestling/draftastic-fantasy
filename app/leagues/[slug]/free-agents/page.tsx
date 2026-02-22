import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getLeagueBySlug, getRostersForLeague } from "@/lib/leagues";
import WrestlerList from "@/app/wrestlers/WrestlerList";
import type { WrestlerRow } from "@/app/wrestlers/WrestlerList";
import { aggregateWrestlerPoints } from "@/lib/scoring/aggregateWrestlerPoints.js";
import {
  computeEndOfMonthBeltPoints,
  FIRST_END_OF_MONTH_POINTS_DATE,
  inferReignsFromEvents,
} from "@/lib/scoring/endOfMonthBeltPoints.js";
import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";
import { isPersonaOnlySlug, getPersonasForDisplay } from "@/lib/scoring/personaResolution.js";

const LEAGUE_START_DATE = "2025-05-02";

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

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) return { title: "Wrestlers — Draftastic Fantasy" };
  return {
    title: `Wrestlers — ${league.name} — Draftastic Fantasy`,
    description: `Available wrestlers (free agents) in ${league.name}. Add them to your roster from your team page.`,
  };
}

export default async function LeagueFreeAgentsPage({ params }: Props) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const [
    { data: wrestlers, error: wrestlersError },
    { data: events },
    { data: rawReigns },
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
      .gte("date", LEAGUE_START_DATE)
      .order("date", { ascending: true }),
    supabase
      .from("championship_history")
      .select("champion_slug, champion_id, champion, champion_name, title, title_name, won_date, start_date, lost_date, end_date")
      .order("won_date", { ascending: true }),
    getRostersForLeague(league.id),
  ]);

  const tableReigns = (rawReigns ?? []) as ChampionshipReign[];
  const inferredReigns = inferReignsFromEvents(events ?? []);
  const reigns = tableReigns.length > 0 ? tableReigns : inferredReigns;
  const pointsBySlug = aggregateWrestlerPoints(events ?? []);
  const endOfMonthBeltPoints = computeEndOfMonthBeltPoints(reigns, FIRST_END_OF_MONTH_POINTS_DATE);

  const onRosterIds = new Set<string>();
  for (const entries of Object.values(rosters ?? {})) {
    for (const e of entries) {
      onRosterIds.add(String(e.wrestler_id).toLowerCase());
    }
  }

  const wrestlersFiltered = (wrestlers ?? []).filter(
    (w) => !isPersonaOnlySlug(w.id) && !onRosterIds.has(String(w.id).toLowerCase())
  );

  const rows: WrestlerRow[] = wrestlersFiltered.map((w) => {
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
    <>
      <p style={{ marginBottom: 16 }}>
        <Link href={`/leagues/${slug}`} className="app-link">← {league.name}</Link>
      </p>
      <h1 style={{ fontSize: "1.35rem", marginBottom: 8 }}>Available Wrestlers</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 24 }}>
        Wrestlers not on any team in this league. Add them from your team page (Roster) or during the draft.
      </p>

      {wrestlersError && (
        <p style={{ color: "var(--color-red)" }}>
          Error loading wrestlers: {wrestlersError.message}
        </p>
      )}

      {rows.length === 0 && !wrestlersError && (
        <p style={{ color: "var(--color-text-muted)" }}>
          No available wrestlers. Every wrestler in the pool is already on a team in this league.
        </p>
      )}

      {rows.length > 0 && <WrestlerList wrestlers={rows} />}
    </>
  );
}
