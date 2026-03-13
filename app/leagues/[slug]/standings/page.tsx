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

      <section
        style={{
          marginTop: 12,
          borderRadius: 16,
          padding: 20,
          background: "linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 100%)",
          boxShadow: "0 18px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)",
          color: "#f9fafb",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <h2
            style={{
              fontSize: 16,
              textTransform: "uppercase",
              letterSpacing: 3,
              fontWeight: 700,
              color: "rgba(249,250,251,0.9)",
              margin: 0,
            }}
          >
            Teams
          </h2>
          <span
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: 2,
              color: "rgba(248,113,113,0.85)",
            }}
          >
            Total points
          </span>
        </header>

        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            borderTop: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          {membersByPoints.map((m, idx) => {
            const teamLabel =
              (m.team_name?.trim() || m.display_name?.trim() || "Unknown").trim() || "Unknown";
            const pts = pointsByUserId[m.user_id] ?? 0;
            const isLeader = idx === 0;
            return (
              <li
                key={m.id}
                style={{
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  background: isLeader ? "rgba(248,113,113,0.06)" : "transparent",
                }}
              >
                <Link
                  href={`/leagues/${slug}/team/${encodeURIComponent(m.user_id)}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    padding: "12px 4px",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    <span
                      style={{
                        minWidth: 26,
                        height: 26,
                        borderRadius: "999px",
                        border: "1px solid rgba(248,250,252,0.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        fontWeight: 700,
                        background: isLeader
                          ? "linear-gradient(145deg,#d4af37,#b8860b)"
                          : "linear-gradient(145deg,#4b5563,#111827)",
                        color: isLeader ? "#111827" : "#e5e7eb",
                      }}
                    >
                      {idx + 1}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 15,
                          textTransform: "uppercase",
                          letterSpacing: 0.6,
                          whiteSpace: "nowrap",
                          textOverflow: "ellipsis",
                          overflow: "hidden",
                        }}
                      >
                        {teamLabel}
                      </div>
                    </div>
                  </div>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 18,
                      color: "#f97373",
                      flexShrink: 0,
                    }}
                  >
                    {pts}
                    <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.8 }}>pts</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
