import { getHubSiteLeaderboards } from "@/lib/hubSiteLeaderboards";
import { formatFantasyWeekRangeLabel } from "@/lib/formatFantasyWeekRange";

function formatPts(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const r = Math.round(n * 100) / 100;
  if (Number.isInteger(r)) return String(r);
  return r.toFixed(2).replace(/\.?0+$/, "");
}

export default async function HubSiteLeaderboards() {
  const { weekStart, weeklyTop10, seasonTop10, hubLeaderboardsAvailable } = await getHubSiteLeaderboards();
  const weekLabel = weekStart ? formatFantasyWeekRangeLabel(weekStart) : null;

  if (!hubLeaderboardsAvailable) {
    return null;
  }

  return (
    <section className="hub-col-side hub-leaderboards-card" aria-label="Fantasy leaderboards">
      <h2 className="hub-col-title">Leaderboards</h2>
      <p className="hub-leaderboards-hint">
        Site-wide among active leagues (completed draft). Season and weekly both use your best single league so
        multi-league managers are not double-counted. Weekly is the current Mon–Sun week (PT), using live scores until
        that week is snapshotted.
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
