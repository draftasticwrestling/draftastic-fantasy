import Link from "next/link";
import type { CSSProperties } from "react";
import type { LeagueMember } from "@/lib/leagues";
import { pleDefaultHref } from "@/lib/pleLeagueMenu";
import { ROAD_TO_SUMMERSLAM_SEASON_SLUG } from "@/lib/leagueStructure";
import type { XpDisplay } from "@/lib/xp/getXpDisplayByUserIds";
import type { LevelUpCelebration } from "@/lib/xp/xpLevelUpFlavor";
import type { LeagueHomeXpBannerKind } from "@/lib/xp/leagueHomeXpBannerKind";
import { LeagueLevelUpBanner } from "./LeagueLevelUpBanner";
import { LeagueMobileStandingsTable } from "./LeagueMobileStandingsTable";
import type { LeaderboardDisplayRow } from "@/lib/weeklyLeaderboards";
import { LeagueHomeSidebarTop10 } from "./LeagueHomeSidebarTop10";

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
  weeklyTop10: LeaderboardDisplayRow[];
  seasonTop10: LeaderboardDisplayRow[];
  /** When false, sidebar hides “Most points this season” (e.g. Total Season Points leagues). */
  showSeasonTop10?: boolean;
  /** Head-to-head leagues get a Matchups link in the mobile League menu. */
  isHeadToHead?: boolean;
  /** Salary cap leagues use Add/Drop only (no trades) and skip draft nav elsewhere. */
  isSalaryCapLeague?: boolean;
  latestWeekStart: string | null;
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
  weeklyTop10,
  seasonTop10,
  showSeasonTop10 = true,
  isHeadToHead = false,
  isSalaryCapLeague = false,
  latestWeekStart,
  levelUpCelebration = null,
  xpBannerKind = null,
}: Props) {
  const base = `/leagues/${encodeURIComponent(leagueSlug)}`;
  const pleHref = pleDefaultHref(leagueSlug, seasonSlug, leagueStartDate, leagueEndDate);
  const pleLabel = seasonSlug === ROAD_TO_SUMMERSLAM_SEASON_SLUG ? "PLEs" : "Next PLE";

  const items: { href: string; label: string }[] = [
    { href: `${base}/standings`, label: "Standings" },
    ...(isHeadToHead ? [{ href: `${base}/matchups`, label: "Matchups" }] : []),
    ...(seasonSlug === ROAD_TO_SUMMERSLAM_SEASON_SLUG
      ? [{ href: `${base}/pathway`, label: "Your Pathway" }]
      : []),
    { href: `${base}/faction-actions`, label: isSalaryCapLeague ? "Add / Drop" : "Add / Drop / Trade" },
    { href: `${base}/transactions`, label: "Transactions" },
    { href: pleHref, label: pleLabel },
    { href: `${base}/edit-team-info`, label: "Edit Faction Info" },
    ...(isCommissioner ? [{ href: `${base}/league-settings`, label: "GM Tools" }] : []),
  ];

  return (
    <div className="league-home-mobile">
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

      {showTop10Leaderboards ? (
        <div className="league-home-mobile__section" style={{ marginTop: 12 }}>
          <LeagueHomeSidebarTop10
            leagueSlug={leagueSlug}
            weekStart={latestWeekStart}
            weeklyTop10={weeklyTop10}
            seasonTop10={seasonTop10}
            showSeasonTop10={showSeasonTop10}
          />
        </div>
      ) : null}
    </div>
  );
}
