import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import { getLeaguesForUser } from "@/lib/leagues";

export const metadata = {
  title: "Leagues — Draftastic Fantasy",
  description: "Create private or public leagues, then draft for the season",
};

export default async function LeaguesPage() {
  const { user } = await getServerAuth();
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
      <h1 style={{ marginBottom: 8, fontSize: "1.5rem" }}>Leagues</h1>
      <p style={{ color: "#555", marginBottom: 24 }}>
        Create private leagues for friends or public leagues for your group. New managers join with a code or invite link.
      </p>

      <div
        style={{
          marginBottom: 16,
          padding: 12,
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          background: "#f8fafc",
          color: "#374151",
          fontSize: 14,
        }}
      >
        Public leagues use Salary Cap — Total Season Points with open enrollment. Your season starts the Monday after
        3 factions join and runs for 12 weeks. Private leagues still use Road to season windows.
      </div>

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
          Create a League
        </Link>
        <Link
          href="/leagues/join"
          style={{
            display: "inline-block",
            marginLeft: 10,
            padding: "10px 20px",
            background: "#111827",
            color: "#fff",
            textDecoration: "none",
            borderRadius: 8,
            fontWeight: 600,
          }}
        >
          Join a league
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
            Create one above or ask a friend for a league code or invite link.
          </p>
          <p style={{ margin: "16px 0 0" }}>
            <Link href="/leagues/join" style={{ color: "#1a73e8", fontWeight: 600 }}>
              Join a league
            </Link>
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
                {league.role === "commissioner" ? "(GM)" : ""}
              </span>
              <span style={{ marginLeft: 8, fontSize: 12, color: "#6b7280" }}>
                [{(league.visibility_type ?? "private") === "public" ? "Public" : "Private"}]
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
