import Link from "next/link";
import type { CSSProperties } from "react";
import type { LeagueMember } from "@/lib/leagues";
import { pleDefaultHref } from "@/lib/pleLeagueMenu";
import { ROAD_TO_SUMMERSLAM_SEASON_SLUG, type LeagueSeasonBelt } from "@/lib/leagueStructure";
import { LeagueSeasonBeltBanner } from "@/app/components/LeagueSeasonBeltBanner";
import type { XpDisplay } from "@/lib/xp/getXpDisplayByUserIds";
import type { LevelUpCelebration } from "@/lib/xp/xpLevelUpFlavor";
import type { LeagueHomeXpBannerKind } from "@/lib/xp/leagueHomeXpBannerKind";
import { LeagueLevelUpBanner } from "./LeagueLevelUpBanner";
import { LeagueMobileStandingsTable } from "./LeagueMobileStandingsTable";
import type { LeagueHomeLeaderboardsPayload } from "@/lib/weeklyLeaderboards";
import { LeagueHomeLeaderboardsClient } from "./LeagueHomeLeaderboardsClient";

type Props = {
  leagueSlug: string;
  leagueName: string;
  seasonSubtitle: string | null;
  seasonSlug: string | null;
  leagueStartDate?: string | null;
  leagueEndDate?: string | null;
  isCommissioner: boolean;
  members: LeagueMember[];
  pointsByUserId: Record<string, number>;
  recordByUserId?: Record<string, { w: number; l: number; t: number }>;
  showRecordOnly?: boolean;
  currentUserId: string | null;
  xpByUserId?: Record<string, XpDisplay>;
  showTop10Leaderboards: boolean;
  leaderboardInitial: LeagueHomeLeaderboardsPayload;
  /** When false, sidebar hides “Most points this season” (e.g. Total Season Points leagues). */
  showSeasonTop10?: boolean;
  /** Head-to-head leagues get a Matchups link in the mobile League menu. */
  isHeadToHead?: boolean;
  /** H2H/combo: Matchups is in the top mobile tab bar; Draft moves into this menu. */
  showMatchupsInTopNav?: boolean;
  /** Salary cap leagues use Add/Drop only (no trades) and skip draft nav elsewhere. */
  isSalaryCapLeague?: boolean;
  seasonBelt?: LeagueSeasonBelt | null;
  levelUpCelebration?: LevelUpCelebration | null;
  xpBannerKind?: LeagueHomeXpBannerKind | null;
};

const menuItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 0",
  borderBottom: "1px solid var(--color-border)",
  textDecoration: "none",
  color: "var(--color-text)",
  fontWeight: 500,
  fontSize: 13,
  gap: 12,
};

export function LeagueHomeMobileLeagueView({
  leagueSlug,
  leagueName,
  seasonSubtitle,
  seasonSlug,
  leagueStartDate = null,
  leagueEndDate = null,
  isCommissioner,
  members,
  pointsByUserId,
  recordByUserId,
  showRecordOnly = false,
  currentUserId,
  xpByUserId,
  showTop10Leaderboards,
  leaderboardInitial,
  showSeasonTop10 = true,
  isHeadToHead = false,
  showMatchupsInTopNav = false,
  isSalaryCapLeague = false,
  seasonBelt = null,
  levelUpCelebration = null,
  xpBannerKind = null,
}: Props) {
  const base = `/leagues/${encodeURIComponent(leagueSlug)}`;
  const pleHref = pleDefaultHref(leagueSlug, seasonSlug, leagueStartDate, leagueEndDate);
  const pleLabel = seasonSlug === ROAD_TO_SUMMERSLAM_SEASON_SLUG ? "PLEs" : "Next PLE";

  const items: { href: string; label: string }[] = [
    { href: `${base}/standings`, label: "Standings" },
    ...(isHeadToHead && !showMatchupsInTopNav ? [{ href: `${base}/matchups`, label: "Matchups" }] : []),
    ...(seasonSlug === ROAD_TO_SUMMERSLAM_SEASON_SLUG || isSalaryCapLeague
      ? [
          {
            href: `${base}/pathway`,
            label: seasonSlug === ROAD_TO_SUMMERSLAM_SEASON_SLUG ? "Your Pathway" : "Season schedule",
          },
        ]
      : []),
    { href: `${base}/faction-actions`, label: isSalaryCapLeague ? "Add / Drop" : "Add / Drop / Trade" },
    { href: `${base}/transactions`, label: "Transactions" },
    { href: pleHref, label: pleLabel },
    ...(showMatchupsInTopNav && !isSalaryCapLeague ? [{ href: `${base}/draft`, label: "Draft" }] : []),
    { href: `${base}/edit-team-info`, label: "Edit Faction Info" },
    ...(isCommissioner ? [{ href: `${base}/league-settings`, label: "GM Tools" }] : []),
  ];

  return (
    <div className="league-home-mobile">
      {seasonBelt ? (
        <div
          className="league-home-mobile__section"
          style={{
            marginBottom: 12,
            border: "1px solid var(--color-border)",
            borderRadius: 18,
            overflow: "hidden",
            background: "var(--color-bg-card)",
          }}
        >
          <LeagueSeasonBeltBanner belt={seasonBelt} variant="full" />
        </div>
      ) : null}

      {levelUpCelebration ? (
        <div className="league-home-mobile__section" style={{ marginBottom: 12 }}>
          <LeagueLevelUpBanner celebration={levelUpCelebration} bannerKind={xpBannerKind} />
        </div>
      ) : null}

      <div className="league-home-mobile__section" style={{ marginBottom: 10 }}>
        <h2
          className="league-home-mobile__h2"
          style={{
            margin: "0 0 2px",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase" as const,
            color: "var(--color-text)",
          }}
        >
          League
        </h2>
        <p
          className="league-home-mobile__sub"
          style={{ margin: "0 0 6px", fontSize: 11, color: "var(--color-text-muted)" }}
        >
          {seasonSubtitle ?? leagueName}
        </p>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {items.map((item) => (
            <li key={item.label}>
              <Link href={item.href} className="league-home-mobile__row" style={menuItemStyle}>
                <span>{item.label}</span>
                <span
                  className="league-home-mobile__chev"
                  style={{ color: "var(--color-text-muted)", fontSize: 16, fontWeight: 500 }}
                  aria-hidden
                >
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="league-home-mobile__section">
        <h2
          className="league-home-mobile__h2"
          style={{
            margin: "0 0 6px",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase" as const,
            color: "var(--color-text)",
          }}
        >
          Standings
        </h2>
        <LeagueMobileStandingsTable
          members={members}
          pointsByUserId={pointsByUserId}
          recordByUserId={recordByUserId}
          showRecordOnly={showRecordOnly}
          leagueSlug={leagueSlug}
          currentUserId={currentUserId}
          xpByUserId={xpByUserId}
        />
      </div>

      {showTop10Leaderboards && leaderboardInitial.leagueLeaderboardsAvailable ? (
        <div className="league-home-mobile__section" style={{ marginTop: 12 }}>
          <LeagueHomeLeaderboardsClient
            leagueSlug={leagueSlug}
            initial={leaderboardInitial}
            showSeasonTop10={showSeasonTop10}
          />
        </div>
      ) : null}
    </div>
  );
}
