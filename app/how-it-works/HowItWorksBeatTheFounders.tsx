import Link from "next/link";
import { SALARY_CAP_COST_TIERS, SALARY_CAP_MAX_ROSTER_SIZE } from "@/lib/leagueStructure";
import { HowItWorksNxtScoring } from "./HowItWorksNxtScoring";
import { HowItWorksRoadToWrestleManiaEvents } from "./HowItWorksRoadToWrestleManiaEvents";
import { HowItWorksTitlePoints } from "./HowItWorksTitlePoints";
import styles from "./HowItWorks.module.css";

/** Largest Beat the Founders field. Only the top 8 of these make the playoff. */
const BEAT_THE_FOUNDERS_MAX_TEAMS = 20;
const BEAT_THE_FOUNDERS_PLAYOFF_TEAMS = 8;
/** Season roster budget, and the separate weekly add and drop limits. */
const BEAT_THE_FOUNDERS_BUDGET = 150;
const BEAT_THE_FOUNDERS_WEEKLY_MOVE_BUDGET = 40;

/**
 * Setup and scoring for the special Beat the Founders league:
 * salary-cap head-to-head, up to 20 factions, Road to WrestleMania window, top 8 playoff.
 */
export function HowItWorksBeatTheFounders() {
  return (
    <>
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: "1.35rem", marginBottom: 12 }}>Beat the Founders</h2>
        <p style={{ marginBottom: 12, lineHeight: 1.65, color: "#333" }}>
          <strong>Beat the Founders</strong> is a special <strong>Salary Cap — Head-to-Head</strong> league for Road
          to WrestleMania. It runs from the Raw on <strong>November 30, 2026</strong> through{" "}
          <strong>WrestleMania</strong>. WrestleMania is expected <strong>April 10–11, 2027</strong>. Those dates are
          not announced yet.
        </p>
        <p style={{ marginBottom: 12, lineHeight: 1.65, color: "#333" }}>
          Up to <strong>{BEAT_THE_FOUNDERS_MAX_TEAMS} factions</strong>, including the founder-managed teams, build a
          salary-cap roster from the shared pool. An invitation goes to someone who won a designated public league on
          or before November 15, 2026. You must be at least 18 to play in this contest. Each week you play one
          matchup. The standings follow win-loss-tie record. Your season point total sits beside that record. The{" "}
          <strong>top {BEAT_THE_FOUNDERS_PLAYOFF_TEAMS}</strong> records make the playoff and play for the championship.
          Everyone else is finished when the regular season ends.
        </p>
        <p style={{ marginBottom: 0, lineHeight: 1.65, color: "#333" }}>
          One $100 prize goes to an eligible non-founder who wins the championship. If a founder-managed team wins the
          title, no cash prize is awarded. Eligibility, tiebreakers, and the prize are governed by the{" "}
          <Link href="/beat-the-founders/rules">Official Contest Rules</Link>.
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 className={styles.sectionTitle}>League setup</h2>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.65, color: "#333" }}>
          <li>
            <strong>Format:</strong> Salary Cap — Head-to-Head. No draft. Wrestlers are{" "}
            <strong>not exclusive</strong>, so more than one faction can roster the same wrestler.
          </li>
          <li>
            <strong>Field:</strong> as many as {BEAT_THE_FOUNDERS_MAX_TEAMS} factions.
          </li>
          <li>
            <strong>Budget:</strong> ${BEAT_THE_FOUNDERS_BUDGET} per faction. Wrestlers cost $
            {SALARY_CAP_COST_TIERS.join(", $")}. You may roster up to {SALARY_CAP_MAX_ROSTER_SIZE} wrestlers. NXT is
            included.
          </li>
          <li>
            <strong>Adds and drops:</strong> up to ${BEAT_THE_FOUNDERS_WEEKLY_MOVE_BUDGET} of salary in adds and $
            {BEAT_THE_FOUNDERS_WEEKLY_MOVE_BUDGET} in drops each Pacific week (Monday through Sunday). There are no
            trades.
          </li>
          <li>
            <strong>Weeks:</strong> Monday through Sunday, from November 30 through WrestleMania week. The last three
            weeks are the playoff. WrestleMania week is the championship final.
          </li>
          <li>
            Prices lock when the league is created. A later monthly price refresh does not change this league.
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 className={styles.sectionTitle}>Regular season and playoffs</h2>
        <p style={{ marginBottom: 12, lineHeight: 1.65, color: "#333" }}>
          Every faction plays a head-to-head matchup each regular-season week. The matchup winner is whoever scores more
          fantasy points that week. If both sides score the same, the matchup is a tie.
        </p>
        <p style={{ marginBottom: 12, lineHeight: 1.65, color: "#333" }}>
          After the last regular-season week, the top {BEAT_THE_FOUNDERS_PLAYOFF_TEAMS} records are seeded 1 through{" "}
          {BEAT_THE_FOUNDERS_PLAYOFF_TEAMS}. When records match, the higher standing goes to more season points, then
          the head-to-head record among the tied teams, then the record against the other playoff teams, then a random
          drawing. Factions outside the top {BEAT_THE_FOUNDERS_PLAYOFF_TEAMS} do not play in the postseason.
        </p>
        <p style={{ marginBottom: 0, lineHeight: 1.65, color: "#333" }}>
          Those eight play a three-week single-elimination bracket. Quarterfinals are <strong>1 vs 8</strong>,{" "}
          <strong>4 vs 5</strong>, <strong>2 vs 7</strong>, and <strong>3 vs 6</strong>. The 1/8 winner plays the 4/5
          winner, and the 2/7 winner plays the 3/6 winner. Semifinal winners meet in the championship on WrestleMania
          week. A playoff matchup uses only that week&apos;s points. If a playoff matchup ties, the higher seed
          advances. The bracket winner is the Founders League champion.
        </p>
      </section>

      <HowItWorksTitlePoints />

      <HowItWorksRoadToWrestleManiaEvents
        wrestlemaniaWhen="expected April 10–11"
        championshipNote="WrestleMania week is the championship final."
      />

      <HowItWorksNxtScoring
        sectionContext={
          <>
            Beat the Founders includes <strong>NXT wrestlers, events, and belts</strong>.
          </>
        }
        beltContext={
          <>
            For Beat the Founders. NXT is included.
          </>
        }
      />

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.35rem", marginBottom: 12 }}>Point categories</h2>
        <p>
          Each wrestler&apos;s total for a match is the sum of: <strong>Match points</strong> (appearance + win),{" "}
          <strong>Main event points</strong>, <strong>Belt points</strong>, <strong>Special points</strong> (Rumble,
          Chamber, and other special matches), and <strong>Battle royal points</strong>. Your faction&apos;s week is
          the sum of those wrestlers while they are on your roster.
        </p>
      </section>

      <p style={{ marginTop: 24 }}>
        <Link href="/beat-the-founders/rules">Official Contest Rules</Link>.{" "}
        <Link href="/points">Full Points System</Link> for the complete breakdown.{" "}
        <Link href="/event-results">Event Results</Link> to see points in action.
      </p>
    </>
  );
}
