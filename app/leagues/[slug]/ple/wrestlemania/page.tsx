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
import {
  getUpcomingWrestleManiaEvents,
  formatPleDate,
} from "@/lib/pleUpcoming";
import { EVENT_LOGO_URLS } from "@/lib/howItWorksImages";
import { pleHrefForEntry, pleNavEntriesForSeasonSlug } from "@/lib/pleLeagueMenu";
import styles from "./PleWrestlemania.module.css";
import { PlePicker } from "../PlePicker";

/**
 * WrestleMania floor projections (on the card / main-eventing, no win bonus).
 * Matches published rules: /points, how-it-works, and pointsCalculator WM blocks.
 */
const WM_UNDERCARD_APPEARANCE_PTS = 8;
const WM_NIGHT1_MAIN_EVENT_APPEARANCE_PTS = 25;
const WM_NIGHT2_MAIN_EVENT_APPEARANCE_PTS = 30;

type WmMatch = { label: string; participantSlugs: string[]; projectedPts: number };
type WmNight = { nightLabel: string; matches: WmMatch[] };

/**
 * Curated WrestleMania card with night assignment (labels + roster slugs).
 * Table always uses this; Supabase is used for hero date/location when available.
 */
const WRESTLEMANIA_NIGHTS: WmNight[] = [
  {
    nightLabel: "WrestleMania — Night 1",
    matches: [
      {
        label: "Women's World Championship: Stephanie Vaquer vs. Liv Morgan",
        participantSlugs: ["stephanie-vaquer", "liv-morgan"],
        projectedPts: WM_UNDERCARD_APPEARANCE_PTS,
      },
      {
        label: "Women's Intercontinental Championship: AJ Lee vs. Becky Lynch",
        participantSlugs: ["aj-lee", "becky-lynch"],
        projectedPts: WM_UNDERCARD_APPEARANCE_PTS,
      },
      {
        label: "Unsanctioned match: Drew McIntyre vs. Jacob Fatu",
        participantSlugs: ["drew-mcintyre", "jacob-fatu"],
        projectedPts: WM_UNDERCARD_APPEARANCE_PTS,
      },
      {
        label: "Seth Rollins vs. Gunther",
        participantSlugs: ["seth-rollins", "gunther"],
        projectedPts: WM_UNDERCARD_APPEARANCE_PTS,
      },
      {
        label:
          "Women's Tag Team Championship — fatal 4-way: The Irresistible Forces (Nia Jax & Lash Legend) vs. The Bella Twins (Nikki Bella & Brie Bella) vs. Allies of Convenience (Charlotte Flair & Alexa Bliss) vs. Bayley & Lyra Valkyria",
        participantSlugs: [
          "nia-jax",
          "lash-legend",
          "nikki-bella",
          "brie-bella",
          "charlotte-flair",
          "alexa-bliss",
          "bayley",
          "lyra-valkyria",
        ],
        projectedPts: WM_UNDERCARD_APPEARANCE_PTS,
      },
      {
        label:
          "6-man tag: The Vision (Logan Paul & Austin Theory) & IShowSpeed vs. The Usos (Jey Uso & Jimmy Uso) & LA Knight",
        participantSlugs: [
          "logan-paul",
          "austin-theory",
          "ishowspeed",
          "jey-uso",
          "jimmy-uso",
          "la-knight",
        ],
        projectedPts: WM_UNDERCARD_APPEARANCE_PTS,
      },
      {
        label: "Night 1 main event — Undisputed WWE Championship: Cody Rhodes vs. Randy Orton",
        participantSlugs: ["cody-rhodes", "randy-orton"],
        projectedPts: WM_NIGHT1_MAIN_EVENT_APPEARANCE_PTS,
      },
    ],
  },
  {
    nightLabel: "WrestleMania — Night 2",
    matches: [
      {
        label: "Brock Lesnar vs. Oba Femi",
        participantSlugs: ["brock-lesnar", "oba-femi"],
        projectedPts: WM_UNDERCARD_APPEARANCE_PTS,
      },
      {
        label: "WWE Women's Championship: Jade Cargill vs. Rhea Ripley",
        participantSlugs: ["jade-cargill", "rhea-ripley"],
        projectedPts: WM_UNDERCARD_APPEARANCE_PTS,
      },
      {
        label: "Dominik Mysterio vs. Finn Bálor",
        participantSlugs: ["dominik-mysterio", "finn-balor"],
        projectedPts: WM_UNDERCARD_APPEARANCE_PTS,
      },
      {
        label:
          "Men's Intercontinental Championship — ladder match: Penta vs. Rusev vs. Je'Von Evans vs. Dragon Lee vs. JD McDonagh vs. Rey Mysterio",
        participantSlugs: [
          "penta",
          "rusev",
          "jevon-evans",
          "dragon-lee",
          "jd-mcdonagh",
          "rey-mysterio",
        ],
        projectedPts: WM_UNDERCARD_APPEARANCE_PTS,
      },
      {
        label: "Men's United States Championship: Sami Zayn vs. Trick Williams",
        participantSlugs: ["sami-zayn", "trick-williams"],
        projectedPts: WM_UNDERCARD_APPEARANCE_PTS,
      },
      {
        label: "Night 2 main event — World Heavyweight Championship: CM Punk vs. Roman Reigns",
        participantSlugs: ["cm-punk", "roman-reigns"],
        projectedPts: WM_NIGHT2_MAIN_EVENT_APPEARANCE_PTS,
      },
    ],
  },
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

  const [members, pointsByOwner, upcomingEvents, rostersData] = await Promise.all([
    getLeagueMembersWithAdminFallback(league.id),
    getPointsByOwnerForLeagueWithBonuses(league.id),
    getUpcomingWrestleManiaEvents(),
    getRostersForLeague(league.id),
  ]);
  let rosters = rostersData;
  if (Object.keys(rostersData).length === 0 && members.length > 0) {
    const adminRosters = await getRostersForLeagueAdmin(league.id);
    if (Object.keys(adminRosters).length > 0) rosters = adminRosters;
  }

  const pointsByUserId = pointsByOwner ?? {};
  const membersByPoints = [...members].sort(
    (a, b) => (pointsByUserId[b.user_id] ?? 0) - (pointsByUserId[a.user_id] ?? 0)
  );

  const hasUpcoming = upcomingEvents.length > 0;
  const firstEvent = hasUpcoming ? upcomingEvents[0] : null;

  const allMatches: WmMatch[] = WRESTLEMANIA_NIGHTS.flatMap((n) => n.matches);

  const heroTitle = (firstEvent?.name?.toUpperCase().replace(/\s+NIGHT\s+\d/i, "").trim()) ?? FALLBACK_TITLE;
  const heroSubtitle = FALLBACK_SUBTITLE;
  const heroLocation = firstEvent?.location?.trim() || FALLBACK_LOCATION;
  const heroDate = hasUpcoming
    ? upcomingEvents.map((e) => formatPleDate(e.date)).join(" & ")
    : FALLBACK_DATE;

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
      const rosterCountInMatch = [...matchSlugs].filter((slug) => userSlugs.has(slug)).length;
      if (rosterCountInMatch > 0) {
        pointsGrid[idx][m.user_id] = rosterCountInMatch * match.projectedPts;
      }
    });
  });

  const projectedPleTotalByUserId: Record<string, number> = Object.fromEntries(
    membersByPoints.map((m) => {
      let sum = 0;
      for (let i = 0; i < allMatches.length; i++) {
        sum += pointsGrid[i]?.[m.user_id] ?? 0;
      }
      return [m.user_id, sum];
    })
  );

  const wrestlemaniaLogoUrl = EVENT_LOGO_URLS.wrestlemania;
  const seasonSlug = (league as { season_slug?: string | null }).season_slug ?? null;
  const pleOptions = pleNavEntriesForSeasonSlug(seasonSlug).map((entry) => ({
    href: pleHrefForEntry(slug, entry),
    label: entry.label,
  }));
  const currentHref = `/leagues/${encodeURIComponent(slug)}/ple/wrestlemania`;

  let nextGlobalIdx = 0;
  const nightsWithIndices = WRESTLEMANIA_NIGHTS.map((night) => ({
    nightLabel: night.nightLabel,
    matches: night.matches.map((match) => ({ match, globalIdx: nextGlobalIdx++ })),
  }));

  return (
    <main className={styles.plePage}>
      <Link href={`/leagues/${slug}`} className={styles.backLink}>
        ← League
      </Link>
      <PlePicker valueHref={currentHref} options={pleOptions} label="PLE" />

      <section className={styles.pleHero} aria-label="Event header">
        <p className={styles.pleEventLabel}>Premium Live Event</p>
        {wrestlemaniaLogoUrl && (
          <div className={styles.pleHeroLogo}>
            <img src={wrestlemaniaLogoUrl} alt="WrestleMania" loading="lazy" />
          </div>
        )}
        <h1 className={styles.pleTitleSrOnly}>{heroTitle}</h1>
        <p className={styles.pleSubtitle}>{heroSubtitle}</p>
        <p className={styles.pleMeta}>{heroLocation}</p>
        <p className={styles.pleMeta}>{heroDate}</p>
        <p className={styles.pleMeta} style={{ marginTop: 8, fontSize: "0.9rem", opacity: 0.85 }}>
          Night 1 &amp; 2 below. Projected points follow WrestleMania rules: {WM_UNDERCARD_APPEARANCE_PTS}&nbsp;pts on the
          card (non–main event), {WM_NIGHT1_MAIN_EVENT_APPEARANCE_PTS}&nbsp;pts for Night&nbsp;1 main event,{" "}
          {WM_NIGHT2_MAIN_EVENT_APPEARANCE_PTS}&nbsp;pts for Night&nbsp;2 main event — appearance only (no win bonus).
        </p>
        {hasUpcoming && (
          <p className={styles.pleMeta} style={{ marginTop: 4, fontSize: "0.85rem", opacity: 0.8 }}>
            Event date and location from Pro Wrestling Boxscore
          </p>
        )}
        <hr className={styles.pleDivider} />
      </section>

      <h2 className={styles.pleTableSectionTitle}>Anticipated points</h2>
      <p className={styles.pleTableSectionSubtitle}>
        Card by night. Each cell is appearance points for every roster wrestler in that match (e.g. both Night&nbsp;2
        main-event wrestlers on your roster = {WM_NIGHT2_MAIN_EVENT_APPEARANCE_PTS}&nbsp;×&nbsp;2). Undercard{" "}
        {WM_UNDERCARD_APPEARANCE_PTS}; Night&nbsp;1 main {WM_NIGHT1_MAIN_EVENT_APPEARANCE_PTS}; Night&nbsp;2 main{" "}
        {WM_NIGHT2_MAIN_EVENT_APPEARANCE_PTS}. Win, title, and DQ adjustments apply after the event.
      </p>

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
            {allMatches.length === 0 ? (
              <tr>
                <td colSpan={membersByPoints.length + 1} className={styles.noMatches}>
                  No matches configured.
                </td>
              </tr>
            ) : (
              nightsWithIndices.map((night) => (
                <Fragment key={night.nightLabel}>
                  <tr className={styles.pleNightHeaderRow}>
                    <td colSpan={membersByPoints.length + 1}>{night.nightLabel}</td>
                  </tr>
                  {night.matches.map(({ match, globalIdx }) => (
                    <tr key={`${night.nightLabel}-${globalIdx}`}>
                      <td className={styles.pleColMatch}>{match.label}</td>
                      {membersByPoints.map((m) => (
                        <td key={m.user_id} className={styles.pleColPoints}>
                          {pointsGrid[globalIdx]?.[m.user_id] ?? "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))
            )}
            {membersByPoints.length > 0 && allMatches.length > 0 && (
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
