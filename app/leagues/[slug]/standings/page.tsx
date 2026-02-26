import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeagueBySlug, getLeagueMembers } from "@/lib/leagues";
import { getPointsByOwnerForLeagueWithBonuses } from "@/lib/leagueMatchups";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) return { title: "Standings — Draftastic Fantasy" };
  return {
    title: `Standings — ${league.name} — Draftastic Fantasy`,
    description: "League standings",
  };
}

export default async function StandingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const [members, pointsByOwner] = await Promise.all([
    getLeagueMembers(league.id),
    getPointsByOwnerForLeagueWithBonuses(league.id),
  ]);
  const pointsByUserId = pointsByOwner ?? {};
  const membersByPoints = [...members].sort(
    (a, b) => (pointsByUserId[b.user_id] ?? 0) - (pointsByUserId[a.user_id] ?? 0)
  );

  return (
    <main className="app-page">
      <p style={{ marginBottom: 24 }}>
        <Link href={`/leagues/${slug}`} className="app-link">
          ← {league.name}
        </Link>
      </p>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 8, color: "var(--color-text)" }}>
        Standings
      </h1>
      <div className="lm-card" style={{ marginTop: 24 }}>
        <h2 className="lm-card-title">Teams</h2>
        <p className="lm-league-meta" style={{ marginBottom: 12 }}>
          Click a team to see that owner&apos;s roster and points.
        </p>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: "0 0 20px",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          {membersByPoints.map((m) => {
            const teamLabel =
              (m.team_name?.trim() || m.display_name?.trim() || "Unknown").trim() || "Unknown";
            const pts = pointsByUserId[m.user_id] ?? 0;
            return (
              <li
                key={m.id}
                style={{
                  padding: "10px 0",
                  borderBottom: "1px solid var(--color-border-light)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                }}
              >
                <Link
                  href={`/leagues/${slug}/team/${encodeURIComponent(m.user_id)}`}
                  style={{
                    color: "var(--color-blue)",
                    textDecoration: "none",
                    fontWeight: 500,
                  }}
                >
                  {teamLabel}
                </Link>
                <span style={{ fontWeight: 600, color: "var(--color-red)", flexShrink: 0 }}>
                  {pts} pts
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
