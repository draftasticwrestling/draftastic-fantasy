"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatFantasyWeekRangeLabel } from "@/lib/formatFantasyWeekRange";
import type { SiteLeaderboardsPayload } from "@/lib/siteLeaderboardsTypes";

const CLIENT_CACHE_MAX = 24;

function cachePut(map: Map<string, SiteLeaderboardsPayload>, key: string, val: SiteLeaderboardsPayload) {
  if (map.has(key)) map.delete(key);
  map.set(key, val);
  while (map.size > CLIENT_CACHE_MAX) {
    const first = map.keys().next().value;
    if (first === undefined) break;
    map.delete(first);
  }
}

function cachePutWeekPayload(
  map: Map<string, SiteLeaderboardsPayload>,
  requestedMonday: string,
  val: SiteLeaderboardsPayload
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

function formatXp(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("en-US");
}

function syncLeaderboardWeekUrl(payload: SiteLeaderboardsPayload) {
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

async function fetchWeekPayload(weekMonday: string): Promise<SiteLeaderboardsPayload | null> {
  const res = await fetch(
    `/api/site-leaderboards?leaderboard_week=${encodeURIComponent(weekMonday)}`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;
  const json = (await res.json()) as SiteLeaderboardsPayload;
  if (!json.siteLeaderboardsAvailable || !json.weekStart) return null;
  return json;
}

function BoardList({
  rows,
  empty,
  listKey,
  formatValue = formatPts,
}: {
  rows: SiteLeaderboardsPayload["segments"][number]["seasonTop10"];
  empty: string;
  listKey: string;
  formatValue?: (n: number) => string;
}) {
  if (rows.length === 0) {
    return <p className="hub-leaderboards-empty">{empty}</p>;
  }
  return (
    <ol className="lm-top10-list site-lb-list">
      {rows.map((row) => (
        <li
          key={`${listKey}-${row.userId}`}
          className={`lm-top10-row site-lb-row${row.rank <= 3 ? ` site-lb-row--top${row.rank}` : ""}`}
        >
          <span className="lm-top10-rank site-lb-rank">{row.rank}</span>
          <span className="lm-top10-name site-lb-name">{row.label}</span>
          <span className="lm-top10-pts site-lb-pts">{formatValue(row.points)}</span>
        </li>
      ))}
    </ol>
  );
}

function WeekNav({
  weekLabel,
  prevWeekStart,
  nextWeekStart,
  loading,
  onLoadWeek,
  ariaLabel,
}: {
  weekLabel: string | null;
  prevWeekStart: string | null;
  nextWeekStart: string | null;
  loading: boolean;
  onLoadWeek: (weekMonday: string) => void;
  ariaLabel: string;
}) {
  return (
    <>
      {weekLabel ? <p className="hub-leaderboard-week">Week of {weekLabel}</p> : null}
      <nav className="hub-leaderboard-week-nav" aria-label={ariaLabel}>
        {prevWeekStart ? (
          <button
            type="button"
            className="app-link hub-leaderboard-week-nav-link hub-leaderboard-week-nav-btn"
            disabled={loading}
            onClick={() => onLoadWeek(prevWeekStart)}
          >
            Previous Week
          </button>
        ) : (
          <span className="hub-leaderboard-week-nav-muted">Previous Week</span>
        )}
        {nextWeekStart ? (
          <button
            type="button"
            className="app-link hub-leaderboard-week-nav-link hub-leaderboard-week-nav-btn"
            disabled={loading}
            onClick={() => onLoadWeek(nextWeekStart)}
          >
            Next Week
          </button>
        ) : (
          <span className="hub-leaderboard-week-nav-muted">Next Week</span>
        )}
      </nav>
    </>
  );
}

export default function SiteLeaderboardsClient({ initial }: { initial: SiteLeaderboardsPayload }) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef<Map<string, SiteLeaderboardsPayload>>(new Map());

  useEffect(() => {
    setData(initial);
  }, [initial]);

  const prefetchWeek = useCallback((weekMonday: string | null) => {
    if (!weekMonday || cacheRef.current.has(weekMonday)) return;
    void fetchWeekPayload(weekMonday).then((json) => {
      if (json?.weekStart) cachePutWeekPayload(cacheRef.current, weekMonday, json);
    });
  }, []);

  useEffect(() => {
    if (!initial.weekStart) return;
    cachePutWeekPayload(cacheRef.current, initial.weekStart, initial);
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
    <div className="site-leaderboards" aria-busy={loading}>
      <section className="site-leaderboards-section site-leaderboards-section--xp" aria-labelledby="lb-seg-xp">
        <div className="site-leaderboards-section-head">
          <h2 id="lb-seg-xp" className="site-leaderboards-section-title">
            Experience (XP)
          </h2>
          <p className="site-leaderboards-section-desc">
            Site-wide manager XP — all-time totals and XP earned in the selected Mon–Sun Pacific week.
          </p>
        </div>

        <div className="site-leaderboards-section-week">
          <WeekNav
            weekLabel={weekLabel}
            prevWeekStart={data.weeklyPrevWeekStart}
            nextWeekStart={data.weeklyNextWeekStart}
            loading={loading}
            onLoadWeek={(w) => void loadWeek(w)}
            ariaLabel="Change fantasy week for XP leaderboards"
          />
        </div>

        <div className="site-leaderboards-pair">
          <div className="hub-leaderboard-block site-lb-board">
            <h3 className="hub-leaderboard-subtitle">Most XP all-time</h3>
            <BoardList
              rows={data.xpAllTimeTop10 ?? []}
              empty="No XP earned yet."
              listKey="xp-all"
              formatValue={formatXp}
            />
          </div>
          <div className="hub-leaderboard-block site-lb-board">
            <h3 className="hub-leaderboard-subtitle">Most XP this week</h3>
            <BoardList
              rows={data.xpWeeklyTop10 ?? []}
              empty="No XP earned this week yet."
              listKey={`xp-w-${data.weekStart ?? "w"}`}
              formatValue={formatXp}
            />
          </div>
        </div>
      </section>

      <div className="site-leaderboards-week-bar">
        <h2 className="site-leaderboards-week-heading">Fantasy week</h2>
        <WeekNav
          weekLabel={weekLabel}
          prevWeekStart={data.weeklyPrevWeekStart}
          nextWeekStart={data.weeklyNextWeekStart}
          loading={loading}
          onLoadWeek={(w) => void loadWeek(w)}
          ariaLabel="Change fantasy week for all boards"
        />
        <p className="site-leaderboards-hint">
          Each fantasy board uses your <strong>best single league</strong> in that category — scores are never added
          across leagues. Weekly boards (including XP this week) use the Mon–Sun <strong>Pacific</strong> week; use{" "}
          <strong>Previous week</strong> / <strong>Next week</strong> to move.
        </p>
      </div>

      {data.segments.map((seg) => (
        <section
          key={seg.id}
          className="site-leaderboards-section site-leaderboards-section--fantasy"
          data-segment={seg.id}
          aria-labelledby={`lb-seg-${seg.id}`}
        >
          <div className="site-leaderboards-section-head">
            <h2 id={`lb-seg-${seg.id}`} className="site-leaderboards-section-title">
              {seg.title}
            </h2>
            <p className="site-leaderboards-section-desc">
              {seg.description}
              {seg.leagueCount === 0
                ? " No matching leagues yet."
                : ` ${seg.leagueCount} league${seg.leagueCount === 1 ? "" : "s"}.`}
            </p>
          </div>

          <div className="site-leaderboards-section-week">
            <WeekNav
              weekLabel={weekLabel}
              prevWeekStart={data.weeklyPrevWeekStart}
              nextWeekStart={data.weeklyNextWeekStart}
              loading={loading}
              onLoadWeek={(w) => void loadWeek(w)}
              ariaLabel={`Change fantasy week for ${seg.title}`}
            />
          </div>

          <div className="site-leaderboards-pair">
            <div className="hub-leaderboard-block site-lb-board">
              <h3 className="hub-leaderboard-subtitle">Most points this season</h3>
              <BoardList
                rows={seg.seasonTop10}
                empty={
                  seg.leagueCount === 0
                    ? "No leagues in this category yet."
                    : "No fantasy points in this category yet."
                }
                listKey={`${seg.id}-s`}
              />
            </div>
            <div className="hub-leaderboard-block site-lb-board">
              <h3 className="hub-leaderboard-subtitle">Most points this week</h3>
              <BoardList
                rows={seg.weeklyTop10}
                empty={
                  seg.leagueCount === 0
                    ? "No leagues in this category yet."
                    : "No points scored this week in this category yet."
                }
                listKey={`${seg.id}-w-${data.weekStart ?? "w"}`}
              />
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
