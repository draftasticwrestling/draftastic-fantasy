import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { AdsenseDisplayAd } from "@/app/components/AdsenseDisplayAd";
import { FantasyOnboardingDashboard } from "@/app/components/FantasyOnboardingDashboard";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import { getHubHomeHref } from "@/lib/hubHomeHref";
import { getOnboardingProgress } from "@/lib/onboardingProgress";
import { getSiteActivityPulse } from "@/lib/siteActivityPulse";
import { getUserCareerStats } from "@/lib/userCareerStats";
import { PLAY_PATH } from "@/lib/playFunnel";
import { getAdsenseSlotFantasy } from "@/lib/adsenseConfig";
import { siteLogoHref } from "@/lib/siteLogo";

const IMG = "https://qvbqxietcmweltxoonvh.supabase.co/storage/v1/object/public/draftastic-screenshots";

type DashboardLeague = {
  id: string;
  name: string;
  slug: string;
  role: string;
  start_date?: string | null;
  end_date?: string | null;
  past?: boolean;
};

type MemberLeagueRow = {
  league_id: string;
  role?: string | null;
  onboarding_completed_at?: string | null;
  placement_status?: string | null;
  leagues?: {
    slug?: string | null;
    name?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    league_type?: string | null;
    visibility_type?: string | null;
    season_slug?: string | null;
    draft_status?: string | null;
    is_archived?: boolean | null;
  } | null;
};

export const metadata = {
  title: "Fantasy — Draftastic",
  description: "Create a league, draft your roster, and play fantasy pro wrestling.",
};

export default async function FantasyHomePage() {
  const { supabase, user } = await getServerAuth();
  const hubHomeHref = await getHubHomeHref();
  const adsSlotFantasy = getAdsenseSlotFantasy();

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
                  <Link href={PLAY_PATH} className="home-hero-btn home-hero-btn-primary">
                    Play Now
                  </Link>
                  <p className="home-hero-cta-desc">
                    Sign in or create an account, then join a public league or create your own.
                  </p>
                </div>
              </div>
              <p className="home-hero-signin">
                <Link href="#how-it-works" style={{ color: "rgba(255,255,255,0.95)", textDecoration: "underline", fontWeight: 600 }}>See how it works</Link>
                {" · "}
                <Link href="/mock-draft" style={{ color: "rgba(255,255,255,0.95)", textDecoration: "underline", fontWeight: 600 }}>Practice a mock draft</Link>
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
              <Link href={PLAY_PATH} className="home-cta-btn home-cta-btn-primary">
                Play Now
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
              <li><Link href="/mock-draft">Mock draft</Link> — practice a snake draft before you start a league</li>
              <li><Link href="/about-us">About Us</Link> · <Link href="/contact-us">Contact Us</Link></li>
              <li>
                Examples: <Link href="/league/teams">Legacy League</Link>, <Link href="/mvl">MVL Example</Link>
              </li>
            </ul>
          </div>
        </section>

        <AdsenseDisplayAd slot={adsSlotFantasy} />
      </>
    );
  }

  // Logged-in: onboarding dashboard with career stats, checklist, and live activity
  let dashboardLeagues: DashboardLeague[] = [];
  let profileDisplayName: string | null = null;
  let career = {
    championships: 0,
    leaguesJoined: 0,
    pointsScored: 0,
    tradesCompleted: 0,
    freeAgentsSigned: 0,
  };
  let pulse = {
    weeklyPointsScored: 0,
    activeLeagues: 0,
    seasonMatchesScored: 0,
    seasonFreeAgentsSigned: 0,
    draftasticChampions: 0,
  };
  let onboarding = {
    steps: [],
    completedCount: 0,
    allComplete: false,
    primaryCtaHref: PLAY_PATH,
    primaryCtaLabel: "Join your first league",
    showEmptyCareerHero: true,
    chooseLeagueHref: PLAY_PATH,
    chooseLeagueLabel: "Join your first league",
  } as Awaited<ReturnType<typeof getOnboardingProgress>>;
  let neverJoined = false;

  try {
    const [profileData, pulseData, memberRowsRes, rosterRowsRes] = await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
      getSiteActivityPulse(),
      supabase
        .from("league_members")
        .select(
          "league_id, role, onboarding_completed_at, placement_status, leagues(slug, name, start_date, end_date, league_type, visibility_type, season_slug, draft_status, is_archived)"
        )
        .eq("user_id", user.id),
      supabase
        .from("league_rosters")
        .select("league_id")
        .eq("user_id", user.id)
        .is("released_at", null),
    ]);
    profileDisplayName = (profileData.data as { display_name?: string } | null)?.display_name ?? null;
    pulse = pulseData;
    const memberRows = (memberRowsRes.data ?? []) as MemberLeagueRow[];
    neverJoined = !memberRowsRes.error && memberRows.length === 0;
    if (!neverJoined) {
      dashboardLeagues = memberRows.flatMap((row) => {
        const league = row.leagues;
        const slug = league?.slug?.trim();
        if (!slug) return [];
        return [{
          id: row.league_id,
          name: league?.name?.trim() || slug,
          slug,
          role: row.role ?? "owner",
          start_date: league?.start_date ?? null,
          end_date: league?.end_date ?? null,
          past: Boolean(league?.is_archived),
        }];
      });
      if (dashboardLeagues.length < memberRows.length && memberRows.length > 0) {
        const { data: leagueRows } = await supabase
          .from("leagues")
          .select("id, name, slug, start_date, end_date, is_archived")
          .in("id", memberRows.map((row) => row.league_id));
        const roleByLeagueId = new Map(memberRows.map((row) => [row.league_id, row.role ?? "owner"]));
        dashboardLeagues = ((leagueRows ?? []) as Array<{
          id: string;
          name: string | null;
          slug: string | null;
          start_date?: string | null;
          end_date?: string | null;
          is_archived?: boolean | null;
        }>).flatMap((league) => {
          const slug = league.slug?.trim();
          if (!slug) return [];
          return [{
            id: league.id,
            name: league.name?.trim() || slug,
            slug,
            role: roleByLeagueId.get(league.id) ?? "owner",
            start_date: league.start_date ?? null,
            end_date: league.end_date ?? null,
            past: Boolean(league.is_archived),
          }];
        });
      }
      dashboardLeagues.sort((a, b) => Number(Boolean(a.past)) - Number(Boolean(b.past)) || a.name.localeCompare(b.name));

      const rosterCountByLeagueId = new Map<string, number>();
      for (const row of rosterRowsRes.data ?? []) {
        const leagueId = (row as { league_id: string }).league_id;
        rosterCountByLeagueId.set(leagueId, (rosterCountByLeagueId.get(leagueId) ?? 0) + 1);
      }

      career = await getUserCareerStats(supabase, user.id);
      onboarding = await getOnboardingProgress(
        supabase,
        user.id,
        memberRows,
        rosterCountByLeagueId
      );
    }
  } catch {
    // leave defaults
  }

  if (neverJoined) redirect(PLAY_PATH);

  const displayName = profileDisplayName?.trim() || user.email?.split("@")[0] || "there";

  return (
    <>
      <FantasyOnboardingDashboard
        displayName={displayName}
        career={career}
        pulse={pulse}
        onboarding={onboarding}
        leagues={dashboardLeagues}
        hubHomeHref={hubHomeHref}
      />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 16px 32px" }}>
        <AdsenseDisplayAd slot={adsSlotFantasy} />
      </div>
    </>
  );
}
