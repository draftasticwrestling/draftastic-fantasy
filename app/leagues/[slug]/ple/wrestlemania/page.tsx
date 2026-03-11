import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeagueBySlug, getLeagueMembers } from "@/lib/leagues";
import { getPointsByOwnerForLeagueWithBonuses } from "@/lib/leagueMatchups";
import {
  getUpcomingWrestleManiaEvents,
  formatPleDate,
} from "@/lib/pleUpcoming";
import styles from "./PleWrestlemania.module.css";

/** Fallback when no upcoming WrestleMania events exist in Supabase yet. */
const FALLBACK_MATCHES = [
  "Undisputed WWE Championship: Cody Rhodes (c) vs. Randy Orton",
  "WWE Women's Championship: Jade Cargill (c) vs. Rhea Ripley",
  "World Heavyweight Championship: CM Punk (c) vs. Roman Reigns",
  "Women's World Championship: Stephanie Vaquer (c) vs. Liv Morgan",
  "Brock Lesnar vs. TBD",
];
const FALLBACK_TITLE = "WRESTLEMANIA";
const FALLBACK_SUBTITLE = "VEGAS";
const FALLBACK_LOCATION = "Las Vegas, NV";
const FALLBACK_DATE = "Saturday & Sunday, April 5–6, 2026";

type Props = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) return { title: "WrestleMania — Draftastic Fantasy" };
  return {
    title: `WrestleMania — ${league.name} — Draftastic Fantasy`,
    description: `Premium Live Event: WrestleMania. See confirmed matches and anticipated points for your league.`,
  };
}

export default async function PleWrestlemaniaPage({ params }: Props) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const [members, pointsByOwner, upcomingEvents] = await Promise.all([
    getLeagueMembers(league.id),
    getPointsByOwnerForLeagueWithBonuses(league.id),
    getUpcomingWrestleManiaEvents(),
  ]);

  const pointsByUserId = pointsByOwner ?? {};
  const membersByPoints = [...members].sort(
    (a, b) => (pointsByUserId[b.user_id] ?? 0) - (pointsByUserId[a.user_id] ?? 0)
  );

  // Use Boxscore upcoming events when available; otherwise fallback copy
  const hasUpcoming = upcomingEvents.length > 0;
  const firstEvent = hasUpcoming ? upcomingEvents[0] : null;
  const allMatches = hasUpcoming
    ? upcomingEvents.flatMap((e) => e.matches)
    : [];
  const matchLabels = allMatches.length > 0
    ? allMatches.map((m) => m.label)
    : FALLBACK_MATCHES;

  const heroTitle = (firstEvent?.name?.toUpperCase().replace(/\s+NIGHT\s+\d/i, "").trim()) ?? FALLBACK_TITLE;
  const heroSubtitle = firstEvent?.name?.match(/night\s+(\d)/i)
    ? `NIGHT ${firstEvent.name.match(/night\s+(\d)/i)?.[1] ?? ""}`
    : hasUpcoming && upcomingEvents.length > 1
      ? `${upcomingEvents.length} NIGHTS`
      : FALLBACK_SUBTITLE;
  const heroLocation = firstEvent?.location?.trim() || FALLBACK_LOCATION;
  const heroDate = hasUpcoming
    ? upcomingEvents.map((e) => formatPleDate(e.date)).join(" & ")
    : FALLBACK_DATE;

  /** Anticipated points: matchIndex -> userId -> points. Filled when we have event/match scoring. */
  const pointsGrid: Record<number, Record<string, number>> = {};

  return (
    <main className={styles.plePage}>
      <Link href={`/leagues/${slug}`} className={styles.backLink}>
        ← {league.name}
      </Link>

      <section className={styles.pleHero} aria-label="Event header">
        <p className={styles.pleEventLabel}>Premium Live Event</p>
        <h1 className={styles.pleTitle}>{heroTitle}</h1>
        <p className={styles.pleSubtitle}>{heroSubtitle}</p>
        <p className={styles.pleMeta}>{heroLocation}</p>
        <p className={styles.pleMeta}>{heroDate}</p>
        {hasUpcoming && (
          <p className={styles.pleMeta} style={{ marginTop: 8, fontSize: "0.85rem", opacity: 0.8 }}>
            Match card from Pro Wrestling Boxscore
          </p>
        )}
        <hr className={styles.pleDivider} />
      </section>

      <h2 className={styles.pleTableSectionTitle}>Anticipated points</h2>
      <p className={styles.pleTableSectionSubtitle}>
        As matches are confirmed for WrestleMania, they appear below. Points show what each team would earn from that match based on their roster.
      </p>

      <div className={styles.pleTableWrap}>
        <table className={styles.pleTable}>
          <thead>
            <tr>
              <th className={styles.pleColMatch}>Match</th>
              {membersByPoints.map((m) => (
                <th key={m.user_id}>
                  {(m.team_name?.trim() || m.display_name?.trim() || "Team").trim() || "Team"}
                  <div className={styles.pleMemberTotal}>
                    {(pointsByUserId[m.user_id] ?? 0)} pts
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matchLabels.length === 0 ? (
              <tr>
                <td colSpan={membersByPoints.length + 1} className={styles.noMatches}>
                  No confirmed matches yet. Check back as the card is announced on Pro Wrestling Boxscore.
                </td>
              </tr>
            ) : (
              matchLabels.map((matchLabel, idx) => (
                <tr key={idx}>
                  <td className={styles.pleColMatch}>{matchLabel}</td>
                  {membersByPoints.map((m) => (
                    <td key={m.user_id} className={styles.pleColPoints}>
                      {pointsGrid[idx]?.[m.user_id] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))
            )}
            {membersByPoints.length > 0 && matchLabels.length > 0 && (
              <tr className={styles.pleTableTotalRow}>
                <td className={styles.pleColMatch}>Total (season)</td>
                {membersByPoints.map((m) => (
                  <td key={m.user_id} className={styles.pleColPoints}>
                    {pointsByUserId[m.user_id] ?? 0}
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
