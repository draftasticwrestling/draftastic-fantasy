import {
  CROWN_JEWEL_POINTS,
  ELIMINATION_CHAMBER_POINTS,
  EVOLUTION_EXTRA_POINTS,
  GENERAL_RULES,
  KING_QUEEN_POINTS,
  MITB_POINTS,
  MINOR_PLE_BASE_POINTS,
  NOC_POINTS,
  RAWSMACKDOWN_POINTS,
  ROYAL_RUMBLE_POINTS,
  SUMMERSLAM_POINTS,
  SURVIVOR_SERIES_POINTS,
  WRESTLEMANIA_POINTS,
} from "@/lib/howItWorksPoints";
import { HowItWorksEventLogo } from "./HowItWorksEventLogo";
import { HowItWorksSpecialMatches } from "./HowItWorksSpecialMatches";
import styles from "./HowItWorks.module.css";

type Props = {
  /** Optional note above Raw/SmackDown (e.g. which events count in a league window). */
  intro?: React.ReactNode;
};

/**
 * Full main-roster scoring reference: Raw/SmackDown, special matches, and every PLE tier.
 */
export function HowItWorksMainRosterEventScoring({ intro }: Props) {
  return (
    <>
      {intro ? (
        <section style={{ marginBottom: 24 }}>
          <div style={{ lineHeight: 1.65, color: "#333" }}>{intro}</div>
        </section>
      ) : null}

      <section style={{ marginBottom: 40 }}>
        <h2 className={styles.sectionTitle}>Raw/Smackdown Points</h2>
        <div className={styles.rulesBlock}>
          {GENERAL_RULES.slice(0, 4).map((text, i) => (
            <p key={i}>{text}</p>
          ))}
        </div>
        <div className={styles.darkBox}>
          <div className={styles.rawSmackdownLogoRow}>
            <HowItWorksEventLogo eventKey="raw" placeholderText="RAW logo" className={styles.eventLogoPlaceholder} />
            <div className={styles.rawSmackdownAmp} aria-hidden>
              &
            </div>
            <HowItWorksEventLogo
              eventKey="smackdown"
              placeholderText="SmackDown logo"
              className={styles.eventLogoPlaceholder}
            />
          </div>
          <p className={styles.rawSmackdownMobileNote}>Same points apply to RAW and SmackDown.</p>
          <div className={styles.rawSmackdownFlex}>
            <div className={styles.rawSmackdownCol}>
              {RAWSMACKDOWN_POINTS.map(([action, pts], i) => (
                <div key={i} className={styles.pointRow}>
                  <span>{action}</span>
                  <span className={styles.pointRowPoints}>{pts}</span>
                </div>
              ))}
            </div>
            <div className={`${styles.rawSmackdownCol} ${styles.rawSmackdownColSecond}`}>
              {RAWSMACKDOWN_POINTS.map(([action, pts], i) => (
                <div key={`sd-${i}`} className={styles.pointRow}>
                  <span>{action}</span>
                  <span className={styles.pointRowPoints}>{pts}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <HowItWorksSpecialMatches variant="legacy" />

      <section style={{ marginBottom: 40 }}>
        <h2 className={styles.sectionTitle}>Major Premium Live Event Points — The &quot;Big Four&quot;</h2>
        <div className={styles.rulesBlock}>
          {GENERAL_RULES.map((text, i) => (
            <p key={i}>{text}</p>
          ))}
        </div>
        <div className={styles.pleDarkBox}>
          <div className={styles.wrestlemaniaBlock}>
            <HowItWorksEventLogo
              eventKey="wrestlemania"
              placeholderText="WrestleMania logo"
              className={styles.wrestlemaniaLogoPlaceholder}
            />
            <div className={styles.majorPleTwoCol}>
              <div>
                {WRESTLEMANIA_POINTS.slice(0, 3).map(([action, pts], i) => (
                  <div key={i} className={styles.pointRow}>
                    <span>{action}</span>
                    <span className={styles.pointRowPoints}>{String(pts)}</span>
                  </div>
                ))}
              </div>
              <div>
                {WRESTLEMANIA_POINTS.slice(3, 6).map(([action, pts], i) => (
                  <div key={i} className={styles.pointRow}>
                    <span>{action}</span>
                    <span className={styles.pointRowPoints}>{String(pts)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className={styles.majorPleThreeCol}>
            <div className={styles.eventCard}>
              <HowItWorksEventLogo eventKey="summerslam" placeholderText="SummerSlam logo" className={styles.eventCardLogo} />
              {SUMMERSLAM_POINTS.map(([action, pts], i) => (
                <div key={i} className={styles.pointRow}>
                  <span>{action}</span>
                  <span className={styles.pointRowPoints}>{pts}</span>
                </div>
              ))}
            </div>
            <div className={styles.eventCard}>
              <HowItWorksEventLogo
                eventKey="survivor-series"
                placeholderText="Survivor Series: War Games logo"
                className={styles.eventCardLogo}
              />
              {SURVIVOR_SERIES_POINTS.map(([action, pts], i) => (
                <div key={i} className={styles.pointRow}>
                  <span>{action}</span>
                  <span className={styles.pointRowPoints}>{String(pts)}</span>
                </div>
              ))}
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 8 }}>
                (Firsts get 5pts, fifths get 1pt)
              </p>
            </div>
            <div className={styles.eventCard}>
              <HowItWorksEventLogo eventKey="royal-rumble" placeholderText="Royal Rumble logo" className={styles.eventCardLogo} />
              {ROYAL_RUMBLE_POINTS.map(([action, pts], i) => (
                <div key={i} className={styles.pointRow}>
                  <span>{action}</span>
                  <span className={styles.pointRowPoints}>{String(pts)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 className={styles.sectionTitle}>Medium Premium Live Event Points</h2>
        <div className={styles.rulesBlock}>
          {GENERAL_RULES.map((text, i) => (
            <p key={i}>{text}</p>
          ))}
        </div>
        <p style={{ marginBottom: 16 }}>Points are awarded during the event</p>
        <div className={styles.pleDarkBox}>
          <div className={styles.mediumPleGrid}>
            <div className={styles.mediumPleCard}>
              <HowItWorksEventLogo
                eventKey="elimination-chamber"
                placeholderText="Elimination Chamber logo"
                className={styles.eventCardLogo}
              />
              {ELIMINATION_CHAMBER_POINTS.map(([action, pts], i) => (
                <div key={i} className={styles.pointRow}>
                  <span>{action}</span>
                  <span className={styles.pointRowPoints}>{pts}</span>
                </div>
              ))}
            </div>
            <div className={styles.mediumPleCard}>
              <HowItWorksEventLogo
                eventKey="night-of-champions"
                placeholderText="Night of Champions logo"
                className={styles.eventCardLogo}
              />
              {NOC_POINTS.map(([action, pts], i) => (
                <div key={i} className={styles.pointRow}>
                  <span>{action}</span>
                  <span className={styles.pointRowPoints}>{pts}</span>
                </div>
              ))}
            </div>
            <div className={styles.mediumPleCard}>
              <HowItWorksEventLogo
                eventKey="money-in-the-bank"
                placeholderText="Money in the Bank logo"
                className={styles.eventCardLogo}
              />
              {MITB_POINTS.map(([action, pts], i) => (
                <div key={i} className={styles.pointRow}>
                  <span>{action}</span>
                  <span className={styles.pointRowPoints}>{pts}</span>
                </div>
              ))}
            </div>
            <div className={styles.mediumPleCard}>
              <HowItWorksEventLogo eventKey="crown-jewel" placeholderText="Crown Jewel logo" className={styles.eventCardLogo} />
              {CROWN_JEWEL_POINTS.map(([action, pts], i) => (
                <div key={i} className={styles.pointRow}>
                  <span>{action}</span>
                  <span className={styles.pointRowPoints}>{pts}</span>
                </div>
              ))}
            </div>
            <div className={styles.mediumPleCard}>
              <HowItWorksEventLogo
                eventKey="king-queen"
                placeholderText="King & Queen of the Ring logo"
                className={styles.eventCardLogo}
              />
              {KING_QUEEN_POINTS.map(([action, pts], i) => (
                <div key={i} className={styles.pointRow}>
                  <span>{action}</span>
                  <span className={styles.pointRowPoints}>{pts}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 className={styles.sectionTitle}>Minor Premium Live Event Points</h2>
        <div className={styles.rulesBlock}>
          <p>
            A standard match victory earns full points. If a victory occurs via disqualification (DQ) or any other
            disqualifying result, it is worth half points. A No Contest result only earns appearance points; no victory or title
            defense points are awarded.
          </p>
          <p>
            A successful title defense is worth an additional 4 points, regardless of the event or match placement. If the title
            is retained via disqualification, the bonus is reduced to 2 points (half points).
          </p>
          <p>An initial title win earns an additional 5 points, regardless of where or how it occurs.</p>
          <p>Points are awarded during the event</p>
        </div>
        <div className={styles.pleDarkBox}>
          <div className={styles.minorPleGrid}>
            <div className={styles.minorPleCard}>
              <HowItWorksEventLogo
                eventKey="saturday-nights-main-event"
                placeholderText="Saturday Night's Main Event"
                className={styles.eventCardLogo}
              />
              {MINOR_PLE_BASE_POINTS.map(([action, pts], i) => (
                <div key={i} className={styles.pointRow}>
                  <span>{action}</span>
                  <span className={styles.pointRowPoints}>{pts}</span>
                </div>
              ))}
            </div>
            <div className={styles.minorPleCard}>
              <HowItWorksEventLogo eventKey="backlash" placeholderText="Backlash" className={styles.eventCardLogo} />
              {MINOR_PLE_BASE_POINTS.map(([action, pts], i) => (
                <div key={i} className={styles.pointRow}>
                  <span>{action}</span>
                  <span className={styles.pointRowPoints}>{pts}</span>
                </div>
              ))}
            </div>
            <div className={styles.minorPleCard}>
              <HowItWorksEventLogo eventKey="evolution" placeholderText="Evolution" className={styles.eventCardLogoTall} />
              {[...MINOR_PLE_BASE_POINTS, ...EVOLUTION_EXTRA_POINTS]
                .sort((a, b) => b[1] - a[1])
                .map(([action, pts], i) => (
                  <div key={i} className={styles.pointRow}>
                    <span>{action}</span>
                    <span className={styles.pointRowPoints}>{pts}</span>
                  </div>
                ))}
            </div>
            <div className={styles.minorPleCard}>
              <HowItWorksEventLogo eventKey="clash-in-paris" placeholderText="Clash in Paris" className={styles.eventCardLogo} />
              {MINOR_PLE_BASE_POINTS.map(([action, pts], i) => (
                <div key={i} className={styles.pointRow}>
                  <span>{action}</span>
                  <span className={styles.pointRowPoints}>{pts}</span>
                </div>
              ))}
            </div>
            <div className={styles.minorPleCard}>
              <HowItWorksEventLogo eventKey="wrestlepalooza" placeholderText="Wrestlepalooza" className={styles.eventCardLogoTall} />
              {MINOR_PLE_BASE_POINTS.map(([action, pts], i) => (
                <div key={i} className={styles.pointRow}>
                  <span>{action}</span>
                  <span className={styles.pointRowPoints}>{pts}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
