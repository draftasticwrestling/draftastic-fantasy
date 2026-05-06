import Link from "next/link";
import type { LeaderboardDisplayRow } from "@/lib/weeklyLeaderboards";
import { formatFantasyWeekRangeLabel } from "@/lib/formatFantasyWeekRange";

type Props = {
  leagueSlug: string;
  weekStart: string | null;
  weeklyTop10: LeaderboardDisplayRow[];
  seasonTop10: LeaderboardDisplayRow[];
};

function formatPts(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const r = Math.round(n * 100) / 100;
  if (Number.isInteger(r)) return String(r);
  return r.toFixed(2).replace(/\.?0+$/, "");
}

export function LeagueHomeSidebarTop10({ leagueSlug, weekStart, weeklyTop10, seasonTop10 }: Props) {
  const weekLabel = weekStart ? formatFantasyWeekRangeLabel(weekStart) : null;

  return (
    <div className="lm-card lm-card--top10">
      <h2 className="lm-card-title">Leaderboards</h2>
      <p className="lm-top10-hint" style={{ margin: "0 0 10px", fontSize: 11, color: "var(--color-text-muted)", lineHeight: 1.45 }}>
        Season total sums each finalized fantasy week (Mon–Sun). Weekly shows the latest finalized week.
      </p>

      <div className="lm-top10-block">
        <h3 className="lm-top10-subtitle">Most points this season</h3>
        {seasonTop10.length === 0 ? (
          <p className="lm-activity-empty" style={{ margin: 0, fontSize: 12 }}>No snapshot data yet.</p>
        ) : (
          <ol className="lm-top10-list">
            {seasonTop10.map((row, i) => (
              <li key={`s-${row.userId}`} className="lm-top10-row">
                <span className="lm-top10-rank">{i + 1}</span>
                <Link href={`/leagues/${encodeURIComponent(leagueSlug)}/team/${encodeURIComponent(row.userId)}`} className="lm-top10-name">
                  {row.label}
                </Link>
                <span className="lm-top10-pts">{formatPts(row.points)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="lm-top10-block" style={{ marginTop: 14 }}>
        <h3 className="lm-top10-subtitle">Most points this week</h3>
        {weekLabel ? (
          <p className="lm-top10-week" style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)" }}>
            Week of {weekLabel}
          </p>
        ) : null}
        {weeklyTop10.length === 0 ? (
          <p className="lm-activity-empty" style={{ margin: 0, fontSize: 12 }}>No snapshot data yet.</p>
        ) : (
          <ol className="lm-top10-list">
            {weeklyTop10.map((row, i) => (
              <li key={`w-${row.userId}`} className="lm-top10-row">
                <span className="lm-top10-rank">{i + 1}</span>
                <Link href={`/leagues/${encodeURIComponent(leagueSlug)}/team/${encodeURIComponent(row.userId)}`} className="lm-top10-name">
                  {row.label}
                </Link>
                <span className="lm-top10-pts">{formatPts(row.points)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
