import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLeaguesForUser } from "@/lib/leagues";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <>
        <section className="home-hero">
          <div className="home-hero-inner">
            <img
              src="/draftastic_belt_logo.png"
              alt=""
              className="home-hero-logo"
            />
            <div className="home-hero-copy">
              <h1>Play the #1 Fantasy Pro Wrestling Game, 100% Free!</h1>
              <div className="home-hero-actions">
                <div className="home-hero-cta-block">
                  <Link href="/leagues/new" className="home-hero-btn home-hero-btn-primary">
                    Create a League
                  </Link>
                  <p className="home-hero-cta-desc">
                    You're the league manager here. Set up a private league to play with your family and friends!
                  </p>
                </div>
                <div className="home-hero-cta-block">
                  <Link href="/leagues/join" className="home-hero-btn home-hero-btn-secondary">
                    Join a League
                  </Link>
                  <p className="home-hero-cta-desc">
                    Hop into a league with an invite link and compete with other fans.
                  </p>
                </div>
              </div>
              <p className="home-hero-signin">
                Want some practice? <Link href="/how-it-works" style={{ color: "rgba(255,255,255,0.95)", textDecoration: "underline", fontWeight: 600 }}>Try a Mock Draft</Link>
                {" · "}
                Already have an account? <Link href="/auth/sign-in" style={{ color: "inherit", textDecoration: "underline", fontWeight: 600 }}>Sign in</Link>
              </p>
            </div>
          </div>
        </section>

        <section className="home-section" style={{ background: "var(--color-bg-page)" }}>
          <div className="home-panel">
            <h2>How it works</h2>
            <p style={{ margin: "0 0 12px", color: "var(--color-text-muted)", lineHeight: 1.6 }}>
              You're the league manager: set up a private league, invite friends, and run a draft for the season. 
              No long-term contracts — rosters are season-only (MVL style). Points come from real events (Raw, SmackDown, PLEs).
            </p>
            <p style={{ margin: 0 }}>
              <Link href="/how-it-works" className="app-link">Scoring rules, event types, and titles →</Link>
            </p>
          </div>
          <div className="home-panel">
            <h2>Quick links</h2>
            <ul className="home-quick-links">
              <li><Link href="/wrestlers">Wrestlers</Link> — draft-eligible pool and roster rules</li>
              <li><Link href="/score">Scored Events</Link> — fantasy scoring for completed events</li>
              <li><Link href="/mvl">MVL Example</Link> — roadmap and rules for private leagues</li>
              <li><Link href="/league/teams">Legacy League</Link> — original format with multi-year contracts</li>
            </ul>
          </div>
          <p style={{ marginTop: 24, color: "var(--color-text-dim)", fontSize: 14 }}>
            <Link href="https://www.prowrestlingboxscore.com" target="_blank" rel="noopener" className="app-link">
              Pro Wrestling Boxscore →
            </Link>
          </p>
        </section>
      </>
    );
  }

  // Logged-in: dashboard with My Leagues and quick links
  let leagues: Awaited<ReturnType<typeof getLeaguesForUser>> = [];
  let profileDisplayName: string | null = null;
  try {
    const [leaguesData, profileData] = await Promise.all([
      getLeaguesForUser(),
      supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    ]);
    leagues = leaguesData;
    profileDisplayName = (profileData.data as { display_name?: string } | null)?.display_name ?? null;
  } catch {
    // leave leagues empty
  }

  const displayName = profileDisplayName?.trim() || user.email?.split("@")[0] || "there";

  return (
    <main className="app-page" style={{ maxWidth: 900 }}>
      <p style={{ marginBottom: 8, color: "var(--color-text-muted)", fontSize: 15 }}>
        Welcome back{displayName !== "there" ? `, ${displayName}` : ""}.
      </p>

      <div className="home-panel" style={{ marginBottom: 24 }}>
        <h2>My Leagues</h2>
        {leagues.length === 0 ? (
          <p style={{ margin: "8px 0 16px", color: "var(--color-text-muted)" }}>
            You're not in any leagues yet. Create one or ask a friend for an invite link.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0" }}>
            {leagues.map((league) => (
              <li
                key={league.id}
                style={{
                  padding: "12px 0",
                  borderBottom: "1px solid var(--color-border)",
                }}
              >
                <Link
                  href={`/leagues/${league.slug}`}
                  className="app-link"
                  style={{ fontWeight: 600, fontSize: "1.05rem" }}
                >
                  {league.name}
                </Link>
                <span style={{ marginLeft: 8, fontSize: 14, color: "var(--color-text-dim)" }}>
                  {league.role === "commissioner" ? "(Commissioner)" : ""}
                </span>
                {(league.start_date || league.end_date) && (
                  <div style={{ fontSize: 14, color: "var(--color-text-muted)", marginTop: 4 }}>
                    {league.start_date && league.end_date
                      ? `${league.start_date} – ${league.end_date}`
                      : league.start_date || league.end_date}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <p style={{ marginTop: 16, marginBottom: 0 }}>
          <Link
            href="/leagues/new"
            style={{
              display: "inline-block",
              padding: "10px 20px",
              background: "var(--color-blue)",
              color: "var(--color-text-inverse)",
              textDecoration: "none",
              borderRadius: "var(--radius)",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Create a Private League
          </Link>
          <Link href="/leagues/join" className="app-link" style={{ marginLeft: 12 }}>
            Join with invite link
          </Link>
        </p>
      </div>

      <div className="home-panel">
        <h2>Quick links</h2>
        <ul className="home-quick-links">
          <li><Link href="/leagues">Private Leagues</Link> — manage and view all your leagues</li>
          <li><Link href="/how-it-works">How it works</Link> — scoring rules and event types</li>
          <li><Link href="/wrestlers">Wrestlers</Link> — draft pool and roster rules</li>
          <li><Link href="/score">Scored Events</Link> — fantasy scoring for completed events</li>
          <li><Link href="/account">Account</Link> — profile and settings</li>
        </ul>
      </div>
    </main>
  );
}
