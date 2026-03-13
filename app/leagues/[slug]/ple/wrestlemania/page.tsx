import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeagueBySlug, getLeagueMembers, getRostersForLeague } from "@/lib/leagues";
import { getPointsByOwnerForLeagueWithBonuses } from "@/lib/leagueMatchups";
import {
  getUpcomingWrestleManiaEvents,
  formatPleDate,
} from "@/lib/pleUpcoming";
import { EVENT_LOGO_URLS } from "@/lib/howItWorksImages";
import styles from "./PleWrestlemania.module.css";

/** Minimum appearance points (non-main event) until main events and night assignment are known. */
const ASSUMED_APPEARANCE_PTS = 8;

/** Fallback when no upcoming WrestleMania events exist in Supabase yet. */
const FALLBACK_MATCHES: { label: string; participantSlugs: string[] }[] = [
  { label: "Undisputed WWE Championship: Cody Rhodes (c) vs. Randy Orton", participantSlugs: ["cody-rhodes", "randy-orton"] },
  { label: "WWE Women's Championship: Jade Cargill (c) vs. Rhea Ripley", participantSlugs: ["jade-cargill", "rhea-ripley"] },
  { label: "World Heavyweight Championship: CM Punk (c) vs. Roman Reigns", participantSlugs: ["cm-punk", "roman-reigns"] },
  { label: "Women's World Championship: Stephanie Vaquer (c) vs. Liv Morgan", participantSlugs: ["stephanie-vaquer", "liv-morgan"] },
  { label: "Brock Lesnar vs. TBD", participantSlugs: ["brock-lesnar"] },
];
const FALLBACK_TITLE = "WRESTLEMANIA";
const FALLBACK_SUBTITLE = "NIGHT 1 & 2";
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

  const [members, pointsByOwner, upcomingEvents, rosters] = await Promise.all([
    getLeagueMembers(league.id),
    getPointsByOwnerForLeagueWithBonuses(league.id),
    getUpcomingWrestleManiaEvents(),
    getRostersForLeague(league.id),
  ]);

  const pointsByUserId = pointsByOwner ?? {};
  const membersByPoints = [...members].sort(
    (a, b) => (pointsByUserId[b.user_id] ?? 0) - (pointsByUserId[a.user_id] ?? 0)
  );

  // Combined Night 1 & 2 card until nights are assigned
  const hasUpcoming = upcomingEvents.length > 0;
  const firstEvent = hasUpcoming ? upcomingEvents[0] : null;
  const allMatches: { label: string; participantSlugs: string[] }[] = hasUpcoming
    ? upcomingEvents.flatMap((e) => e.matches).map((m) => ({ label: m.label, participantSlugs: m.participantSlugs }))
    : FALLBACK_MATCHES;

  const heroTitle = (firstEvent?.name?.toUpperCase().replace(/\s+NIGHT\s+\d/i, "").trim()) ?? FALLBACK_TITLE;
  const heroSubtitle = FALLBACK_SUBTITLE; // "Night 1 & 2" combined until we know which matches are which night
  const heroLocation = firstEvent?.location?.trim() || FALLBACK_LOCATION;
  const heroDate = hasUpcoming
    ? upcomingEvents.map((e) => formatPleDate(e.date)).join(" & ")
    : FALLBACK_DATE;

  // Assume 8 pts (non-main event appearance) per participant until main events and night assignment are known
  const pointsGrid: Record<number, Record<string, number>> = {};
  const rosterByUser = rosters ?? {};
  const slugSetByUser: Record<string, Set<string>> = {};
  for (const [userId, entries] of Object.entries(rosterByUser)) {
    slugSetByUser[userId] = new Set(entries.map((e) => String(e.wrestler_id).toLowerCase()));
  }
  allMatches.forEach((match, idx) => {
    pointsGrid[idx] = {};
    const matchSlugs = new Set(match.participantSlugs.map((s) => s.toLowerCase()));
    membersByPoints.forEach((m) => {
      const userSlugs = slugSetByUser[m.user_id];
      if (!userSlugs) return;
      const hasParticipant = [...matchSlugs].some((slug) => userSlugs.has(slug));
      if (hasParticipant) pointsGrid[idx][m.user_id] = ASSUMED_APPEARANCE_PTS;
    });
  });

  const wrestlemaniaLogoUrl = EVENT_LOGO_URLS.wrestlemania;

  return (
    <main className={styles.plePage}>
      <Link href={`/leagues/${slug}`} className={styles.backLink}>
        ← {league.name}
      </Link>

      <section className={styles.pleHero} aria-label="Event header">
        <p className={styles.pleEventLabel}>Premium Live Event</p>
        {wrestlemaniaLogoUrl && (
          <div className={styles.pleHeroLogo}>
            <img src={wrestlemaniaLogoUrl} alt="WrestleMania" loading="lazy" />
          </div>
        )}
        <h1 className={styles.pleTitle}>{heroTitle}</h1>
        <p className={styles.pleSubtitle}>{heroSubtitle}</p>
        <p className={styles.pleMeta}>{heroLocation}</p>
        <p className={styles.pleMeta}>{heroDate}</p>
        <p className={styles.pleMeta} style={{ marginTop: 8, fontSize: "0.9rem", opacity: 0.85 }}>
          Combined card (Night 1 &amp; 2). Match nights and main events TBD.
        </p>
        {hasUpcoming && (
          <p className={styles.pleMeta} style={{ marginTop: 4, fontSize: "0.85rem", opacity: 0.8 }}>
            Match card from Pro Wrestling Boxscore
          </p>
        )}
        <hr className={styles.pleDivider} />
      </section>

      <h2 className={styles.pleTableSectionTitle}>Anticipated points</h2>
      <p className={styles.pleTableSectionSubtitle}>
        Matches confirmed for WrestleMania appear below. Until main events and night assignment are known, we assume each participant earns at least {ASSUMED_APPEARANCE_PTS} pts (non–main event appearance). Once main events and nights are set, we’ll update with full scoring.
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
            {allMatches.length === 0 ? (
              <tr>
                <td colSpan={membersByPoints.length + 1} className={styles.noMatches}>
                  No confirmed matches yet. Check back as the card is announced on Pro Wrestling Boxscore.
                </td>
              </tr>
            ) : (
              allMatches.map((match, idx) => (
                <tr key={idx}>
                  <td className={styles.pleColMatch}>{match.label}</td>
                  {membersByPoints.map((m) => (
                    <td key={m.user_id} className={styles.pleColPoints}>
                      {pointsGrid[idx]?.[m.user_id] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))
            )}
            {membersByPoints.length > 0 && allMatches.length > 0 && (
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
