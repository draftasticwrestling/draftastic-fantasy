import Link from "next/link";
import {
  SITE_ACTIVITY_PULSE_ITEMS,
  type SiteActivityPulse,
} from "@/lib/siteActivityPulse";
import { PLAY_PATH } from "@/lib/playFunnel";

type Props = {
  pulse: SiteActivityPulse;
  /** `panel` = fantasy dashboard; `hub-rail` = compact hub left column */
  variant?: "panel" | "hub-rail";
  showCta?: boolean;
};

const HUB_RAIL_LABELS: Record<keyof SiteActivityPulse, string> = {
  weeklyPointsScored: "pts this week",
  activeLeagues: "active leagues",
  seasonMatchesScored: "matches scored this season",
  seasonTradesProposed: "trades proposed",
  seasonFreeAgentsSigned: "free agents signed",
  draftasticChampions: "Draftastic Champions",
};

export function SiteActivityPulseBlock({ pulse, variant = "panel", showCta = false }: Props) {
  const isHubRail = variant === "hub-rail";

  if (isHubRail) {
    return (
      <div className="hub-site-pulse-rail-inner">
        <h2 className="hub-site-pulse-rail-title">
          <span className="hub-site-pulse-live-dot" aria-hidden="true" />
          Live across Draftastic
        </h2>
        <ul className="hub-site-pulse-rail-list">
          {SITE_ACTIVITY_PULSE_ITEMS.map(({ key, label }) => (
            <li key={key} className="hub-site-pulse-rail-row">
              <strong>{(pulse[key] ?? 0).toLocaleString()}</strong>
              <span>{HUB_RAIL_LABELS[key] ?? label}</span>
            </li>
          ))}
        </ul>
        {showCta ? (
          <p className="hub-site-pulse-rail-cta-wrap">
            <Link href={PLAY_PATH} className="hub-site-pulse-rail-cta">
              Join a free public league →
            </Link>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <section className="home-panel fantasy-onboarding-pulse" aria-label="Live fantasy activity">
      <div>
        <h2>Live across Draftastic</h2>
        <p className="fantasy-onboarding-pulse-lead">Fantasy wrestling is happening right now.</p>
      </div>
      <ul className="fantasy-onboarding-pulse-list">
        {SITE_ACTIVITY_PULSE_ITEMS.map(({ key, label }) => (
          <li key={key}>
            <strong>{(pulse[key] ?? 0).toLocaleString()}</strong> {label}
          </li>
        ))}
      </ul>
      {showCta ? (
        <p style={{ marginTop: 16, marginBottom: 0 }}>
          <Link href={PLAY_PATH} className="fantasy-onboarding-secondary-cta">
            Join a free public league
          </Link>
        </p>
      ) : null}
    </section>
  );
}
