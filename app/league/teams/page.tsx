import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { LEAGUE_MEMBERS, EXAMPLE_LEAGUE } from "@/lib/league";
import { getRosterForMember } from "@/lib/rosters";
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

export const metadata = {
  title: `Teams — ${EXAMPLE_LEAGUE.name} — Draftastic Fantasy`,
  description: "League teams and standings.",
};

export default async function LeagueTeamsPage() {
  const [
    { data: events },
    { data: rawReigns },
    { data: wrestlers },
    ...rosters
  ] = await Promise.all([
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
    supabase.from("wrestlers").select("id, name"),
    ...LEAGUE_MEMBERS.map((m) => getRosterForMember(m.slug)),
  ]);

  const tableReigns = (rawReigns ?? []) as ChampionshipReign[];
  const inferredReigns = inferReignsFromEvents(events ?? []);
  const reigns = tableReigns.length > 0 ? tableReigns : inferredReigns;
  const pointsBySlug = aggregateWrestlerPoints(events ?? []);
  const endOfMonthBeltBySlug = computeEndOfMonthBeltPoints(reigns, FIRST_END_OF_MONTH_POINTS_DATE);

  const ownerTotals: Record<string, number> = {};
  LEAGUE_MEMBERS.forEach((member, idx) => {
    const roster = rosters[idx] ?? [];
    let total = 0;
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
      total += points.rsPoints + points.plePoints + beltPoints;
    }
    ownerTotals[member.slug] = total;
  });

  return (
    <>
      <h1 style={{ marginBottom: 8 }}>{EXAMPLE_LEAGUE.name}</h1>
      <p style={{ color: "#666", fontSize: 14, marginBottom: 8 }}>
        Legacy League — multi-year contracts, discovery picks, and full scoring. For the MVL season-only format, use <Link href="/leagues" style={{ color: "#1a73e8" }}>Public Leagues</Link>.
      </p>
      <p style={{ color: "#555", marginBottom: 32 }}>
        Owners and links to their rosters.
      </p>

      <section>
        <h2 style={{ fontSize: "1.25rem", marginBottom: 16 }}>Teams</h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {LEAGUE_MEMBERS.map((member) => (
            <li
              key={member.slug}
              style={{
                padding: "14px 0",
                borderBottom: "1px solid #eee",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <Link
                href={`/league/${member.slug}`}
                style={{ color: "#1a73e8", textDecoration: "none", fontWeight: 500 }}
              >
                {member.name}
              </Link>
              <span style={{ fontWeight: 600, color: "#c00", flexShrink: 0 }}>
                {ownerTotals[member.slug] ?? 0} pts
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
