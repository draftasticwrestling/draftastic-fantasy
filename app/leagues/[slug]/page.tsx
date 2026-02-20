import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeagueBySlug, getLeagueMembers } from "@/lib/leagues";
import { InviteButton } from "../InviteButton";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) return { title: "League — Draftastic Fantasy" };
  return {
    title: `${league.name} — Draftastic Fantasy`,
    description: `League: ${league.name}`,
  };
}

export default async function LeagueDetailPage({ params }: Props) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const members = await getLeagueMembers(league.id);

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
        <Link href="/leagues" style={{ color: "#1a73e8", textDecoration: "none" }}>
          ← My leagues
        </Link>
      </p>
      <h1 style={{ marginBottom: 8, fontSize: "1.5rem" }}>{league.name}</h1>
      {(league.start_date || league.end_date) && (
        <p style={{ color: "#555", marginBottom: 24 }}>
          {league.start_date && league.end_date
            ? `${league.start_date} – ${league.end_date}`
            : league.start_date || league.end_date}
        </p>
      )}
      <p style={{ marginBottom: 24, fontSize: 14, color: "#666" }}>
        {league.role === "commissioner" ? "You are the commissioner." : "Member."}
      </p>

      {league.role === "commissioner" && (
        <div style={{ marginBottom: 24 }}>
          <InviteButton leagueId={league.id} leagueName={league.name} />
        </div>
      )}

      <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>Members</h2>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {members.map((m) => (
          <li
            key={m.id}
            style={{
              padding: "10px 0",
              borderBottom: "1px solid #eee",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontWeight: 500 }}>
              {m.display_name?.trim() || "Unknown"}
            </span>
            <span style={{ fontSize: 14, color: "#666" }}>
              {m.role === "commissioner" ? "(Commissioner)" : ""}
            </span>
          </li>
        ))}
      </ul>

      <p style={{ marginTop: 24, fontSize: 14, color: "#666" }}>
        Draft, rosters, and matchups for this league will show up here once we add them.
      </p>
    </main>
  );
}
