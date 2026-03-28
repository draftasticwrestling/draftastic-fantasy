import { EventMatchTabs } from "./EventMatchTabs";
import styles from "./EventResults.module.css";

export type EventMatchCardRow = {
  wrestlerKey: string;
  displayName: string;
  points: number;
  breakdown: string[];
  kotrTowardNOC: number;
  isWinner: boolean;
};

export type EventMatchCardProps = {
  order: number;
  contextLabel: string | null;
  isPromo: boolean;
  participantLine: string;
  resultLine: string | null;
  method: string | null;
  titleOutcome: string | null;
  rows: EventMatchCardRow[];
  tabSummary: string | null;
  tabCommentary: string | null;
  tabStatistics: string | null;
  isRSEvent: boolean;
};

export function EventMatchCard({
  order,
  contextLabel,
  isPromo,
  participantLine,
  resultLine,
  method,
  titleOutcome,
  rows,
  tabSummary,
  tabCommentary,
  tabStatistics,
  isRSEvent,
}: EventMatchCardProps) {
  const dual = !isPromo && rows.length === 2;

  return (
    <article
      className={`${styles.matchCard}${isPromo ? ` ${styles.matchCardPromo}` : ""}`}
    >
      <header className={styles.matchCardHead}>
        Match {order}
        {isPromo && (
          <span className={styles.matchCardHeadMuted}>— Promo (no points)</span>
        )}
        {contextLabel && !isPromo && (
          <span className={styles.matchCardHeadContext}>— {contextLabel}</span>
        )}
      </header>
      <div className={styles.matchCardBody}>
        {participantLine ? (
          <p className={styles.matchParticipantLine}>{participantLine}</p>
        ) : null}
        {resultLine ? (
          <p className={styles.matchResultLine}>
            {resultLine}
            {method && !dual ? (
              <span className={styles.matchMethodInline}> · {method}</span>
            ) : null}
          </p>
        ) : method && !resultLine ? (
          <p className={styles.matchResultLine}>
            <span className={styles.matchMethodInline}>{method}</span>
          </p>
        ) : null}
        {titleOutcome && titleOutcome !== "None" ? (
          <p className={styles.matchTitleOutcome}>{titleOutcome}</p>
        ) : null}

        {isPromo ? (
          <p className={styles.matchPromoNote}>
            No fantasy points are awarded for promo segments.
          </p>
        ) : dual ? (
          <div className={styles.matchDual}>
            <div className={`${styles.matchDualSide} ${styles.matchDualSideLeft}`}>
              <div className={styles.matchDualName}>
                {rows[0].isWinner ? (
                  <span className={styles.matchWinnerMark} aria-label="Winner">
                    ▸
                  </span>
                ) : null}
                <span>{rows[0].displayName}</span>
              </div>
              <span className={styles.matchDualPts}>+{rows[0].points}</span>
              {rows[0].kotrTowardNOC > 0 && !isRSEvent ? (
                <span style={{ fontSize: 12, fontWeight: 500, color: "#94a3b8" }}>
                  +{rows[0].kotrTowardNOC} toward NOC
                </span>
              ) : null}
              {rows[0].breakdown.length > 0 ? (
                <ul className={styles.matchBreakdown}>
                  {rows[0].breakdown.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className={styles.matchDualCenter}>
              <div className={styles.matchMethodPill}>
                {method || "—"}
              </div>
            </div>
            <div className={`${styles.matchDualSide} ${styles.matchDualSideRight}`}>
              <div className={styles.matchDualName}>
                <span>{rows[1].displayName}</span>
                {rows[1].isWinner ? (
                  <span className={styles.matchWinnerMark} aria-label="Winner">
                    ◂
                  </span>
                ) : null}
              </div>
              <span className={styles.matchDualPts}>+{rows[1].points}</span>
              {rows[1].kotrTowardNOC > 0 && !isRSEvent ? (
                <span style={{ fontSize: 12, fontWeight: 500, color: "#94a3b8" }}>
                  +{rows[1].kotrTowardNOC} toward NOC
                </span>
              ) : null}
              {rows[1].breakdown.length > 0 ? (
                <ul className={styles.matchBreakdown}>
                  {rows[1].breakdown.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        ) : (
          <div className={styles.matchStack}>
            {rows.map((row) => (
              <div
                key={row.wrestlerKey}
                className={`${styles.matchStackRow}${
                  row.isWinner ? ` ${styles.matchStackRowWinner}` : ""
                }`}
              >
                <div className={styles.matchStackName}>
                  <div className={styles.matchStackNameInner}>
                    {row.isWinner ? (
                      <span className={styles.matchWinnerMark} aria-label="Winner">
                        ▸
                      </span>
                    ) : null}
                    <strong>{row.displayName}</strong>
                  </div>
                  {row.breakdown.length > 0 ? (
                    <ul className={styles.matchBreakdown}>
                      {row.breakdown.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <div className={styles.matchStackPts}>
                  <div>+{row.points}</div>
                  {row.kotrTowardNOC > 0 && !isRSEvent ? (
                    <div style={{ fontSize: 12, fontWeight: 500, color: "#94a3b8" }}>
                      +{row.kotrTowardNOC} toward NOC
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}

        <EventMatchTabs
          summary={tabSummary}
          commentary={tabCommentary}
          statistics={tabStatistics}
        />
      </div>
    </article>
  );
}
