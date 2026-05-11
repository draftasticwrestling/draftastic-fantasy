import Link from "next/link";
import { getHubSiteLeaderboards } from "@/lib/hubSiteLeaderboards";
import { formatFantasyWeekRangeLabel } from "@/lib/formatFantasyWeekRange";

function formatPts(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const r = Math.round(n * 100) / 100;
  if (Number.isInteger(r)) return String(r);
  return r.toFixed(2).replace(/\.?0+$/, "");
}

type Props = {
  leaderboardWeek?: string | null;
};

export default async function HubSiteLeaderboards({ leaderboardWeek = null }: Props) {
  const {
    weekStart,
    currentWeekStartMondayPst,
    isWeeklyCurrentWeek,
    weeklyPrevWeekStart,
    weeklyNextWeekStart,
    weeklyTop10,
    seasonTop10,
    hubLeaderboardsAvailable,
  } = await getHubSiteLeaderboards({ leaderboardWeek });
  const weekLabel = weekStart ? formatFantasyWeekRangeLabel(weekStart) : null;

  if (!hubLeaderboardsAvailable) {
    return null;
  }

  const weekHref = (mon: string) => `/?leaderboard_week=${encodeURIComponent(mon)}`;

  return (
    <section className="hub-col-side hub-leaderboards-card" aria-label="Fantasy leaderboards">
      <h2 className="hub-col-title">Leaderboards</h2>
      <p className="hub-leaderboards-hint">
        Site-wide among active leagues (completed draft). Each row is your best single league (not summed across
        leagues). Season totals match the league home: R/S and PLE event points plus title-hold belt points and, when
        the league format uses them, weekly win and Draftastic belt bonuses. Weekly is Mon–Sun (PT); use the links
        below to view earlier weeks.
      </p>

      <div className="hub-leaderboard-block">
        <h3 className="hub-leaderboard-subtitle">Most points this season</h3>
        {seasonTop10.length === 0 ? (
          <p className="hub-leaderboards-empty">No fantasy points in active leagues yet.</p>
        ) : (
          <ol className="lm-top10-list">
            {seasonTop10.map((row, i) => (
              <li key={`hub-s-${row.userId}`} className="lm-top10-row">
                <span className="lm-top10-rank">{i + 1}</span>
                <span className="lm-top10-name hub-leaderboard-name">{row.label}</span>
                <span className="lm-top10-pts">{formatPts(row.points)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="hub-leaderboard-block hub-leaderboard-block--week">
        <h3 className="hub-leaderboard-subtitle">Most points this week</h3>
        {weekLabel ? <p className="hub-leaderboard-week">Week of {weekLabel}</p> : null}
        <nav className="hub-leaderboard-week-nav" aria-label="Fantasy week">
          {weeklyPrevWeekStart ? (
            <Link href={weekHref(weeklyPrevWeekStart)} className="app-link hub-leaderboard-week-nav-link">
              ← Previous week
            </Link>
          ) : (
            <span className="hub-leaderboard-week-nav-muted">← Previous week</span>
          )}
          {!isWeeklyCurrentWeek && currentWeekStartMondayPst ? (
            <>
              <span className="hub-leaderboard-week-nav-sep" aria-hidden>
                ·
              </span>
              <Link href="/" className="app-link hub-leaderboard-week-nav-link">
                This week
              </Link>
            </>
          ) : null}
          {weeklyNextWeekStart ? (
            <>
              <span className="hub-leaderboard-week-nav-sep" aria-hidden>
                ·
              </span>
              <Link href={weekHref(weeklyNextWeekStart)} className="app-link hub-leaderboard-week-nav-link">
                Next week →
              </Link>
            </>
          ) : (
            <>
              <span className="hub-leaderboard-week-nav-sep" aria-hidden>
                ·
              </span>
              <span className="hub-leaderboard-week-nav-muted">Next week →</span>
            </>
          )}
        </nav>
        {weeklyTop10.length === 0 ? (
          <p className="hub-leaderboards-empty">No points scored this week yet.</p>
        ) : (
          <ol className="lm-top10-list">
            {weeklyTop10.map((row, i) => (
              <li key={`hub-w-${row.userId}`} className="lm-top10-row">
                <span className="lm-top10-rank">{i + 1}</span>
                <span className="lm-top10-name hub-leaderboard-name">{row.label}</span>
                <span className="lm-top10-pts">{formatPts(row.points)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
