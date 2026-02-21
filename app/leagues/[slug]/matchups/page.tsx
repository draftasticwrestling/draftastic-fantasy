import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLeagueBySlug, getLeagueMembers } from "@/lib/leagues";
import { getLeagueWeeklyMatchups } from "@/lib/leagueMatchups";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  try {
    const { slug } = await params;
    const league = await getLeagueBySlug(slug);
    if (!league) return { title: "Matchups — Draftastic Fantasy" };
    return {
      title: `Matchups — ${league.name} — Draftastic Fantasy`,
      description: `Head-to-head weekly matchups and Draftastic Championship for ${league.name}`,
    };
  } catch {
    return { title: "Matchups — Draftastic Fantasy" };
  }
}

function formatWeekRange(weekStart: string, weekEnd: string): string {
  const fmt = (s: string) => {
    const d = new Date(s + "T12:00:00Z");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };
  return `${fmt(weekStart)} – ${fmt(weekEnd)}`;
}

export default async function LeagueMatchupsPage({ params }: Props) {
  const { slug } = await params;
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

  const memberByUserId = Object.fromEntries(members.map((m) => [m.user_id, m]));

  const teamLabel = (m: { team_name?: string | null; display_name?: string | null }) =>
    (m.team_name?.trim() || m.display_name?.trim() || "Unknown").trim() || "Unknown";

  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: 24,
        maxWidth: 720,
        margin: "0 auto",
        fontSize: 16,
        lineHeight: 1.5,
      }}
    >
      <p style={{ marginBottom: 24 }}>
        <Link href={`/leagues/${slug}`} style={{ color: "#1a73e8", textDecoration: "none" }}>
          ← {league.name}
        </Link>
      </p>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 8 }}>Matchups</h1>
      <p style={{ color: "#555", marginBottom: 24, fontSize: 14 }}>
        Each week (Monday–Sunday) all teams compete. The team with the most event points that week wins the matchup and gets <strong>+15 pts</strong>. 
        The winner also holds or wins the <strong>Draftastic Championship</strong> belt: <strong>+5 pts</strong> for winning the belt, <strong>+4 pts</strong> for retaining it.
      </p>

      {matchups.length === 0 ? (
        <p style={{ color: "#666" }}>No weeks in the league date range yet. Set draft date and end date for the league.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {matchups.map((m, idx) => {
            const winnerName = m.winnerUserId ? teamLabel(memberByUserId[m.winnerUserId] ?? {}) : null;
            const beltName = m.beltHolderUserId ? teamLabel(memberByUserId[m.beltHolderUserId] ?? {}) : null;
            return (
              <li
                key={m.weekStart}
                style={{
                  padding: "14px 0",
                  borderBottom: "1px solid #eee",
                }}
              >
                <Link
                  href={`/leagues/${slug}/matchups/${encodeURIComponent(m.weekStart)}`}
                  style={{ color: "#1a73e8", textDecoration: "none", fontWeight: 500 }}
                >
                  Week {idx + 1}: {formatWeekRange(m.weekStart, m.weekEnd)}
                </Link>
                <div style={{ fontSize: 14, color: "#555", marginTop: 4 }}>
                  {winnerName ? (
                    <>Winner: <strong>{winnerName}</strong> (+15) {beltName && <> · Belt: <strong>{beltName}</strong> {m.beltRetained ? "(+4 retain)" : "(+5 win)"}</>}</>
                  ) : (
                    <>No winner (no events or tie)</>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
