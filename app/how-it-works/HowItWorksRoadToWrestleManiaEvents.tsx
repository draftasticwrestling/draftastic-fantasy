import {
  ELIMINATION_CHAMBER_POINTS,
  GENERAL_RULES,
  MAIN_EVENT_WEEKLY_POINTS,
  MINOR_PLE_BASE_POINTS,
  RAWSMACKDOWN_POINTS,
  ROYAL_RUMBLE_POINTS,
  WRESTLEMANIA_POINTS,
} from "@/lib/howItWorksPoints";
import { HowItWorksEventLogo } from "./HowItWorksEventLogo";
import { HowItWorksSpecialMatches } from "./HowItWorksSpecialMatches";
import styles from "./HowItWorks.module.css";

type Props = {
  /** Date phrase after “WrestleMania”, such as “expected April 10–11”. */
  wrestlemaniaWhen: string;
  /** Sentence after the event list. */
  championshipNote?: string;
};

/**
 * Events that score in a Road to WrestleMania window: Wrestlepalooza, Saturday Night's Main Event,
 * Elimination Chamber, Royal Rumble, WrestleMania, Raw, SmackDown, and WWE Main Event.
 */
export function HowItWorksRoadToWrestleManiaEvents({
  wrestlemaniaWhen,
  championshipNote = "WrestleMania week is the season championship final for Head-to-Head leagues.",
}: Props) {
  return (
    <>
      <section style={{ marginBottom: 40 }}>
        <h2 className={styles.sectionTitle}>Premium live events in this season</h2>
        <p style={{ marginBottom: 16, color: "#555" }}>
          This window includes two <strong>minor PLEs</strong> (Wrestlepalooza on Dec 12, and Saturday Night&apos;s
          Main Event), one <strong>medium PLE</strong> (Elimination Chamber), and two <strong>major PLEs</strong>{" "}
          (Royal Rumble on Feb 6, and WrestleMania, {wrestlemaniaWhen}). {championshipNote} Saturday Night&apos;s Main
          Event and Elimination Chamber do not have announced dates yet. They use the structures below.
        </p>
        <div className={styles.rulesBlock}>
          <p>
            A standard match victory earns full points. If a victory occurs via disqualification (DQ), it is worth half
            points.
          </p>
          <p>
            A successful title defense is worth an additional 4 points (2 if via DQ). An initial title win earns an
            additional 5 points.
          </p>
          <p>
            Additional main event points are awarded only if the match is not the PLE&apos;s featured match. If the
            Men&apos;s Royal Rumble or an Elimination Chamber match is the main event, that winner does not also receive
            the separate main-event win.
          </p>
        </div>

        <h3 style={{ fontSize: "1.15rem", marginBottom: 12, marginTop: 8 }}>
          Major PLE — WrestleMania ({wrestlemaniaWhen})
        </h3>
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
                {WRESTLEMANIA_POINTS.slice(3).map(([action, pts], i) => (
                  <div key={i} className={styles.pointRow}>
                    <span>{action}</span>
                    <span className={styles.pointRowPoints}>{String(pts)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <h3 style={{ fontSize: "1.15rem", marginBottom: 12, marginTop: 24 }}>Major PLE — Royal Rumble (Feb 6)</h3>
        <div className={styles.pleDarkBox}>
          <div className={styles.majorPleSingle}>
            <div className={styles.eventCard}>
              <HowItWorksEventLogo
                eventKey="royal-rumble"
                placeholderText="Royal Rumble logo"
                className={styles.eventCardLogo}
              />
              {ROYAL_RUMBLE_POINTS.map(([action, pts], i) => (
                <div key={i} className={styles.pointRow}>
                  <span>{action}</span>
                  <span className={styles.pointRowPoints}>{String(pts)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <h3 style={{ fontSize: "1.15rem", marginBottom: 12, marginTop: 24 }}>
          Medium PLE — Elimination Chamber
        </h3>
        <div className={styles.pleDarkBox}>
          <div className={styles.majorPleSingle}>
            <div className={styles.eventCard}>
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
          </div>
        </div>

        <h3 style={{ fontSize: "1.15rem", marginBottom: 12, marginTop: 24 }}>Minor PLE — Wrestlepalooza (Dec 12)</h3>
        <div className={styles.pleDarkBox}>
          <div className={styles.majorPleSingle}>
            <div className={styles.eventCard}>
              <HowItWorksEventLogo
                eventKey="wrestlepalooza"
                placeholderText="Wrestlepalooza"
                className={styles.eventCardLogoTall}
              />
              {MINOR_PLE_BASE_POINTS.map(([action, pts], i) => (
                <div key={i} className={styles.pointRow}>
                  <span>{action}</span>
                  <span className={styles.pointRowPoints}>{pts}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <h3 style={{ fontSize: "1.15rem", marginBottom: 12, marginTop: 24 }}>
          Minor PLE — Saturday Night&apos;s Main Event
        </h3>
        <div className={styles.pleDarkBox}>
          <div className={styles.majorPleSingle}>
            <div className={styles.eventCard}>
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
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 className={styles.sectionTitle}>Raw / SmackDown</h2>
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

      <section style={{ marginBottom: 40 }}>
        <h2 className={styles.sectionTitle}>WWE Main Event</h2>
        <p style={{ marginBottom: 16, lineHeight: 1.65, color: "#333" }}>
          The weekly Main Event television show. This is not Saturday Night&apos;s Main Event. Match, title, and
          multi-person bonuses use the same scale as Tuesday NXT, and the points count as Raw/SmackDown (R/S).
        </p>
        <div className={styles.darkBox}>
          <div className={styles.majorPleSingle}>
            <div className={styles.eventCard}>
              <HowItWorksEventLogo
                eventKey="main-event"
                placeholderText="Main Event logo"
                className={styles.eventCardLogo}
              />
              {MAIN_EVENT_WEEKLY_POINTS.map(([action, pts]) => (
                <div key={action} className={styles.pointRow}>
                  <span>{action}</span>
                  <span className={styles.pointRowPoints}>{pts}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <HowItWorksSpecialMatches variant="legacy" />
    </>
  );
}
