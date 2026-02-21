import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLeagueBySlug, getLeagueMembers } from "@/lib/leagues";
import { getLeagueWeeklyMatchups, getSundayOfWeek } from "@/lib/leagueMatchups";

type Props = { params: Promise<{ slug: string; weekStart: string }> };

export const dynamic = "force-dynamic";

function formatWeekRange(weekStart: string, weekEnd: string): string {
  const fmt = (s: string) => {
    const d = new Date(s + "T12:00:00Z");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };
  return `${fmt(weekStart)} – ${fmt(weekEnd)}`;
}

export default async function LeagueMatchupDetailPage({ params }: Props) {
  const { slug, weekStart: weekStartParam } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [members, matchups] = await Promise.all([
    getLeagueMembers(league.id),
    getLeagueWeeklyMatchups(league.id),
  ]);
  const isMember = user && members.some((m) => m.user_id === user.id);
  if (!isMember) notFound();

  const weekStart = decodeURIComponent(weekStartParam);
  const matchup = matchups.find((m) => m.weekStart === weekStart);
  if (!matchup) notFound();

  const weekEnd = getSundayOfWeek(weekStart);
  const memberByUserId = Object.fromEntries(members.map((m) => [m.user_id, m]));
  const teamLabel = (m: { team_name?: string | null; display_name?: string | null }) =>
    (m.team_name?.trim() || m.display_name?.trim() || "Unknown").trim() || "Unknown";

  const sorted = [...members].sort(
    (a, b) => (matchup.pointsByUserId[b.user_id] ?? 0) - (matchup.pointsByUserId[a.user_id] ?? 0)
  );

  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: 24,
        maxWidth: 640,
        margin: "0 auto",
        fontSize: 16,
        lineHeight: 1.5,
      }}
    >
      <p style={{ marginBottom: 24 }}>
        <Link href={`/leagues/${slug}/matchups`} style={{ color: "#1a73e8", textDecoration: "none" }}>
          ← Matchups
        </Link>
        {" · "}
        <Link href={`/leagues/${slug}`} style={{ color: "#1a73e8", textDecoration: "none" }}>
          {league.name}
        </Link>
      </p>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 8 }}>
        {formatWeekRange(weekStart, weekEnd)}
      </h1>
      <p style={{ color: "#555", marginBottom: 24, fontSize: 14 }}>
        Event points this week only. Winner gets +15; belt holder gets +5 (win) or +4 (retain).
      </p>

      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {sorted.map((m) => {
          const pts = matchup.pointsByUserId[m.user_id] ?? 0;
          const isWinner = matchup.winnerUserId === m.user_id;
          const isBeltHolder = matchup.beltHolderUserId === m.user_id;
          return (
            <li
              key={m.user_id}
              style={{
                padding: "12px 0",
                borderBottom: "1px solid #eee",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <span style={{ fontWeight: isWinner ? 600 : 400 }}>
                {teamLabel(m)}
                {isWinner && <span style={{ color: "#0d7d0d", marginLeft: 6 }}>— Winner (+15)</span>}
                {isBeltHolder && !isWinner && <span style={{ color: "#1a73e8", marginLeft: 6 }}>— Belt holder</span>}
                {isBeltHolder && <span style={{ color: "#666", marginLeft: 4 }}>{matchup.beltRetained ? "(+4 retain)" : "(+5 win)"}</span>}
              </span>
              <span style={{ fontWeight: 600, color: "#c00", flexShrink: 0 }}>
                {pts} pts
              </span>
            </li>
          );
        })}
      </ul>

      {!matchup.winnerUserId && (
        <p style={{ marginTop: 16, color: "#666", fontSize: 14 }}>
          No winner this week (no events in range or tie).
        </p>
      )}
    </main>
  );
}
