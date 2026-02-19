import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getMemberBySlug, getAllSlugs, EXAMPLE_LEAGUE } from "@/lib/league";
import { getRosterForMember } from "@/lib/rosters";
import { getDraftPicksForOwner, getPickLabel, DEFAULT_SEASON } from "@/lib/draftPicks";
import { getHoldingsForOwner } from "@/lib/discoveryHoldings";
import RosterDisplay from "./RosterDisplay";
import DiscoverySection from "./DiscoverySection";
import { aggregateWrestlerPoints } from "@/lib/scoring/aggregateWrestlerPoints.js";
import {
  computeEndOfMonthBeltPoints,
  FIRST_END_OF_MONTH_POINTS_DATE,
  inferReignsFromEvents,
} from "@/lib/scoring/endOfMonthBeltPoints.js";
import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";

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

function nameKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const member = getMemberBySlug(slug);
  if (!member) return { title: "Team — Draftastic Fantasy" };
  return {
    title: `${member.name} — ${EXAMPLE_LEAGUE.name} — Draftastic Fantasy`,
    description: `Team page for ${member.name}.`,
  };
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const member = getMemberBySlug(slug);
  if (!member) notFound();

  const [
    roster,
    { data: wrestlers },
    { data: events },
    { data: rawReigns },
    draftPicks,
    discoveryHoldings,
  ] = await Promise.all([
    getRosterForMember(slug),
    supabase.from("wrestlers").select("id, name, brand, image_url, dob"),
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
    getDraftPicksForOwner(EXAMPLE_LEAGUE.slug, DEFAULT_SEASON, slug),
    getHoldingsForOwner(EXAMPLE_LEAGUE.slug, slug),
  ]);

  const tableReigns = (rawReigns ?? []) as ChampionshipReign[];
  const inferredReigns = inferReignsFromEvents(events ?? []);
  const reigns = tableReigns.length > 0 ? tableReigns : inferredReigns;
  const pointsBySlug = aggregateWrestlerPoints(events ?? []);
  const endOfMonthBeltBySlug = computeEndOfMonthBeltPoints(reigns, FIRST_END_OF_MONTH_POINTS_DATE);

  const wrestlerMap: Record<string, { brand: string | null; image_url: string | null; dob: string | null }> = {};
  if (wrestlers) {
    for (const w of wrestlers) {
      const name = (w.name ?? w.id) as string;
      const info = {
        brand: (w.brand as string) ?? null,
        image_url: (w as { image_url?: string }).image_url ?? null,
        dob: (w as { dob?: string }).dob ?? null,
      };
      wrestlerMap[nameKey(name)] = info;
      wrestlerMap[(w.id as string).toLowerCase()] = info;
    }
  }

  const rosterForDisplay: {
    name: string;
    contract?: string;
    slug: string;
    rsPoints: number;
    plePoints: number;
    beltPoints: number;
    totalPoints: number;
  }[] = [];
  let ownerTotal = 0;
  for (const e of roster) {
    const byId = wrestlers?.find((w) => (w.id as string).toLowerCase() === e.name.toLowerCase());
    const wrestlerSlug = byId ? (byId.id as string) : e.name;
    const points = pointsBySlug[wrestlerSlug] ?? pointsBySlug[normalizeWrestlerName(wrestlerSlug)] ?? { rsPoints: 0, plePoints: 0, beltPoints: 0 };
    const nameKeyNorm = byId?.name ? normalizeWrestlerName(byId.name) : "";
    const extraBelt =
      (typeof endOfMonthBeltBySlug[wrestlerSlug] === "number" ? endOfMonthBeltBySlug[wrestlerSlug] : null) ??
      (nameKeyNorm && typeof endOfMonthBeltBySlug[nameKeyNorm] === "number" ? endOfMonthBeltBySlug[nameKeyNorm] : null) ??
      0;
    const beltPoints = points.beltPoints + extraBelt;
    const totalPoints = points.rsPoints + points.plePoints + beltPoints;
    ownerTotal += totalPoints;
    rosterForDisplay.push({
      name: byId ? (byId.name as string) : e.name,
      contract: e.contract,
      slug: wrestlerSlug,
      rsPoints: points.rsPoints,
      plePoints: points.plePoints,
      beltPoints,
      totalPoints,
    });
  }

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 960, marginLeft: 0, marginRight: "auto", fontSize: 18, lineHeight: 1.6 }}>
      <p style={{ marginBottom: 20 }}>
        <Link href="/league/teams" style={{ color: "#1a73e8", textDecoration: "none" }}>
          ← {EXAMPLE_LEAGUE.name}
        </Link>
      </p>

      <h1 style={{ marginBottom: 4, fontSize: "1.75rem", fontWeight: 700, color: "#111" }}>
        {member.name}
      </h1>
      <p style={{ color: "#666", marginBottom: 28, fontSize: 15 }}>
        Roster is set on the league page. Images and age from Pro Wrestling Boxscore when names match.
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2
          style={{
            fontSize: "1.1rem",
            fontWeight: 700,
            marginBottom: 16,
            color: "#333",
          }}
        >
          Roster
        </h2>
        {roster.length === 0 ? (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e0e0e0",
              borderRadius: 8,
              padding: 24,
              color: "#444",
              fontSize: 15,
              lineHeight: 1.6,
            }}
          >
            <p style={{ margin: "0 0 12px 0" }}>
              No wrestlers on this roster yet.
            </p>
            <p style={{ margin: 0, fontSize: 15, color: "#555" }}>
              Go to the <Link href="/league/draft" style={{ color: "#1a73e8" }}>Draft</Link> page to assign wrestlers to this owner with contract lengths.
            </p>
          </div>
        ) : (
          <RosterDisplay
            roster={rosterForDisplay}
            wrestlerMap={wrestlerMap}
            ownerTotal={ownerTotal}
            discoveryHoldings={discoveryHoldings}
          />
        )}
      </section>

      <DiscoverySection
        ownerSlug={slug}
        ownerName={member.name}
        holdings={discoveryHoldings}
        unusedDiscoveryPicks={draftPicks.filter((p) => p.pick_type === "discovery" && !p.used_at)}
      />

      <section style={{ marginBottom: 32 }}>
        <h2
          style={{
            fontSize: "1.1rem",
            fontWeight: 700,
            marginBottom: 16,
            color: "#333",
          }}
        >
          Season {DEFAULT_SEASON} draft picks
        </h2>
        <div
          style={{
            background: "#fff",
            border: "1px solid #e0e0e0",
            borderRadius: 8,
            padding: 24,
            color: "#444",
            fontSize: 15,
            lineHeight: 1.6,
          }}
        >
          {draftPicks.length === 0 ? (
            <p style={{ margin: 0 }}>
              No draft picks on record for this owner. Run the script in <code style={{ fontSize: 14 }}>supabase/draft_picks.sql</code> in your Supabase SQL editor to create the table and seed Season 3 picks.
            </p>
          ) : (
            <>
              <p style={{ margin: "0 0 12px 0" }}>
                Picks you currently hold (tradeable):
              </p>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {draftPicks.map((p) => (
                  <li key={p.id}>
                    {getPickLabel(p)}
                    {p.pick_type === "discovery" && p.used_at && (
                      <span style={{ color: "#666", fontSize: 14 }}> (used)</span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      <section>
        <h2
          style={{
            fontSize: "1.1rem",
            fontWeight: 700,
            marginBottom: 16,
            color: "#333",
          }}
        >
          Points
        </h2>
        <div
          style={{
            background: "#fff",
            border: "1px solid #e0e0e0",
            borderRadius: 8,
            padding: 24,
            color: "#666",
            fontSize: 15,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          Season and per-event points will appear here once scoring is run for completed events.
        </div>
      </section>
    </main>
  );
}
