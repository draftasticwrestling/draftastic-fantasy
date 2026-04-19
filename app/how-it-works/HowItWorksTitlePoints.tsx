import { Fragment } from "react";
import type { BeltKey } from "@/lib/howItWorksImages";
import { BELT_IMAGE_URLS } from "@/lib/howItWorksImages";
import {
  BELT_DEFENSE_NEW_CHAMPION_POINTS,
  MENS_BELT_KEYS,
  TITLE_POINTS_MENS,
  TITLE_POINTS_WOMENS,
  WOMENS_BELT_KEYS,
} from "@/lib/howItWorksPoints";
import styles from "./HowItWorks.module.css";

const BELT_IMG_WIDTH = 56;
const BELT_IMG_HEIGHT = 32;
const beltImgStyle = {
  width: BELT_IMG_WIDTH,
  height: BELT_IMG_HEIGHT,
  maxWidth: BELT_IMG_WIDTH,
  maxHeight: BELT_IMG_HEIGHT,
  objectFit: "contain" as const,
  display: "block" as const,
};
const beltWrapStyle = {
  width: BELT_IMG_WIDTH,
  height: BELT_IMG_HEIGHT,
  minWidth: BELT_IMG_WIDTH,
  maxWidth: BELT_IMG_WIDTH,
  minHeight: BELT_IMG_HEIGHT,
  maxHeight: BELT_IMG_HEIGHT,
  overflow: "hidden" as const,
  display: "block" as const,
  flexShrink: 0,
};

export function HowItWorksTitlePoints() {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 className={styles.sectionTitle}>Belt Points</h2>

      <h3 className={styles.beltPointsSubheading}>Weekly belt points</h3>
      <p className={styles.sectionSubtitle}>
        For <strong>Road to SummerSlam</strong> leagues, title-holder points lock at <strong>11:59 PM PT</strong> (Los Angeles
        time) at the end of each TV week: after <strong>SmackDown</strong> and before the next <strong>Raw</strong> when there is
        no PLE that week, or after the last <strong>PLE</strong> in that Monday–Sunday window and before the next Raw when a PLE
        airs that week. The cutoff uses Pacific time so late shows still count before the lock.
      </p>
      <div className={styles.titlePointsGrid}>
        <div className={styles.titlePointsThMens}>Men&apos;s Division</div>
        <div className={styles.titlePointsThBeltMens} aria-hidden />
        <div className={styles.titlePointsThPtsMens}>Points</div>
        <div className={styles.titlePointsThWomens}>Women&apos;s Division</div>
        <div className={styles.titlePointsThBeltWomens} aria-hidden />
        <div className={styles.titlePointsThPtsWomens}>Points</div>
        {TITLE_POINTS_MENS.map((mensRow, i) => {
          const womensRow = TITLE_POINTS_WOMENS[i];
          const rowAlt = i % 2 === 1 ? styles.titlePointsRowAlt : "";
          const mensBeltKey = MENS_BELT_KEYS[i] as BeltKey | undefined;
          const womensBeltKey = WOMENS_BELT_KEYS[i] as BeltKey | undefined;
          const mensBeltUrl = mensBeltKey ? BELT_IMAGE_URLS[mensBeltKey] : undefined;
          const womensBeltUrl = womensBeltKey ? BELT_IMAGE_URLS[womensBeltKey] : undefined;
          return (
            <Fragment key={mensRow.name}>
              <div className={`${styles.titlePointsTdNameMens} ${rowAlt}`}>{mensRow.name}</div>
              <div className={`${styles.titlePointsTdBeltMens} ${rowAlt}`}>
                {mensBeltUrl ? (
                  <div className={styles.beltImageWrap} style={beltWrapStyle}>
                    <img
                      src={mensBeltUrl}
                      alt=""
                      className={styles.beltImage}
                      width={BELT_IMG_WIDTH}
                      height={BELT_IMG_HEIGHT}
                      style={beltImgStyle}
                    />
                  </div>
                ) : (
                  <div className={styles.beltPlaceholder}>Belt</div>
                )}
              </div>
              <div className={`${styles.titlePointsTdPtsMens} ${rowAlt}`}>{mensRow.points}</div>
              <div className={`${styles.titlePointsTdNameWomens} ${rowAlt}`}>{womensRow.name}</div>
              <div className={`${styles.titlePointsTdBeltWomens} ${rowAlt}`}>
                {womensBeltUrl ? (
                  <div className={styles.beltImageWrap} style={beltWrapStyle}>
                    <img
                      src={womensBeltUrl}
                      alt=""
                      className={styles.beltImage}
                      width={BELT_IMG_WIDTH}
                      height={BELT_IMG_HEIGHT}
                      style={beltImgStyle}
                    />
                  </div>
                ) : (
                  <div className={styles.beltPlaceholder}>Belt</div>
                )}
              </div>
              <div className={`${styles.titlePointsTdPtsWomens} ${rowAlt}`}>{womensRow.points}</div>
            </Fragment>
          );
        })}
      </div>

      <h3 className={styles.beltPointsSubheading}>Belt defense / New champion points</h3>
      <p className={styles.sectionSubtitle}>
        Awarded during the match when a championship is defended or changes hands (same values for every title).
      </p>
      <div className={styles.beltDefenseGrid} role="table" aria-label="Belt defense and new champion points">
        <div className={styles.beltDefenseTh} role="columnheader">
          Action
        </div>
        <div className={`${styles.beltDefenseTh} ${styles.beltDefenseThPts}`} role="columnheader">
          Points
        </div>
        {BELT_DEFENSE_NEW_CHAMPION_POINTS.map(([label, pts], i) => (
          <Fragment key={label}>
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
          </Fragment>
        ))}
      </div>
    </section>
  );
}
