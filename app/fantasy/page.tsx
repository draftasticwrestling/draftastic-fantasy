import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { getLeaguesForUser } from "@/lib/leagues";
import { getHubHomeHref } from "@/lib/hubHomeHref";
import { siteLogoHref } from "@/lib/siteLogo";

const IMG = "https://qvbqxietcmweltxoonvh.supabase.co/storage/v1/object/public/draftastic-screenshots";

export const metadata = {
  title: "Fantasy — Draftastic",
  description: "Create a league, draft your roster, and play fantasy pro wrestling.",
};

export default async function FantasyHomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const hubHomeHref = await getHubHomeHref();

  if (!user) {
    return (
      <>
        {/* Hero — same ad copy as coming-soon, CTAs = Create / Join League */}
        <section className="home-hero">
          <div className="home-hero-inner">
            <img
              src={siteLogoHref()}
              alt=""
              className="home-hero-logo"
            />
            <div className="home-hero-copy">
              <h1>Draftastic Fantasy Pro Wrestling</h1>
              <p className="home-hero-tagline">Putting the sport back in sports entertainment.</p>
              <p className="home-hero-sub">
                Draft your roster. Track every match. Compete with friends and turn every episode of wrestling into a fantasy battle.
              </p>
              <div className="home-hero-actions">
                <div className="home-hero-cta-block">
                  <Link href="/leagues/new" className="home-hero-btn home-hero-btn-primary">
                    Create a League
                  </Link>
                  <p className="home-hero-cta-desc">
                    You&apos;re the league manager here. Set up a private league to play with your family and friends!
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
                <Link href="#how-it-works" style={{ color: "rgba(255,255,255,0.95)", textDecoration: "underline", fontWeight: 600 }}>See how it works</Link>
                {" · "}
                Already have an account? <Link href="/auth/sign-in" style={{ color: "inherit", textDecoration: "underline", fontWeight: 600 }}>Sign in</Link>
              </p>
              <p className="home-hero-signin" style={{ marginTop: 12 }}>
                <Link href={hubHomeHref} style={{ color: "rgba(255,255,255,0.85)", textDecoration: "underline", fontWeight: 500 }}>
                  ← Site home (results &amp; news)
                </Link>
              </p>
            </div>
          </div>
        </section>

        <section className="home-section" style={{ background: "var(--color-bg-page)" }}>
          <div className="home-landing-block" id="how-it-works">
            <h2 className="home-landing-title">Why Isn&apos;t Fantasy Pro Wrestling a Huge Thing?</h2>
            <p>
              Millions of fans tune in every week to watch professional wrestling. The drama. The rivalries. The moments that make you jump off the couch.
            </p>
            <p>So we had a question.</p>
            <p><strong>Why isn&apos;t Fantasy Pro Wrestling bigger?</strong></p>
            <p>
              Fantasy football makes every Sunday game matter. Fantasy baseball turns stats into strategy.
            </p>
            <p>With millions watching wrestling every week… shouldn&apos;t fantasy wrestling exist too?</p>
          </div>

          <div className="home-landing-block">
            <h2 className="home-landing-title">How Draftastic Was Born</h2>
            <p>
              Three longtime wrestling fans attended their first WWE event in over twenty years… and suddenly we were hooked all over again.
            </p>
            <p>The energy. The crowd. The storylines unfolding in the ring.</p>
            <p>But when we went looking for a fantasy league to make watching wrestling even more fun…</p>
            <p>We discovered something surprising.</p>
            <p>There weren&apos;t many good options.</p>
            <p>So we did what wrestling fans do best.</p>
            <p><strong>We built our own.</strong></p>
            <p>
              Draftastic started as a spreadsheet, a scoring system, and a group of friends who suddenly cared a lot about what happened on RAW, SmackDown, and every Premium Live Event. The more we refined the league, the more invested we became. Soon we weren&apos;t just watching wrestling again.
            </p>
            <p>We were studying it. Debating it. Drafting it. Trash-talking about it.</p>
            <p>Now we&apos;re bringing that experience to fans everywhere.</p>
            <p>
              Draft your roster.<br />
              Track every match.<br />
              Compete with your friends.
            </p>
            <p>Because wrestling isn&apos;t just entertainment.</p>
            <p><strong>It&apos;s competition.</strong></p>
            <p>And now you&apos;re part of the game.</p>
          </div>

          <div className="home-landing-block">
            <h2 className="home-landing-title">Turn Wrestling Into a Competition</h2>
            <p className="home-bullet-intro">With Draftastic you can:</p>
            <ul className="home-bullets">
              <li>Draft your own roster of superstars</li>
              <li>Earn points based on match results and performance</li>
              <li>Compete against friends in custom leagues</li>
              <li>Track scores across RAW, SmackDown, and every PLE</li>
              <li>Prove once and for all who the best wrestling mind is</li>
            </ul>
          </div>

          <div className="home-landing-block">
            <h2 className="home-landing-title">How It Works</h2>
            <h3 className="home-step-heading">Step 1 — Draft Your Roster</h3>
            <p>
              Build your dream roster from the current wrestling landscape. Every superstar you draft becomes part of your fantasy stable, earning points based on their performances each week.
            </p>
            <figure className="home-inline-screenshot">
              <div className="home-screenshot-wrap">
                <Image
                  src={`${IMG}/draftastic-roster.png`}
                  alt="Draftastic roster page"
                  fill
                  className="home-screenshot-img"
                  sizes="(max-width: 640px) 100vw, 600px"
                />
              </div>
              <figcaption className="home-screenshot-caption">Manage your roster and build the ultimate lineup.</figcaption>
            </figure>
            <p><strong>Step 2 — Watch the Action.</strong> Every match, victory, and performance earns fantasy points.</p>
            <p><strong>Step 3 — Compete for the Championship.</strong> Climb the leaderboard and claim bragging rights.</p>
          </div>

          <div className="home-landing-block">
            <h2 className="home-landing-title">Compete for the Championship</h2>
            <p>
              Every match matters. Wins, title changes, and standout performances all impact the leaderboard. Track your progress and see who&apos;s dominating the league.
            </p>
            <figure className="home-inline-screenshot">
              <div className="home-screenshot-wrap">
                <Image
                  src={`${IMG}/draftastic-standings.png`}
                  alt="Draftastic league standings"
                  fill
                  className="home-screenshot-img"
                  sizes="(max-width: 640px) 100vw, 600px"
                />
              </div>
              <figcaption className="home-screenshot-caption">Climb the standings and prove you&apos;re the best booker in the league.</figcaption>
            </figure>
          </div>

          <div className="home-landing-block">
            <h2 className="home-landing-title">Wrestling, But With Stats</h2>
            <p>
              Track the hottest performers across the wrestling landscape. League leaderboards highlight the superstars delivering the most fantasy points, giving you the data you need to make smarter roster moves.
            </p>
            <figure className="home-inline-screenshot">
              <div className="home-screenshot-wrap">
                <Image
                  src={`${IMG}/draftastic-leaderboard.png`}
                  alt="Draftastic league leaders table"
                  fill
                  className="home-screenshot-img"
                  sizes="(max-width: 640px) 100vw, 600px"
                />
              </div>
              <figcaption className="home-screenshot-caption">Track the top fantasy performers across the entire league.</figcaption>
            </figure>
          </div>

          <div className="home-landing-block">
            <h2 className="home-landing-title">Dive Into Superstar Performance</h2>
            <p>
              Each wrestler has a detailed profile showing their fantasy production, stats, and performance trends. Study the numbers and build a roster that dominates.
            </p>
            <figure className="home-inline-screenshot">
              <div className="home-screenshot-wrap">
                <Image
                  src={`${IMG}/draftastic-profile.png`}
                  alt="Draftastic wrestler profile"
                  fill
                  className="home-screenshot-img"
                  sizes="(max-width: 640px) 100vw, 600px"
                />
              </div>
              <figcaption className="home-screenshot-caption">Detailed profiles help you scout your next fantasy superstar.</figcaption>
            </figure>
          </div>

          <div className="home-landing-block home-final-cta">
            <h2 className="home-landing-title">Wrestling Was Never Meant to Be Passive.</h2>
            <p>
              It&apos;s drama. It&apos;s strategy. It&apos;s competition.
            </p>
            <p>
              Draftastic turns every episode of wrestling into a game where every match matters.
            </p>
            <div className="home-final-cta-buttons">
              <Link href="/leagues/new" className="home-cta-btn home-cta-btn-primary">
                Create a League
              </Link>
              <Link href="/leagues/join" className="home-cta-btn home-cta-btn-secondary">
                Join a League
              </Link>
            </div>
          </div>
        </section>

        <section className="home-section" style={{ background: "var(--color-bg-page)" }}>
          <div className="home-panel">
            <h2>How it works</h2>
            <p style={{ margin: "0 0 12px", color: "var(--color-text-muted)", lineHeight: 1.6 }}>
              You&apos;re the league manager: set up a private league, invite friends, and run a draft for the season. 
              No long-term contracts — rosters are season-only (MVL style). Points come from real events (Raw, SmackDown, PLEs).
            </p>
            <p style={{ margin: 0 }}>
              <Link href="/how-it-works" className="app-link">Scoring rules, event types, and titles →</Link>
            </p>
          </div>
          <div className="home-panel">
            <h2>Quick links</h2>
            <ul className="home-quick-links">
              <li><Link href={hubHomeHref}>Site home</Link> — event results and headlines</li>
              <li><Link href="/event-results">Event Results</Link> — fantasy scoring for completed events</li>
              <li><Link href="/how-it-works">How it works</Link> — scoring rules and event types</li>
              <li><Link href="/about-us">About Us</Link> · <Link href="/contact-us">Contact Us</Link></li>
              <li>
                Examples: <Link href="/league/teams">Legacy League</Link>, <Link href="/mvl">MVL Example</Link>
              </li>
            </ul>
          </div>
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
        <Link href={hubHomeHref} className="app-link" style={{ fontWeight: 500 }}>← Site home</Link>
      </p>
      <p style={{ marginBottom: 8, color: "var(--color-text-muted)", fontSize: 15 }}>
        Welcome back{displayName !== "there" ? `, ${displayName}` : ""}.
      </p>

      <div className="home-panel" style={{ marginBottom: 24 }}>
        <h2>My Leagues</h2>
        {leagues.length === 0 ? (
          <p style={{ margin: "8px 0 16px", color: "var(--color-text-muted)" }}>
            You&apos;re not in any leagues yet. Create one or ask a friend for a league code or invite link.
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
            Join a league
          </Link>
        </p>
      </div>

      <div className="home-panel">
        <h2>Quick links</h2>
        <ul className="home-quick-links">
          <li><Link href={hubHomeHref}>Site home</Link> — results and news</li>
          <li><Link href="/leagues">Private Leagues</Link> — manage and view all your leagues</li>
          <li><Link href="/how-it-works">How it works</Link> — scoring rules and event types</li>
          <li><Link href="/event-results">Event Results</Link> — fantasy scoring for completed events</li>
          <li><Link href="/account">Account</Link> — profile and settings</li>
        </ul>
      </div>
    </main>
  );
}
