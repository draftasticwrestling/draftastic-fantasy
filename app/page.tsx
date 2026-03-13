import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLeaguesForUser } from "@/lib/leagues";
import { EmailSignupForm } from "@/app/coming-soon/EmailSignupForm";

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
                Want to learn more? <Link href="/how-it-works" style={{ color: "rgba(255,255,255,0.95)", textDecoration: "underline", fontWeight: 600 }}>See how it works</Link>
                {" · "}
                Already have an account? <Link href="/auth/sign-in" style={{ color: "inherit", textDecoration: "underline", fontWeight: 600 }}>Sign in</Link>
              </p>
            </div>
          </div>
        </section>

        <section className="home-section home-story-section" style={{ background: "var(--color-bg-page)" }}>
          <div className="home-story">
            <h2 className="home-story-title">Draftastic Fantasy Pro Wrestling</h2>
            <p className="home-story-tagline">Putting the sport back in sports entertainment.</p>
            <p>
              Millions of fans tune in every week to watch the spectacle of professional wrestling. The drama. The rivalries. The moments that make you jump off the couch.
            </p>
            <p>So we had a question:</p>
            <p><strong>Why isn&apos;t Fantasy Pro Wrestling a huge thing?</strong></p>
            <p>Three longtime wrestling fans decided to find out.</p>
            <p>
              After attending our first WWE event in over twenty years, something clicked. The energy, the crowd, the stories unfolding in the ring… it all came rushing back. But when we went looking for a fantasy league to make watching wrestling even more fun, we discovered something surprising.
            </p>
            <p>There really weren&apos;t any great options.</p>
            <p>So we did what wrestling fans have always done when something doesn&apos;t exist yet.</p>
            <p><strong>We built it ourselves.</strong></p>
            <p>
              Draftastic started as a spreadsheet, a scoring system, and a group of friends who suddenly cared a lot about what happened on RAW, SmackDown, and every Premium Live Event. The more we refined the league, the more invested we became. Soon we weren&apos;t just watching wrestling again.
            </p>
            <p>We were studying it. Debating it. Drafting it. Trash-talking about it.</p>
            <p>Now we&apos;re bringing that experience to fans everywhere.</p>
            <p className="home-story-cta-lines">
              Draft your roster.<br />
              Track every match.<br />
              Compete with your friends.
            </p>
            <p>Because wrestling isn&apos;t just entertainment.</p>
            <p><strong>It&apos;s competition.</strong></p>
            <p className="home-story-close">And now you&apos;re part of the game.</p>
          </div>
          <div className="home-panel home-email-cta">
            <h2>Get updates</h2>
            <p style={{ margin: "0 0 16px", color: "var(--color-text-muted)", lineHeight: 1.5 }}>
              Join our email list for launch news, tips, and league updates.
            </p>
            <EmailSignupForm />
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
              <li><Link href="/event-results">Event Results</Link> — fantasy scoring for completed events</li>
              <li><Link href="/how-it-works">How it works</Link> — scoring rules and event types</li>
              <li><Link href="/about-us">About Us</Link> · <Link href="/contact-us">Contact Us</Link></li>
              <li>Admin menu: <Link href="/league/teams">Legacy League</Link>, <Link href="/mvl">MVL Example</Link>, <Link href="/admin/draft-testing">Draft Testing</Link>, <Link href="/admin/wrestlers">Wrestlers</Link></li>
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
                  {league.role === "commissioner" ? "(GM)" : ""}
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
          <li><Link href="/event-results">Event Results</Link> — fantasy scoring for completed events</li>
          <li><Link href="/account">Account</Link> — profile and settings</li>
        </ul>
      </div>
    </main>
  );
}
