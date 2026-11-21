import Link from "next/link";
import {
  SALARY_CAP_BUDGET_DEFAULT,
  SALARY_CAP_COST_TIERS,
  SALARY_CAP_MAX_ROSTER_SIZE,
} from "@/lib/leagueStructure";
import { PUBLIC_SALARY_CAP_SEASON_WEEKS } from "@/lib/leagueSeasons";
import { FA_SALARY_CAP_WEEKLY_BUDGET } from "@/lib/salaryCapWeeklyLimits";
import { HowItWorksMainRosterEventScoring } from "./HowItWorksMainRosterEventScoring";
import { HowItWorksNxtScoring } from "./HowItWorksNxtScoring";
import { HowItWorksTitlePoints } from "./HowItWorksTitlePoints";
import styles from "./HowItWorks.module.css";

/**
 * Scoring and roster rules for public Salary Cap — Total Season Points leagues.
 */
export function HowItWorksPublicLeague() {
  return (
    <>
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: "1.35rem", marginBottom: 12 }}>Public league format</h2>
        <p style={{ marginBottom: 12, lineHeight: 1.65, color: "#333" }}>
          New public leagues use <strong>Salary Cap — Head-to-Head</strong>. You still build a $100 roster from the
          shared pool. Each week your faction plays one matchup, and the standings follow win-loss record. Season point
          totals are shown beside that record and break a tied week, and a tied playoff seed.
        </p>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.65, color: "#333" }}>
          <li>
            <strong>4 to 8 factions</strong> — enrollment closes at the start of Monday RAW (5:00 PM Pacific), or when
            the league reaches 8 factions.
          </li>
          <li>
            <strong>Minimum four factions</strong> — if fewer than four teams have a roster when Monday RAW starts,
            enrollment stays open another week. At RAW, the league locks at however many factions are in (4 through 8)
            and the matchups and playoffs use that size.
          </li>
          <li>
            After joining, build your <strong>$100 salary cap roster</strong> from the shared pool (no draft).
          </li>
          <li>
            Scoring begins that Monday RAW and runs for <strong>{PUBLIC_SALARY_CAP_SEASON_WEEKS} Monday–Sunday weeks</strong>.
          </li>
          <li>
            Wrestler prices are <strong>locked when your league is created</strong>. Global prices refresh on the 1st of
            each month (Pacific time) and apply only to leagues created after that refresh.
          </li>
          <li>
            When a public league closes for scoring, the next manager to join starts a <strong>new public league</strong>.
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 className={styles.sectionTitle}>Roster rules</h2>

        <h3 style={{ fontSize: "1.15rem", marginBottom: 8, marginTop: 0 }}>Building your roster</h3>
        <p style={{ marginBottom: 16, lineHeight: 1.65, color: "#333" }}>
          Each faction has a <strong>${SALARY_CAP_BUDGET_DEFAULT}</strong> season budget. Wrestlers cost $
          {SALARY_CAP_COST_TIERS.join(", $")}. You may roster up to <strong>{SALARY_CAP_MAX_ROSTER_SIZE}</strong>{" "}
          wrestlers. NXT is included in the pool. Wrestlers are <strong>not exclusive</strong> — multiple factions can
          roster the same wrestler.
        </p>
        <p style={{ marginBottom: 16, lineHeight: 1.65, color: "#333" }}>
          On the 1st, a wrestler gets the highest price any rule reaches. Inactive wrestlers are not priced. Every
          main-roster wrestler is at least $10. NXT-roster wrestlers are $5, except the NXT Champion and the NXT
          Women&apos;s Champion, who are $10. This year, 10 or more matches and 90 or more points is $15, and 10 or more
          matches and 150 or more points is $20. The last 90 days can raise a thin year: 6 or more matches and 50 or
          more points is $15, and 6 or more matches and 80 or more points is $20. A main-event run in those 90 days is
          $15 when there are 5 or more matches, at least 5 of them main events, and at least 6 points per match. An
          all-time average of 12 or more points per match, across at least 10 matches, is $20. Current Raw, SmackDown,
          and Women&apos;s Tag Team champions are $15. A men&apos;s or women&apos;s US or Intercontinental reign in the
          last 90 days is at least $15, and the current champion is $20. A world-title reign in the last 90 days is $20,
          and the current world champion is $25. A title match that did not start a reign does not set the price. The
          same match and point rules can raise an NXT wrestler.
        </p>

        <h3 style={{ fontSize: "1.15rem", marginBottom: 8, marginTop: 0 }}>In-season adds and drops</h3>
        <p style={{ marginBottom: 12, lineHeight: 1.65, color: "#333" }}>
          Use <strong>Add / Drop</strong> on your faction page to release wrestlers and sign free agents. You must stay
          within your season salary cap and roster size.
        </p>
        <p style={{ marginBottom: 0, lineHeight: 1.65, color: "#333" }}>
          Each faction may spend up to <strong>${FA_SALARY_CAP_WEEKLY_BUDGET}</strong> of salary on adds and up to $
          {FA_SALARY_CAP_WEEKLY_BUDGET} on drops per <strong>Pacific Time week</strong> (Monday through Sunday). There
          are no trades in public salary cap leagues.
        </p>
      </section>

      <HowItWorksTitlePoints />

      <HowItWorksMainRosterEventScoring
        intro={
          <>
            <h2 className={styles.sectionTitle} style={{ marginTop: 0 }}>
              Event scoring
            </h2>
            <p style={{ marginBottom: 12 }}>
              Wrestler event scoring matches Total Season Points leagues. Raw, SmackDown, WWE Main Event, NXT, and PLE
              appearance and win bonuses apply for events in your league window. Only events on or after your league start
              date count.
            </p>
            <p style={{ marginBottom: 0 }}>
              Your {PUBLIC_SALARY_CAP_SEASON_WEEKS}-week window may include any combination of minor, medium, and major PLEs
              on the calendar — not a fixed Road to arc. The tables below list points for every event type; use your league
              timeline to see which ones fall in your season.
            </p>
          </>
        }
      />

      <HowItWorksNxtScoring
        sectionContext={
          <>
            Public leagues always include <strong>NXT wrestlers, events, and belts</strong>. NXT scoring below applies for
            every NXT show and PLE in your league window.
          </>
        }
        beltContext={
          <>
            For public salary cap leagues.{" "}
          </>
        }
      />

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.35rem", marginBottom: 12 }}>Point categories</h2>
        <p>
          Each wrestler&apos;s total for a match is the sum of: <strong>Match points</strong> (appearance + win),{" "}
          <strong>Main event points</strong>, <strong>Belt points</strong>, <strong>Special points</strong> (Rumble, War Games,
          Chamber, MITB, etc.), and <strong>Battle royal points</strong>.
        </p>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: "1.35rem", marginBottom: 12 }}>Private leagues</h2>
        <p style={{ margin: 0, lineHeight: 1.65, color: "#333" }}>
          Private leagues still use our <strong>Road to</strong> season windows (for example Road to SummerSlam) with
          draft-based rosters. See the other tabs on this page for those formats.
        </p>
        <p style={{ marginTop: 12, marginBottom: 0 }}>
          <Link href="/leagues/new">Create a league</Link>
        </p>
      </section>

      <p style={{ marginTop: 24 }}>
        <Link href="/points">Full Points System</Link> for the complete breakdown. <Link href="/event-results">Event Results</Link>{" "}
        to see points in action.
      </p>
    </>
  );
}
