"use client";

import React, { useEffect, useState } from "react";
import type { LeagueSeasonTimelinePayload } from "@/lib/leagueSeasonTimeline";
import styles from "./SeasonTimelineRail.module.css";

function formatShortDate(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const [y, m, d] = ymd.split("-");
  return `${Number(m)}/${Number(d)}/${y.slice(2)}`;
}

export default function SeasonTimelineRail({ leagueSlug }: { leagueSlug: string }) {
  const [data, setData] = useState<LeagueSeasonTimelinePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/leagues/${encodeURIComponent(leagueSlug)}/season-timeline`, {
      credentials: "same-origin",
    })
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error((j as { error?: string }).error || res.statusText);
        }
        return res.json() as Promise<LeagueSeasonTimelinePayload>;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leagueSlug]);

  if (loading) {
    return (
      <div className={styles.rail} aria-busy="true" aria-label="Season timeline loading">
        <div className={styles.skeletonTitle} />
        <div className={styles.skeletonLine} />
        <div className={styles.skeletonLine} />
        <div className={styles.skeletonLine} />
      </div>
    );
  }

  if (error || !data) {
    return null;
  }

  const awaitingMinimum = Boolean(
    (data as { awaitingMinimum?: boolean }).awaitingMinimum ||
      (!data.windowStart && data.seasonPhase?.id === "public-salary-cap")
  );

  const { seasonPhase, steps } = data;

  return (
    <nav className={styles.rail} aria-label="League season progress">
      <h2 className={styles.heading}>{seasonPhase.title}</h2>
      <p className={styles.sub}>
        {awaitingMinimum ? (
          <>Waiting for at least 3 factions — your 12-week season schedule will appear here once the league is set.</>
        ) : (
          <>
            From {formatShortDate(data.windowStart)}
            {data.windowEnd === "2099-12-31"
              ? " · no league end date set"
              : ` · through ${formatShortDate(data.windowEnd)}`}
          </>
        )}
      </p>

      {awaitingMinimum ? (
        <p className={styles.empty}>Invite managers or share your league code to reach 3 factions.</p>
      ) : steps.length === 0 ? (
        <p className={styles.empty}>No scheduled TV or PLE events in this league window yet.</p>
      ) : (
        <ol className={styles.trackList}>
          {steps.map((step, i) => {
            const last = i === steps.length - 1;
            const { monthEndBelt, pleFinaleBelt, weeklyBeltLock } = step;
            return (
              <li key={step.id} className={styles.trackItem}>
                <div className={styles.trackCol}>
                  {!last && <div className={styles.trackLine} aria-hidden />}
                  <div
                    className={
                      step.completed
                        ? styles.circleDone
                        : step.isNext
                          ? styles.circleNext
                          : styles.circleUpcoming
                    }
                    aria-hidden
                  >
                    <span className={styles.circleNum}>{step.index}</span>
                  </div>
                </div>
                <div className={styles.labelCol}>
                  <span
                    className={
                      (step.completed ? styles.labelDone : styles.labelUpcoming) +
                      (step.isFinale ? ` ${styles.labelFinale}` : "")
                    }
                  >
                    {step.kind === "ple" && (
                      <span className={styles.pleBadge} title="Premium Live Event">
                        PLE
                      </span>
                    )}
                    {step.name} {formatShortDate(step.date)}
                  </span>
                  {(monthEndBelt || pleFinaleBelt || weeklyBeltLock) && (
                    <div className={styles.beltSubwrap}>
                      {weeklyBeltLock && (
                        <div
                          className={styles.beltSubline}
                          title="Weekly title-holder points (Road to SummerSlam)"
                        >
                          <span className={styles.beltSubBadge}>Belt</span>
                          <span className={styles.beltSubText}>
                            {weeklyBeltLock.variant === "ple"
                              ? `Weekly title hold · after this PLE, before Raw (${formatShortDate(weeklyBeltLock.nextRawDate)})`
                              : weeklyBeltLock.variant === "nxt"
                                ? `Weekly title hold · after NXT, before Raw (${formatShortDate(weeklyBeltLock.nextRawDate)})`
                                : `Weekly title hold · after SmackDown, before Raw (${formatShortDate(weeklyBeltLock.nextRawDate)})`}
                          </span>
                        </div>
                      )}
                      {monthEndBelt && (
                        <div
                          className={styles.beltSubline}
                          title="End-of-month title hold points"
                        >
                          <span className={styles.beltSubBadge}>Belt</span>
                          <span className={styles.beltSubText}>
                            Month-end ({monthEndBelt.beltMonthLabel}) · credited{" "}
                            {formatShortDate(monthEndBelt.creditDate)}
                          </span>
                        </div>
                      )}
                      {pleFinaleBelt && (
                        <div
                          className={styles.beltSubline}
                          title="Title hold points after the final PLE of this arc"
                        >
                          <span className={styles.beltSubBadge}>Belt</span>
                          <span className={styles.beltSubText}>
                            {pleFinaleBelt.seasonEndBeltHold
                              ? `Season-end belt hold (holders after ${pleFinaleBelt.label} Night 2) · ${formatShortDate(pleFinaleBelt.date)}`
                              : `${pleFinaleBelt.label} finale · after ${formatShortDate(pleFinaleBelt.date)}`}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </nav>
  );
}
