import Link from "next/link";
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
import { HowItWorksTitlePoints } from "./HowItWorksTitlePoints";
import styles from "./HowItWorks.module.css";

/**
 * Full year-round scoring reference: Raw/SmackDown, every PLE tier, and all major PLEs.
 * Used for Legacy-style leagues and as a complete reference.
 */
export function HowItWorksLegacyContent() {
  return (
    <>
      <p style={{ color: "#555", marginBottom: 28 }}>
        <strong>Legacy League</strong> (coming soon) is built for year-round play: the same rules apply across all WWE TV and
        premium live events throughout the calendar. The sections below list points for <em>every</em> event type — not just a
        single season window. Shorter seasons (Road to SummerSlam, etc.) only use subsets of these tables; see those tabs for
        what counts in your league.
      </p>

      <p style={{ color: "#555", marginBottom: 32 }}>
        Fantasy points are calculated from <strong>Pro Wrestling Boxscore</strong> event data. Your wrestlers earn points for
        appearing, winning, main eventing, and title matches — with bonuses for premium live events (PLEs) and special match
        types.
      </p>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: "1.35rem", marginBottom: 12 }}>League types</h2>
        <ul style={{ listStyle: "none", paddingLeft: 0 }}>
          <li style={{ marginBottom: 16 }}>
            <strong>Total Season Points</strong> — Available for the Road to SummerSlam beta. Compete against your whole league
            all season; the faction with the most overall points wins.
          </li>
          <li style={{ marginBottom: 16 }}>
            <strong>Head-to-Head</strong> — <em>Coming soon</em> (after the Total Season Points beta).
          </li>
          <li style={{ marginBottom: 16 }}>
            <strong>Combo League (H2H + Total Season Points)</strong> — <em>Coming soon.</em>
          </li>
          <li>
            <strong>Legacy</strong> — Long-term contracts and dynasty play. <em>Coming soon.</em>
          </li>
        </ul>
      </section>

      <HowItWorksTitlePoints />

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
          <div className={styles.rawSmackdownFlex}>
            <div className={styles.rawSmackdownCol}>
              {RAWSMACKDOWN_POINTS.map(([action, pts], i) => (
                <div key={i} className={styles.pointRow}>
                  <span>{action}</span>
                  <span className={styles.pointRowPoints}>{pts}</span>
                </div>
              ))}
            </div>
            <div className={styles.rawSmackdownCol}>
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

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.35rem", marginBottom: 12 }}>Point categories</h2>
        <p>
          Each wrestler&apos;s total for a match is the sum of: <strong>Match points</strong> (appearance + win),{" "}
          <strong>Main event points</strong>, <strong>Belt points</strong>, <strong>Special points</strong> (Rumble, War Games,
          Chamber, MITB, etc.), and <strong>Battle royal points</strong>.
        </p>
      </section>

      <p style={{ marginTop: 24 }}>
        <Link href="/points">Full Points System</Link> for the complete breakdown. <Link href="/event-results">Event Results</Link>{" "}
        to see points in action.
      </p>
    </>
  );
}
