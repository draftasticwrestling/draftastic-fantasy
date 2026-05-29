"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatFantasyWeekRangeLabel } from "@/lib/formatFantasyWeekRange";
import type { HubSiteLeaderboardsPayload } from "@/lib/hubSiteLeaderboardsTypes";

const CLIENT_CACHE_MAX = 24;

function cachePut(map: Map<string, HubSiteLeaderboardsPayload>, key: string, val: HubSiteLeaderboardsPayload) {
  if (map.has(key)) map.delete(key);
  map.set(key, val);
  while (map.size > CLIENT_CACHE_MAX) {
    const first = map.keys().next().value;
    if (first === undefined) break;
    map.delete(first);
  }
}

/** Index payload by requested week and by normalized weekStart so nav clicks always resolve. */
function cachePutWeekPayload(
  map: Map<string, HubSiteLeaderboardsPayload>,
  requestedMonday: string,
  val: HubSiteLeaderboardsPayload
) {
  cachePut(map, requestedMonday, val);
  if (val.weekStart && val.weekStart !== requestedMonday) {
    cachePut(map, val.weekStart, val);
  }
}

function formatPts(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const r = Math.round(n * 100) / 100;
  if (Number.isInteger(r)) return String(r);
  return r.toFixed(2).replace(/\.?0+$/, "");
}

function syncLeaderboardWeekUrl(payload: HubSiteLeaderboardsPayload) {
  if (typeof window === "undefined") return;
  const cur = payload.currentWeekStartMondayPst;
  const ws = payload.weekStart;
  if (!cur || !ws) return;
  const u = new URL(window.location.href);
  if (ws === cur) {
    u.searchParams.delete("leaderboard_week");
  } else {
    u.searchParams.set("leaderboard_week", ws);
  }
  const qs = u.searchParams.toString();
  const path = `${u.pathname}${qs ? `?${qs}` : ""}${u.hash}`;
  window.history.replaceState(null, "", path);
}

async function fetchWeekPayload(weekMonday: string): Promise<HubSiteLeaderboardsPayload | null> {
  const res = await fetch(
    `/api/hub-site-leaderboards?leaderboard_week=${encodeURIComponent(weekMonday)}`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;
  const json = (await res.json()) as HubSiteLeaderboardsPayload;
  if (!json.hubLeaderboardsAvailable || !json.weekStart) return null;
  return json;
}

export default function HubSiteLeaderboardsClient({ initial }: { initial: HubSiteLeaderboardsPayload }) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef<Map<string, HubSiteLeaderboardsPayload>>(new Map());

  const prefetchWeek = useCallback((weekMonday: string | null) => {
    if (!weekMonday || cacheRef.current.has(weekMonday)) return;
    void fetchWeekPayload(weekMonday).then((json) => {
      if (json?.weekStart) cachePutWeekPayload(cacheRef.current, weekMonday, json);
    });
  }, []);

  useEffect(() => {
    if (!initial.weekStart) return;
    cachePutWeekPayload(cacheRef.current, initial.weekStart, initial);
    // Adjacent weeks each re-aggregate every league (expensive). Skip in dev to keep `next dev` responsive.
    if (process.env.NODE_ENV === "development") return;
    const t = window.setTimeout(() => {
      prefetchWeek(initial.weeklyPrevWeekStart);
      prefetchWeek(initial.weeklyNextWeekStart);
    }, 400);
    return () => clearTimeout(t);
  }, [initial, prefetchWeek]);

  const loadWeek = useCallback(
    async (weekMonday: string) => {
      const hit = cacheRef.current.get(weekMonday);
      if (hit) {
        setData(hit);
        syncLeaderboardWeekUrl(hit);
        prefetchWeek(hit.weeklyPrevWeekStart);
        prefetchWeek(hit.weeklyNextWeekStart);
        return;
      }
      setLoading(true);
      try {
        const json = await fetchWeekPayload(weekMonday);
        if (!json?.weekStart) return;
        cachePutWeekPayload(cacheRef.current, weekMonday, json);
        setData(json);
        syncLeaderboardWeekUrl(json);
        prefetchWeek(json.weeklyPrevWeekStart);
        prefetchWeek(json.weeklyNextWeekStart);
      } finally {
        setLoading(false);
      }
    },
    [prefetchWeek]
  );

  const weekLabel = data.weekStart ? formatFantasyWeekRangeLabel(data.weekStart) : null;

  return (
    <section
      className="hub-col-side hub-leaderboards-card"
      aria-label="Fantasy leaderboards"
      aria-busy={loading}
    >
      <h2 className="hub-col-title">Leaderboards</h2>
      <p className="hub-leaderboards-hint">
        Active leagues with a completed draft: each column is your <strong>best single league</strong> for that
        column—scores are never added across leagues. Weekly uses the Mon–Sun <strong>Pacific</strong> week below; use{" "}
        <strong>Previous week</strong> / <strong>Next week</strong> to move.
      </p>

      <div className="hub-leaderboard-block">
        <h3 className="hub-leaderboard-subtitle">Most points this season</h3>
        {data.seasonTop10.length === 0 ? (
          <p className="hub-leaderboards-empty">No fantasy points in active leagues yet.</p>
        ) : (
          <ol className="lm-top10-list">
            {data.seasonTop10.map((row, i) => (
              <li key={`hub-s-${row.userId}`} className="lm-top10-row">
                <span className="lm-top10-rank">{row.rank}</span>
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
        <nav className="hub-leaderboard-week-nav" aria-label="Change fantasy week">
          {data.weeklyPrevWeekStart ? (
            <button
              type="button"
              className="app-link hub-leaderboard-week-nav-link hub-leaderboard-week-nav-btn"
              disabled={loading}
              onClick={() => void loadWeek(data.weeklyPrevWeekStart!)}
            >
              Previous Week
            </button>
          ) : (
            <span className="hub-leaderboard-week-nav-muted">Previous Week</span>
          )}
          {data.weeklyNextWeekStart ? (
            <button
              type="button"
              className="app-link hub-leaderboard-week-nav-link hub-leaderboard-week-nav-btn"
              disabled={loading}
              onClick={() => void loadWeek(data.weeklyNextWeekStart!)}
            >
              Next Week
            </button>
          ) : (
            <span className="hub-leaderboard-week-nav-muted">Next Week</span>
          )}
        </nav>
        {data.weeklyTop10.length === 0 ? (
          <p className="hub-leaderboards-empty">No points scored this week yet.</p>
        ) : (
          <ol className="lm-top10-list">
            {data.weeklyTop10.map((row, i) => (
              <li key={`hub-w-${row.userId}-${data.weekStart ?? "w"}`} className="lm-top10-row">
                <span className="lm-top10-rank">{row.rank}</span>
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
