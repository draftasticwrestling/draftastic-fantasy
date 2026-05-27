import {
  BELT_DEFENSE_NEW_CHAMPION_POINTS,
  MENS_BELT_KEYS,
  TITLE_POINTS_MENS,
  TITLE_POINTS_WOMENS,
  WOMENS_BELT_KEYS,
} from "@/lib/howItWorksPoints";
import type { BeltKey } from "@/lib/howItWorksImages";
import { HowItWorksBeltPointsTable } from "./HowItWorksBeltPointsTable";
import styles from "./HowItWorks.module.css";

/** Weekly title-holder credit = ¼ of the monthly value shown in How it Works tables. */
export function weeklyBeltHolderPoints(monthly: number): number {
  return monthly / 4;
}

/** Display e.g. `12 / 3` for monthly and weekly title-holder points. */
export function formatMoWkBeltPoints(monthly: number): string {
  const weekly = weeklyBeltHolderPoints(monthly);
  const weeklyLabel = Number.isInteger(weekly) ? String(weekly) : String(weekly);
  return `${monthly} / ${weeklyLabel}`;
}

/** Short note; tables use {@link formatMoWkBeltPoints} in each Mo./Wk. cell. */
export const BELT_HOLDER_MONTHLY_WEEKLY_EXPLAINER = (
  <>
    In each <strong>Mo./Wk.</strong> cell, the first number is the <strong>monthly</strong> belt-holder value and the
    second is what your league credits <strong>each week</strong> (one quarter of the monthly amount) while your wrestler
    holds the title.
  </>
);

const mensBeltRows = TITLE_POINTS_MENS.map((row, i) => ({
  ...row,
  beltKey: MENS_BELT_KEYS[i] as BeltKey | undefined,
}));

const womensBeltRows = TITLE_POINTS_WOMENS.map((row, i) => ({
  ...row,
  beltKey: WOMENS_BELT_KEYS[i] as BeltKey | undefined,
}));

export function HowItWorksTitlePoints() {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 className={styles.sectionTitle}>Belt Points</h2>

      <h3 className={styles.beltPointsSubheading}>Title holder points</h3>
      <p className={styles.sectionSubtitle}>{BELT_HOLDER_MONTHLY_WEEKLY_EXPLAINER}</p>
      <p className={styles.sectionSubtitle}>
        For <strong>Road to SummerSlam</strong> and <strong>Road to War Games</strong> leagues, weekly title-holder
        points lock at <strong>11:59 PM PT</strong> (Los Angeles time) at the end of each TV week: after{" "}
        <strong>SmackDown</strong> and before the next <strong>Raw</strong> when there is no PLE that week, or after the
        last <strong>PLE</strong> in that Monday–Sunday window and before the next Raw when a PLE airs that week. The
        cutoff uses Pacific time so late shows still count before the lock.
      </p>
      <HowItWorksBeltPointsTable mensRows={mensBeltRows} womensRows={womensBeltRows} />

      <h3 className={styles.beltPointsSubheading}>Belt defense / New champion points</h3>
      <p className={styles.sectionSubtitle}>
        These are <strong>match bonuses</strong> (not monthly title-holder points). They are awarded during the match
        when a championship is defended or changes hands — same values for every title, in full at event time.
      </p>
      <div className={styles.beltDefenseGrid} role="table" aria-label="Belt defense and new champion points">
        <div className={styles.beltDefenseTh} role="columnheader">
          Action
        </div>
        <div className={`${styles.beltDefenseTh} ${styles.beltDefenseThPts}`} role="columnheader">
          Points
        </div>
        {BELT_DEFENSE_NEW_CHAMPION_POINTS.map(([label, pts], i) => (
          <div
            key={label}
            className={`${styles.beltDefenseRow} ${i % 2 === 1 ? styles.beltDefenseRowAlt : ""}`}
          >
            <div
              className={`${styles.beltDefenseTd} ${i % 2 === 1 ? styles.beltDefenseTdAlt : ""}`}
              role="cell"
            >
              {label}
            </div>
            <div
              className={`${styles.beltDefenseTdPts} ${i % 2 === 1 ? styles.beltDefenseTdAlt : ""}`}
              role="cell"
            >
              {pts}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
