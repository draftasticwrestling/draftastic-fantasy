"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatFantasyWeekRangeLabel } from "@/lib/formatFantasyWeekRange";
import type { LeagueHomeLeaderboardsPayload } from "@/lib/weeklyLeaderboards";

const CLIENT_CACHE_MAX = 24;

type Props = {
  leagueSlug: string;
  initial: LeagueHomeLeaderboardsPayload;
  showSeasonTop10?: boolean;
};

function formatPts(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const r = Math.round(n * 100) / 100;
  if (Number.isInteger(r)) return String(r);
  return r.toFixed(2).replace(/\.?0+$/, "");
}

function cachePut(map: Map<string, LeagueHomeLeaderboardsPayload>, key: string, val: LeagueHomeLeaderboardsPayload) {
  if (map.has(key)) map.delete(key);
  map.set(key, val);
  while (map.size > CLIENT_CACHE_MAX) {
    const first = map.keys().next().value;
    if (first === undefined) break;
    map.delete(first);
  }
}

function cachePutWeekPayload(
  map: Map<string, LeagueHomeLeaderboardsPayload>,
  requestedWeek: string,
  val: LeagueHomeLeaderboardsPayload
) {
  cachePut(map, requestedWeek, val);
  if (val.weekStart && val.weekStart !== requestedWeek) {
    cachePut(map, val.weekStart, val);
  }
}

function syncLeaderboardWeekUrl(leagueSlug: string, payload: LeagueHomeLeaderboardsPayload) {
  if (typeof window === "undefined") return;
  const cur = payload.currentWeekStart;
  const ws = payload.weekStart;
  if (!cur || !ws) return;
  const u = new URL(window.location.href);
  if (ws === cur) {
    u.searchParams.delete("leaderboard_week");
  } else {
    u.searchParams.set("leaderboard_week", ws);
  }
  const qs = u.searchParams.toString();
  const path = `/leagues/${encodeURIComponent(leagueSlug)}${qs ? `?${qs}` : ""}${u.hash}`;
  window.history.replaceState(null, "", path);
}

async function fetchWeekPayload(
  leagueSlug: string,
  weekKey: string
): Promise<LeagueHomeLeaderboardsPayload | null> {
  const res = await fetch(
    `/api/leagues/${encodeURIComponent(leagueSlug)}/leaderboards?leaderboard_week=${encodeURIComponent(weekKey)}`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;
  const json = (await res.json()) as LeagueHomeLeaderboardsPayload;
  if (!json.leagueLeaderboardsAvailable || !json.weekStart) return null;
  return json;
}

export function LeagueHomeLeaderboardsClient({
  leagueSlug,
  initial,
  showSeasonTop10 = true,
}: Props) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef<Map<string, LeagueHomeLeaderboardsPayload>>(new Map());

  const prefetchWeek = useCallback(
    (weekKey: string | null) => {
      if (!weekKey || cacheRef.current.has(weekKey)) return;
      void fetchWeekPayload(leagueSlug, weekKey).then((json) => {
        if (json?.weekStart) cachePutWeekPayload(cacheRef.current, weekKey, json);
      });
    },
    [leagueSlug]
  );

  useEffect(() => {
    if (!initial.weekStart) return;
    cachePutWeekPayload(cacheRef.current, initial.weekStart, initial);
    if (process.env.NODE_ENV === "development") return;
    const t = window.setTimeout(() => {
      prefetchWeek(initial.weeklyPrevWeekStart);
      prefetchWeek(initial.weeklyNextWeekStart);
    }, 400);
    return () => clearTimeout(t);
  }, [initial, prefetchWeek]);

  const loadWeek = useCallback(
    async (weekKey: string) => {
      const hit = cacheRef.current.get(weekKey);
      if (hit) {
        setData(hit);
        syncLeaderboardWeekUrl(leagueSlug, hit);
        prefetchWeek(hit.weeklyPrevWeekStart);
        prefetchWeek(hit.weeklyNextWeekStart);
        return;
      }
      setLoading(true);
      try {
        const json = await fetchWeekPayload(leagueSlug, weekKey);
        if (!json?.weekStart) return;
        cachePutWeekPayload(cacheRef.current, weekKey, json);
        setData(json);
        syncLeaderboardWeekUrl(leagueSlug, json);
        prefetchWeek(json.weeklyPrevWeekStart);
        prefetchWeek(json.weeklyNextWeekStart);
      } finally {
        setLoading(false);
      }
    },
    [leagueSlug, prefetchWeek]
  );

  const weekLabel = data.weekStart
    ? formatFantasyWeekRangeLabel(data.weekStart, data.leagueStartYmd)
    : null;

  return (
    <div className="lm-card lm-card--top10" aria-busy={loading}>
      <h2 className="lm-card-title">Leaderboards</h2>
      <p
        className="lm-top10-hint"
        style={{ margin: "0 0 10px", fontSize: 11, color: "var(--color-text-muted)", lineHeight: 1.45 }}
      >
        {showSeasonTop10 ? (
          <>
            Season total is year-to-date in this league. Weekly updates live during the selected fantasy week (same
            scoring as matchups). Use <strong>Previous week</strong> / <strong>Next week</strong> to browse.
          </>
        ) : (
          <>
            Weekly leaderboard for the selected fantasy week, updated live (same scoring as matchups for that week).
          </>
        )}
      </p>

      {showSeasonTop10 ? (
        <div className="lm-top10-block">
          <h3 className="lm-top10-subtitle">Most points this season</h3>
          {data.seasonTop10.length === 0 ? (
            <p className="lm-activity-empty" style={{ margin: 0, fontSize: 12 }}>
              No points yet.
            </p>
          ) : (
            <ol className="lm-top10-list">
              {data.seasonTop10.map((row, i) => (
                <li key={`s-${row.userId}`} className="lm-top10-row">
                  <span className="lm-top10-rank">{i + 1}</span>
                  <Link
                    href={`/leagues/${encodeURIComponent(leagueSlug)}/team/${encodeURIComponent(row.userId)}`}
                    className="lm-top10-name"
                  >
                    {row.label}
                  </Link>
                  <span className="lm-top10-pts">{formatPts(row.points)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : null}

      <div className="lm-top10-block" style={{ marginTop: showSeasonTop10 ? 14 : 0 }}>
        <h3 className="lm-top10-subtitle">Most points this week</h3>
        {weekLabel ? (
          <p
            className="lm-top10-week hub-leaderboard-week"
            style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)" }}
          >
            Week of {weekLabel}
          </p>
        ) : null}
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
          <p className="lm-activity-empty" style={{ margin: 0, fontSize: 12 }}>
            No points scored this week yet.
          </p>
        ) : (
          <ol className="lm-top10-list">
            {data.weeklyTop10.map((row, i) => (
              <li key={`w-${row.userId}-${data.weekStart ?? "w"}`} className="lm-top10-row">
                <span className="lm-top10-rank">{i + 1}</span>
                <Link
                  href={`/leagues/${encodeURIComponent(leagueSlug)}/team/${encodeURIComponent(row.userId)}`}
                  className="lm-top10-name"
                >
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
