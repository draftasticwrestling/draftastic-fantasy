import Link from "next/link";
import type { CSSProperties } from "react";
import type { LeagueMember } from "@/lib/leagues";
import { pleDefaultHref } from "@/lib/pleLeagueMenu";
import { ROAD_TO_SUMMERSLAM_SEASON_SLUG } from "@/lib/leagueStructure";
import { LeagueMobileStandingsTable } from "./LeagueMobileStandingsTable";

type Props = {
  leagueSlug: string;
  leagueName: string;
  seasonSubtitle: string | null;
  seasonSlug: string | null;
  isCommissioner: boolean;
  members: LeagueMember[];
  pointsByUserId: Record<string, number>;
  currentUserId: string | null;
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
  isCommissioner,
  members,
  pointsByUserId,
  currentUserId,
}: Props) {
  const base = `/leagues/${encodeURIComponent(leagueSlug)}`;
  const pleHref = pleDefaultHref(leagueSlug, seasonSlug);
  const pleLabel = seasonSlug === ROAD_TO_SUMMERSLAM_SEASON_SLUG ? "PLEs" : "Next PLE";

  const items: { href: string; label: string }[] = [
    { href: `${base}/standings`, label: "Standings" },
    ...(seasonSlug === ROAD_TO_SUMMERSLAM_SEASON_SLUG
      ? [{ href: `${base}/pathway`, label: "Your Pathway" }]
      : []),
    { href: `${base}/faction-actions`, label: "Add / Drop / Trade" },
    { href: `${base}/transactions`, label: "Transactions" },
    { href: pleHref, label: pleLabel },
    { href: `${base}/edit-team-info`, label: "Edit Faction Info" },
    ...(isCommissioner ? [{ href: `${base}/league-settings`, label: "GM Tools" }] : []),
  ];

  return (
    <div className="league-home-mobile">
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
          leagueSlug={leagueSlug}
          currentUserId={currentUserId}
        />
      </div>
    </div>
  );
}
