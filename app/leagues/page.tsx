import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLeaguesForUser } from "@/lib/leagues";

export const metadata = {
  title: "Private Leagues — Draftastic Fantasy",
  description: "MVL Private Leagues — create or join leagues, draft for the season only",
};

export default async function LeaguesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/sign-in?next=/leagues");
  }

  const leagues = await getLeaguesForUser();

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
        <Link href="/" style={{ color: "#1a73e8", textDecoration: "none" }}>
          ← Home
        </Link>
      </p>
      <h1 style={{ marginBottom: 8, fontSize: "1.5rem" }}>Private Leagues</h1>
      <p style={{ color: "#555", marginBottom: 24 }}>
        MVL leagues: create a league, invite friends, and draft for the defined season only (no long-term contracts).
      </p>

      <p style={{ marginBottom: 16 }}>
        <Link
          href="/leagues/new"
          style={{
            display: "inline-block",
            padding: "10px 20px",
            background: "#1a73e8",
            color: "#fff",
            textDecoration: "none",
            borderRadius: 8,
            fontWeight: 600,
          }}
        >
          Create a Private League
        </Link>
      </p>

      {leagues.length === 0 ? (
        <div
          style={{
            padding: 32,
            background: "#f8f8f8",
            borderRadius: 8,
            color: "#555",
            textAlign: "center",
          }}
        >
          <p style={{ margin: 0 }}>You’re not in any leagues yet.</p>
          <p style={{ margin: "8px 0 0" }}>
            Create one above or ask a friend for an invite link.
          </p>
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {leagues.map((league) => (
            <li
              key={league.id}
              style={{
                padding: "14px 0",
                borderBottom: "1px solid #eee",
              }}
            >
              <Link
                href={`/leagues/${league.slug}`}
                style={{
                  color: "#1a73e8",
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: "1.05rem",
                }}
              >
                {league.name}
              </Link>
              <span style={{ marginLeft: 8, fontSize: 14, color: "#666" }}>
                {league.role === "commissioner" ? "(Commissioner)" : ""}
              </span>
              {(league.start_date || league.end_date) && (
                <div style={{ fontSize: 14, color: "#666", marginTop: 4 }}>
                  {league.start_date && league.end_date
                    ? `${league.start_date} – ${league.end_date}`
                    : league.start_date || league.end_date}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
