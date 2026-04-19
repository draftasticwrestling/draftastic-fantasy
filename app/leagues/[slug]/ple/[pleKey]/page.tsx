import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment } from "react";
import { getLeagueBySlug, getLeagueMembers, getRostersForLeague } from "@/lib/leagues";
import { getPointsByOwnerForLeagueWithBonuses } from "@/lib/leagueMatchups";
import { factionDisplayName } from "@/lib/factionName";
import { ROAD_TO_SUMMERSLAM_SEASON_SLUG } from "@/lib/leagueStructure";
import {
  isRtsPlePathKey,
  rtsPleDatesForPathKey,
  rtsPleDisplayTitle,
} from "@/lib/pleLeagueMenu";
import { rtsPleAnticipatedAppearanceFloorPts } from "@/lib/howItWorksPoints";
import { fetchPleEventsOnDates, matchesFromEventRow, type PleEventRow } from "@/lib/pleRtsEvents";
import { formatPleDate } from "@/lib/pleUpcoming";
import type { UpcomingMatch } from "@/lib/pleUpcoming";
import styles from "../wrestlemania/PleWrestlemania.module.css";

type Props = { params: Promise<{ slug: string; pleKey: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  const { slug, pleKey } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league || !isRtsPlePathKey(pleKey)) return { title: "PLE — Draftastic Fantasy" };
  const title = rtsPleDisplayTitle(pleKey);
  return {
    title: `${title} — ${league.name} — Draftastic Fantasy`,
    description: `Anticipated points for ${title} using your league roster and announced matches.`,
  };
}

type NightBlock = { nightLabel: string; matches: UpcomingMatch[]; globalIdxStart: number };

export default async function PleRtsSlotPage({ params }: Props) {
  const { slug, pleKey } = await params;
  if (!isRtsPlePathKey(pleKey)) notFound();

  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const seasonSlug = (league as { season_slug?: string | null }).season_slug ?? null;
  if (seasonSlug !== ROAD_TO_SUMMERSLAM_SEASON_SLUG) notFound();

  const dates = rtsPleDatesForPathKey(pleKey);
  const eventRows = await fetchPleEventsOnDates(dates);

  const [members, pointsByOwner, rosters] = await Promise.all([
    getLeagueMembers(league.id),
    getPointsByOwnerForLeagueWithBonuses(league.id),
    getRostersForLeague(league.id),
  ]);

  const pointsByUserId = pointsByOwner ?? {};
  const membersByPoints = [...members].sort(
    (a, b) => (pointsByUserId[b.user_id] ?? 0) - (pointsByUserId[a.user_id] ?? 0)
  );

  const nights: NightBlock[] = [];
  let globalIdx = 0;
  for (const row of eventRows) {
    const m = matchesFromEventRow(row);
    nights.push({
      nightLabel: row.name,
      matches: m,
      globalIdxStart: globalIdx,
    });
    globalIdx += m.length;
  }

  const flatMatches: UpcomingMatch[] = nights.flatMap((n) => n.matches);
  const hasMatches = flatMatches.length > 0;
  const appearancePts = rtsPleAnticipatedAppearanceFloorPts(pleKey);

  const rosterByUser = rosters ?? {};
  const slugSetByUser: Record<string, Set<string>> = {};
  for (const [userId, entries] of Object.entries(rosterByUser)) {
    slugSetByUser[userId] = new Set(entries.map((e) => String(e.wrestler_id).toLowerCase()));
  }

  const pointsGrid: Record<number, Record<string, number>> = {};
  flatMatches.forEach((match, idx) => {
    pointsGrid[idx] = {};
    const matchSlugs = new Set(match.participantSlugs.map((s) => s.toLowerCase()));
    membersByPoints.forEach((mem) => {
      const userSlugs = slugSetByUser[mem.user_id];
      if (!userSlugs) return;
      const rosterCountInMatch = [...matchSlugs].filter((s) => userSlugs.has(s)).length;
      if (rosterCountInMatch > 0) {
        pointsGrid[idx][mem.user_id] = rosterCountInMatch * appearancePts;
      }
    });
  });

  const projectedPleTotalByUserId: Record<string, number> = Object.fromEntries(
    membersByPoints.map((m) => {
      let sum = 0;
      for (let i = 0; i < flatMatches.length; i++) {
        sum += pointsGrid[i]?.[m.user_id] ?? 0;
      }
      return [m.user_id, sum];
    })
  );

  const displayTitle = rtsPleDisplayTitle(pleKey);
  const dateLine =
    eventRows.length > 0
      ? eventRows.map((e) => formatPleDate(e.date)).join(" · ")
      : dates.map((d) => formatPleDate(d)).join(" · ");
  const locationLine =
    eventRows.map((e) => e.location?.trim()).filter(Boolean).join(" · ") || "Location TBD";

  return (
    <main className={styles.plePage}>
      <Link href={`/leagues/${slug}`} className={styles.backLink}>
        ← {league.name}
      </Link>

      <section className={styles.pleHero} aria-label="Event header">
        <p className={styles.pleEventLabel}>Premium Live Event</p>
        <h1 className={styles.pleTitleSrOnly}>{displayTitle}</h1>
        <p className={styles.pleSubtitle} style={{ fontSize: "1.25rem", fontWeight: 700 }}>
          {displayTitle}
        </p>
        <p className={styles.pleMeta}>{locationLine}</p>
        <p className={styles.pleMeta}>{dateLine}</p>
        <p className={styles.pleMeta} style={{ marginTop: 8, fontSize: "0.9rem", opacity: 0.85 }}>
          Anticipated totals use the <strong>non–main event on-card</strong> appearance value from{" "}
          <Link href="/how-it-works?tab=road-to-summerslam">How it Works → Road to SummerSlam</Link> ({appearancePts}{" "}
          pts per roster wrestler listed in a match) until the event is scored.
        </p>
        <hr className={styles.pleDivider} />
      </section>

      <h2 className={styles.pleTableSectionTitle}>Anticipated points</h2>
      {!hasMatches ? (
        <>
          <p className={styles.pleTableSectionSubtitle} role="status">
            No matches announced. Page will be updated once match info is available.
          </p>
          <p className={styles.pleTableSectionSubtitle} style={{ marginTop: 8 }}>
            The table below shows how projections will appear for each announced match and faction.
          </p>
        </>
      ) : (
        <p className={styles.pleTableSectionSubtitle}>
          Card from the event record. Each cell counts {appearancePts} appearance points per roster wrestler listed in
          that match.
        </p>
      )}

      <div className={styles.pleTableWrap}>
        <table className={styles.pleTable}>
          <thead>
            <tr>
              <th className={styles.pleColMatch}>Match</th>
              {membersByPoints.map((m) => (
                <th key={m.user_id}>{factionDisplayName(m, "Team")}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!hasMatches ? (
              <tr>
                <td className={styles.pleColMatch} style={{ fontStyle: "italic", color: "var(--color-text-muted, #666)" }}>
                  (Example row — announced matches will list here)
                </td>
                {membersByPoints.map((m) => (
                  <td key={m.user_id} className={styles.pleColPoints}>
                    —
                  </td>
                ))}
              </tr>
            ) : (
              nights.map((night) => (
                <Fragment key={night.nightLabel}>
                  <tr className={styles.pleNightHeaderRow}>
                    <td colSpan={membersByPoints.length + 1}>{night.nightLabel}</td>
                  </tr>
                  {night.matches.map((match, j) => {
                    const idx = night.globalIdxStart + j;
                    return (
                      <tr key={`${night.nightLabel}-${match.order}-${idx}`}>
                        <td className={styles.pleColMatch}>{match.label}</td>
                        {membersByPoints.map((m) => (
                          <td key={m.user_id} className={styles.pleColPoints}>
                            {pointsGrid[idx]?.[m.user_id] ?? "—"}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </Fragment>
              ))
            )}
            {hasMatches && membersByPoints.length > 0 && flatMatches.length > 0 && (
              <tr className={styles.pleTableTotalRow}>
                <td className={styles.pleColMatch}>Projected total (this event)</td>
                {membersByPoints.map((m) => (
                  <td key={m.user_id} className={styles.pleColPoints}>
                    {projectedPleTotalByUserId[m.user_id] ?? 0}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
