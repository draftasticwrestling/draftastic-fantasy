import type { BeltKey } from "@/lib/howItWorksImages";
import { BELT_IMAGE_URLS } from "@/lib/howItWorksImages";
import { formatMoWkBeltPoints } from "./HowItWorksTitlePoints";
import styles from "./HowItWorks.module.css";

export type BeltPointsRow = {
  name: string;
  points: number;
  beltKey?: BeltKey;
};

type Props = {
  mensRows: BeltPointsRow[];
  womensRows: BeltPointsRow[];
};

const BELT_IMG_WIDTH = 56;
const BELT_IMG_HEIGHT = 32;

function BeltCell({ beltKey, titleName }: { beltKey?: BeltKey; titleName: string }) {
  const url = beltKey ? BELT_IMAGE_URLS[beltKey] : undefined;
  if (!url) {
    return <div className={styles.beltPlaceholder}>Belt</div>;
  }
  return (
    <div className={styles.beltImageWrap}>
      <img
        src={url}
        alt={titleName}
        className={styles.beltImage}
        width={BELT_IMG_WIDTH}
        height={BELT_IMG_HEIGHT}
      />
    </div>
  );
}

function DivisionTable({
  division,
  rows,
}: {
  division: "mens" | "womens";
  rows: BeltPointsRow[];
}) {
  const isMens = division === "mens";
  const thTitle = isMens ? styles.titlePointsThMens : styles.titlePointsThWomens;
  const thBelt = isMens ? styles.titlePointsThBeltMens : styles.titlePointsThBeltWomens;
  const thPts = isMens ? styles.titlePointsThPtsMens : styles.titlePointsThPtsWomens;
  const tdName = isMens ? styles.titlePointsTdNameMens : styles.titlePointsTdNameWomens;
  const tdBelt = isMens ? styles.titlePointsTdBeltMens : styles.titlePointsTdBeltWomens;
  const tdPts = isMens ? styles.titlePointsTdPtsMens : styles.titlePointsTdPtsWomens;

  return (
    <div className={styles.titlePointsDivision} data-division={division}>
      <div className={styles.titlePointsHeaderRow}>
        <div className={`${thTitle} ${styles.titlePointsThTitleSpan}`}>
          {isMens ? "Men's Division" : "Women's Division"}
        </div>
        <div className={thPts}>Mo./Wk.</div>
      </div>
      {rows.map((row, i) => {
        const rowAlt = i % 2 === 1 ? styles.titlePointsRowAlt : "";
        return (
          <div key={`${division}-${row.name}`} className={`${styles.titlePointsRow} ${rowAlt}`}>
            <div className={tdBelt}>
              <BeltCell beltKey={row.beltKey} titleName={row.name} />
            </div>
            <div className={tdName}>{row.name}</div>
            <div className={tdPts}>{formatMoWkBeltPoints(row.points)}</div>
          </div>
        );
      })}
    </div>
  );
}

/** Men's + Women's title-holder tables; stacks on narrow screens instead of a broken 6-column grid. */
export function HowItWorksBeltPointsTable({ mensRows, womensRows }: Props) {
  return (
    <div className={styles.titlePointsWrap}>
      <DivisionTable division="mens" rows={mensRows} />
      <DivisionTable division="womens" rows={womensRows} />
    </div>
  );
}
