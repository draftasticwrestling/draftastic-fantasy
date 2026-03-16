import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeagueBySlug, getLeagueMembers } from "@/lib/leagues";
import { getPointsByOwnerForLeagueWithBonuses } from "@/lib/leagueMatchups";
import { LeagueStandingsTable } from "../LeagueStandingsTable";

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
      <h1
        style={{
          fontSize: "1.8rem",
          marginBottom: 4,
          color: "#f9fafb",
          letterSpacing: 0.4,
        }}
      >
        Standings
      </h1>
      <p style={{ marginBottom: 20, color: "rgba(249,250,251,0.7)", fontSize: 14 }}>
        Click a team to view their full roster card grid and detailed points.
      </p>
      <div style={{ marginTop: 12 }}>
        <LeagueStandingsTable
          members={membersByPoints}
          pointsByUserId={pointsByUserId}
          leagueSlug={slug}
        />
      </div>
    </main>
  );
}
