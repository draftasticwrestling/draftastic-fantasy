import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment } from "react";
import {
  getLeagueBySlug,
  getLeagueMembers,
  getLeagueMembersWithAdminFallback,
  getRostersForLeague,
  getRostersForLeagueAdmin,
} from "@/lib/leagues";
import { getPointsByOwnerForLeagueWithBonuses } from "@/lib/leagueMatchups";
import { factionDisplayName } from "@/lib/factionName";
import { ROAD_TO_SUMMERSLAM_SEASON_SLUG } from "@/lib/leagueStructure";
import {
  isRtsPlePathKey,
  pleHrefForEntry,
  pleNavEntriesForSeasonSlug,
  rtsPleDatesForPathKey,
  rtsPleDisplayTitle,
} from "@/lib/pleLeagueMenu";
import { rtsPleAnticipatedAppearanceFloorPts, rtsPleAnticipatedMainEventAppearancePts } from "@/lib/howItWorksPoints";
import { fetchPleEventsOnDates, matchesFromEventRow, type PleEventRow } from "@/lib/pleRtsEvents";
import { formatPleDate } from "@/lib/pleUpcoming";
import type { UpcomingMatch } from "@/lib/pleUpcoming";
import styles from "../wrestlemania/PleWrestlemania.module.css";
import { PlePicker } from "../PlePicker";

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
function formatCardUpdatedAt(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isExplicitMainEvent(match: UpcomingMatch): boolean {
  const raw = (match.raw ?? {}) as Record<string, unknown>;
  const cardType = String(raw.cardType ?? raw.card_type ?? "")
    .trim()
    .toLowerCase();
  if (cardType === "main event") return true;
  if (raw.mainEvent === true || raw.isMainEvent === true) return true;
  return false;
}

function isExplicitUndercard(match: UpcomingMatch): boolean {
  const raw = (match.raw ?? {}) as Record<string, unknown>;
  const cardType = String(raw.cardType ?? raw.card_type ?? "")
    .trim()
    .toLowerCase();
  if (cardType === "undercard") return true;
  if (raw.mainEvent === false || raw.isMainEvent === false) return true;
  return false;
}

function isProjectedMainEvent(match: UpcomingMatch, allMatches: UpcomingMatch[]): boolean {
  if (!allMatches.length) return false;
  if (isExplicitUndercard(match)) return false;
  if (isExplicitMainEvent(match)) return true;
  const maxOrder = Math.max(...allMatches.map((m) => m.order || 0));
  const isClosingMatch = allMatches[allMatches.length - 1] === match;
  const matchesWithMaxOrder = allMatches.filter((m) => (m.order || 0) === maxOrder);
  if (matchesWithMaxOrder.length === allMatches.length) {
    return isClosingMatch;
  }
  return (match.order || 0) === maxOrder || isClosingMatch;
}

export default async function PleRtsSlotPage({ params }: Props) {
  const { slug, pleKey } = await params;
  if (!isRtsPlePathKey(pleKey)) notFound();

  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const seasonSlug = (league as { season_slug?: string | null }).season_slug ?? null;
  if (seasonSlug !== ROAD_TO_SUMMERSLAM_SEASON_SLUG) notFound();

  const dates = rtsPleDatesForPathKey(pleKey);
  const eventRows = await fetchPleEventsOnDates(dates);
  const leagueDraftStatus = String((league as { draft_status?: string | null }).draft_status ?? "not_started");
  const hasDraftedTeams = leagueDraftStatus === "ready_for_review" || leagueDraftStatus === "completed";

  const [members, pointsByOwner, rostersData]: [
    Awaited<ReturnType<typeof getLeagueMembers>>,
    Awaited<ReturnType<typeof getPointsByOwnerForLeagueWithBonuses>>,
    Awaited<ReturnType<typeof getRostersForLeague>>,
  ] = await Promise.all([
    getLeagueMembersWithAdminFallback(league.id),
    getPointsByOwnerForLeagueWithBonuses(league.id),
    hasDraftedTeams ? getRostersForLeague(league.id) : Promise.resolve({} as Awaited<ReturnType<typeof getRostersForLeague>>),
  ]);
  let rosters = rostersData;
  if (hasDraftedTeams && Object.keys(rostersData).length === 0 && members.length > 0) {
    const adminRosters = await getRostersForLeagueAdmin(league.id);
    if (Object.keys(adminRosters).length > 0) rosters = adminRosters;
  }

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
  const eventNameById = new Map(eventRows.map((row) => [row.id, row.name]));

  const rosterByUser = rosters ?? {};
  const slugSetByUser: Record<string, Set<string>> = {};
  for (const [userId, entries] of Object.entries(rosterByUser)) {
    slugSetByUser[userId] = new Set(entries.map((e) => String(e.wrestler_id).toLowerCase()));
  }

  const pointsGrid: Record<number, Record<string, number>> = {};
  flatMatches.forEach((match, idx) => {
    pointsGrid[idx] = {};
    const matchSlugs = new Set(match.participantSlugs.map((s) => s.toLowerCase()));
    const matchAppearancePts = isProjectedMainEvent(match, flatMatches)
      ? rtsPleAnticipatedMainEventAppearancePts(pleKey, { eventName: eventNameById.get(match.eventId) ?? null })
      : appearancePts;
    membersByPoints.forEach((mem) => {
      const userSlugs = slugSetByUser[mem.user_id];
      if (!userSlugs) return;
      const rosterCountInMatch = [...matchSlugs].filter((s) => userSlugs.has(s)).length;
      if (hasDraftedTeams && rosterCountInMatch > 0) {
        pointsGrid[idx][mem.user_id] = rosterCountInMatch * matchAppearancePts;
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
  const latestCardUpdatedAt = eventRows
    .map((row) => row.updated_at)
    .filter((v): v is string => Boolean(v))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  const cardUpdatedLabel = latestCardUpdatedAt ? formatCardUpdatedAt(latestCardUpdatedAt) : "";
  const dateLine =
    eventRows.length > 0
      ? eventRows.map((e) => formatPleDate(e.date)).join(" · ")
      : dates.map((d) => formatPleDate(d)).join(" · ");
  const locationLine =
    eventRows.map((e) => e.location?.trim()).filter(Boolean).join(" · ") || "Location TBD";
  const pleOptions = pleNavEntriesForSeasonSlug(seasonSlug).map((entry) => ({
    href: pleHrefForEntry(slug, entry),
    label: entry.label,
  }));
  const currentHref = `/leagues/${encodeURIComponent(slug)}/ple/${encodeURIComponent(pleKey)}`;

  return (
    <main className={styles.plePage}>
      <Link href={`/leagues/${slug}`} className={styles.backLink}>
        ← League
      </Link>
      <PlePicker valueHref={currentHref} options={pleOptions} label="PLE" />

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
        {!hasDraftedTeams && (
          <p className={styles.pleMeta} style={{ marginTop: 4, fontSize: "0.85rem", opacity: 0.8 }}>
            Projections appear after league draft completes.
          </p>
        )}
        {cardUpdatedLabel && (
          <p className={styles.pleMeta} style={{ marginTop: 4, fontSize: "0.8rem", opacity: 0.78 }}>
            Last updated from event card: {cardUpdatedLabel}
          </p>
        )}
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
          {hasDraftedTeams
            ? `Card from the event record. Non-main matches use ${appearancePts} appearance points per roster wrestler; matches marked main event use main-event appearance points.`
            : "Card from the event record. Draft must be completed before team projections are shown."}
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
                            {hasDraftedTeams ? (pointsGrid[idx]?.[m.user_id] ?? "—") : "—"}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </Fragment>
              ))
            )}
            {hasDraftedTeams && hasMatches && membersByPoints.length > 0 && flatMatches.length > 0 && (
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
