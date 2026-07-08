import Link from "next/link";
import type { OnboardingProgress } from "@/lib/onboardingProgress";
import type { SiteActivityPulse } from "@/lib/siteActivityPulse";
import type { UserCareerStats } from "@/lib/userCareerStats";
import { SiteActivityPulseBlock } from "@/app/components/SiteActivityPulseBlock";
import { PLAY_PATH } from "@/lib/playFunnel";

type LeagueSummary = {
  id: string;
  name: string;
  slug: string;
  role: string;
  start_date?: string | null;
  end_date?: string | null;
};

type Props = {
  displayName: string;
  career: UserCareerStats;
  pulse: SiteActivityPulse;
  onboarding: OnboardingProgress;
  leagues: LeagueSummary[];
  hubHomeHref: string;
};

const CAREER_STAT_KEYS: Array<{ key: keyof UserCareerStats; label: string }> = [
  { key: "championships", label: "Championships" },
  { key: "leaguesJoined", label: "Leagues joined" },
  { key: "pointsScored", label: "Points scored" },
  { key: "tradesCompleted", label: "Trades" },
  { key: "freeAgentsSigned", label: "Free agents signed" },
];

function formatStatValue(key: keyof UserCareerStats, value: number): string {
  if (key === "pointsScored" && value > 0) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  }
  return String(value);
}

export function FantasyOnboardingDashboard({
  displayName,
  career,
  pulse,
  onboarding,
  leagues,
  hubHomeHref,
}: Props) {
  const greeting = displayName !== "there" ? displayName : "there";

  return (
    <main className="app-page fantasy-onboarding-page">
      <p className="fantasy-onboarding-back">
        <Link href={hubHomeHref} className="app-link">
          ← Site home
        </Link>
      </p>

      {onboarding.showEmptyCareerHero ? (
        <section className="fantasy-onboarding-hero">
          <p className="fantasy-onboarding-eyebrow">Welcome, {greeting}</p>
          <h1 className="fantasy-onboarding-title">Your fantasy career hasn&apos;t started yet</h1>
          <p className="fantasy-onboarding-lead">
            Join a free public league in under a minute — build your roster, earn points from real WWE events, and
            climb the standings.
          </p>
        </section>
      ) : (
        <section className="fantasy-onboarding-hero fantasy-onboarding-hero--compact">
          <p className="fantasy-onboarding-eyebrow">Welcome back, {greeting}</p>
          <h1 className="fantasy-onboarding-title">Your fantasy career</h1>
        </section>
      )}

      <section className="fantasy-onboarding-stats" aria-label="Career stats">
        {CAREER_STAT_KEYS.map(({ key, label }) => (
          <div key={key} className="fantasy-onboarding-stat">
            <div className="fantasy-onboarding-stat-value">{formatStatValue(key, career[key])}</div>
            <div className="fantasy-onboarding-stat-label">{label}</div>
          </div>
        ))}
      </section>

      {!onboarding.allComplete ? (
        <section className="home-panel fantasy-onboarding-checklist">
          <div className="fantasy-onboarding-checklist-head">
            <h2>Get started</h2>
            <span className="fantasy-onboarding-checklist-progress">
              {onboarding.completedCount} of {onboarding.steps.length} complete
            </span>
          </div>
          <ol className="fantasy-onboarding-steps">
            {onboarding.steps.map((step) => (
              <li
                key={step.key}
                className={`fantasy-onboarding-step${step.completed ? " fantasy-onboarding-step--done" : ""}`}
              >
                <span className="fantasy-onboarding-step-mark" aria-hidden>
                  {step.completed ? "✓" : "○"}
                </span>
                <div className="fantasy-onboarding-step-body">
                  {step.href && !step.completed ? (
                    <Link href={step.href} className="fantasy-onboarding-step-label app-link">
                      {step.label}
                    </Link>
                  ) : (
                    <span className="fantasy-onboarding-step-label">{step.label}</span>
                  )}
                  {step.detail ? <p className="fantasy-onboarding-step-detail">{step.detail}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {onboarding.showEmptyCareerHero ? (
        <section className="home-panel fantasy-onboarding-cta-block">
          <Link href={onboarding.primaryCtaHref} className="fantasy-onboarding-primary-cta">
            {onboarding.primaryCtaLabel}
          </Link>
        </section>
      ) : null}

      <SiteActivityPulseBlock pulse={pulse} />

      <section className="home-panel fantasy-onboarding-public">
        <h2>Public leagues</h2>
        <ul className="fantasy-onboarding-bullets">
          <li>Free to play</li>
          <li>Beginner friendly</li>
          <li>Learn as you play</li>
          <li>No pressure — join another league anytime</li>
          <li>Join in under 60 seconds</li>
          <li>New leagues launch every Monday</li>
        </ul>
        <p className="fantasy-onboarding-public-note">
          Missed the start of a season? That&apos;s okay — a fresh public league opens each week.
        </p>
        <Link href={PLAY_PATH} className="fantasy-onboarding-secondary-cta">
          Join a public league
        </Link>
      </section>

      {leagues.length > 0 ? (
        <section className="home-panel">
          <h2>My leagues</h2>
          <ul className="fantasy-onboarding-league-list">
            {leagues.map((league) => (
              <li key={league.id}>
                <Link href={`/leagues/${league.slug}`} className="app-link" style={{ fontWeight: 600 }}>
                  {league.name}
                </Link>
                {league.role === "commissioner" ? (
                  <span className="fantasy-onboarding-league-role">GM</span>
                ) : null}
                {(league.start_date || league.end_date) && (
                  <div className="fantasy-onboarding-league-dates">
                    {league.start_date && league.end_date
                      ? `${league.start_date} – ${league.end_date}`
                      : league.start_date || league.end_date}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p style={{ marginTop: 16, marginBottom: 0 }}>
            <Link href={PLAY_PATH} className="app-link" style={{ fontWeight: 600 }}>
              Join another league →
            </Link>
          </p>
        </section>
      ) : null}

      <section className="home-panel">
        <h2>Quick links</h2>
        <ul className="home-quick-links">
          <li>
            <Link href={hubHomeHref}>Site home</Link> — results and news
          </li>
          <li>
            <Link href="/how-it-works">How it works</Link> — scoring rules and public leagues
          </li>
          <li>
            <Link href="/event-results">Event results</Link> — fantasy scoring for completed events
          </li>
          <li>
            <Link href="/account">Account</Link> — profile and settings
          </li>
        </ul>
      </section>
    </main>
  );
}
