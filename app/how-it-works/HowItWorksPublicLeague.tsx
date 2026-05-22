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
          Public leagues use <strong>Salary Cap — Total Season Points</strong>. Anyone can join with no team maximum.
          After you create or join, you complete onboarding and build your roster from the shared pool so you can play
          right away.
        </p>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.65, color: "#333" }}>
          <li>
            At least <strong>3 factions</strong> are required before the season is scheduled.
          </li>
          <li>
            When the third faction joins, your league&apos;s season is set to start on the <strong>next Monday</strong>{" "}
            (Pacific Time).
          </li>
          <li>
            The season runs for <strong>{PUBLIC_SALARY_CAP_SEASON_WEEKS} weeks</strong> from that Monday — not tied to a
            Road to SummerSlam or other PLE finale.
          </li>
          <li>
            The season timeline on your league page lists every Raw, SmackDown, NXT, and PLE that falls in that{" "}
            {PUBLIC_SALARY_CAP_SEASON_WEEKS}-week window.
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 className={styles.sectionTitle}>Roster rules</h2>

        <h3 style={{ fontSize: "1.15rem", marginBottom: 8, marginTop: 0 }}>Building your roster</h3>
        <p style={{ marginBottom: 16, lineHeight: 1.65, color: "#333" }}>
          Each faction has a <strong>${SALARY_CAP_BUDGET_DEFAULT}</strong> season budget. Wrestlers cost $
          {SALARY_CAP_COST_TIERS.join(", $")} based on their tier. You may roster up to{" "}
          <strong>{SALARY_CAP_MAX_ROSTER_SIZE}</strong> wrestlers. NXT is included in the pool. Wrestlers are{" "}
          <strong>not exclusive</strong> — multiple factions can roster the same wrestler.
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
              Wrestler event scoring matches Total Season Points leagues. Raw, SmackDown, NXT, and PLE appearance and win
              bonuses apply for events in your league window. Only events on or after your league start date count.
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
