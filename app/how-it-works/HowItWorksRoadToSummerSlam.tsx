import Link from "next/link";
import { FA_SIGNINGS_PER_WEEK } from "@/lib/publicLeagueRosterRules";
import { RTS_BETA_ROSTER_RULES_3_TO_6 } from "@/lib/leagueStructure";
import {
  GENERAL_RULES,
  KING_QUEEN_POINTS,
  MINOR_PLE_BASE_POINTS,
  NOC_POINTS,
  RAWSMACKDOWN_POINTS,
  SUMMERSLAM_POINTS,
} from "@/lib/howItWorksPoints";
import { HowItWorksEventLogo } from "./HowItWorksEventLogo";
import { HowItWorksSpecialMatches } from "./HowItWorksSpecialMatches";
import { HowItWorksTitlePoints } from "./HowItWorksTitlePoints";
import styles from "./HowItWorks.module.css";

/**
 * Scoring reference for the Road to SummerSlam season window only
 * (12 Raws, 12 SmackDowns, minor / medium / major PLEs through SummerSlam Night 2).
 */
export function HowItWorksRoadToSummerSlam() {
  return (
    <>
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
            <strong>Legacy</strong> — Long-term contracts and dynasty play. Coming soon.
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 className={styles.sectionTitle}>Roster rules</h2>

        <h3 style={{ fontSize: "1.15rem", marginBottom: 8, marginTop: 0 }}>Drafting</h3>
        <p style={{ marginBottom: 16, lineHeight: 1.65, color: "#333" }}>
          Leagues begin with a draft. The commissioner sets the round-1 pick order; the full order follows your league&apos;s
          draft style (snake or linear). You fill your roster up to your league&apos;s roster size while meeting the
          minimum number of men&apos;s and women&apos;s spots on the roster.
        </p>

        <h3 style={{ fontSize: "1.15rem", marginBottom: 8, marginTop: 0 }}>Roster sizes</h3>
        <p style={{ marginBottom: 12, lineHeight: 1.65, color: "#333" }}>
          For <strong>Road to SummerSlam</strong> leagues with <strong>3–6 factions</strong> (current beta sizing), roster
          size and gender minimums are:
        </p>
        <div style={{ overflowX: "auto", marginBottom: 16 }}>
          <table
            style={{
              width: "100%",
              maxWidth: 420,
              borderCollapse: "collapse",
              fontSize: 14,
            }}
          >
            <thead>
              <tr style={{ borderBottom: "2px solid var(--color-border, #e0e0e0)" }}>
                <th style={{ textAlign: "left", padding: "8px 12px 8px 0" }}>Factions</th>
                <th style={{ textAlign: "left", padding: "8px 12px" }}>Roster size</th>
                <th style={{ textAlign: "left", padding: "8px 0 8px 12px" }}>Minimums (F / M)</th>
              </tr>
            </thead>
            <tbody>
              {([3, 4, 5, 6] as const).map((n) => {
                const r = RTS_BETA_ROSTER_RULES_3_TO_6[n];
                if (!r) return null;
                return (
                  <tr key={n} style={{ borderBottom: "1px solid var(--color-border-light, #e8e8e8)" }}>
                    <td style={{ padding: "8px 12px 8px 0" }}>{n}</td>
                    <td style={{ padding: "8px 12px" }}>{r.rosterSize}</td>
                    <td style={{ padding: "8px 0 8px 12px" }}>
                      {r.minFemale} women / {r.minMale} men
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p style={{ marginBottom: 16, fontSize: 14, color: "#555", lineHeight: 1.55 }}>
          Leagues with more factions use different caps; see your league&apos;s roster view for the numbers that apply to you.
        </p>

        <h3 style={{ fontSize: "1.15rem", marginBottom: 8, marginTop: 0 }}>Trades</h3>
        <p style={{ marginBottom: 16, lineHeight: 1.65, color: "#333" }}>
          Managers propose trades with another faction; the other manager accepts or declines. When both sides agree, the
          commissioner (General Manager) must approve or reject the trade before it processes. Wrestlers involved in a
          pending trade can&apos;t be dropped until that trade finishes or is cancelled.
        </p>

        <h3 style={{ fontSize: "1.15rem", marginBottom: 8, marginTop: 0 }}>Free agency</h3>
        <p style={{ marginBottom: 12, lineHeight: 1.65, color: "#333" }}>
          Anyone not on a roster in your league is a free agent. From your faction page you can drop wrestlers and add free
          agents, as long as you stay within roster size and gender minimums.
        </p>
        <p style={{ marginBottom: 0, lineHeight: 1.65, color: "#333" }}>
          <strong>Total Season Points — Road to SummerSlam:</strong> Each faction may complete up to{" "}
          <strong>
            {FA_SIGNINGS_PER_WEEK} free agent signings per week
          </strong>
          . A <strong>week</strong> is <strong>Monday through Sunday in Pacific Time</strong> (America/Los_Angeles), so the
          cap follows WWE show nights in the US and does not reset at midnight UTC. Only <strong>signings</strong> count toward
          this cap (including a swap where you drop someone to
          add a free agent). Standalone drops do not count. <strong>Trades are unlimited.</strong>
        </p>
      </section>

      <HowItWorksTitlePoints />

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

      <HowItWorksSpecialMatches variant="rts" />

      <section style={{ marginBottom: 40 }}>
        <h2 className={styles.sectionTitle}>Premium live events in this season</h2>
        <p style={{ marginBottom: 16, color: "#555" }}>
          This window includes four <strong>minor PLEs</strong> (Backlash, two Saturday Night&apos;s Main Events, Clash in
          Italy), one <strong>medium PLE</strong> (Night of Champions (King/ Queen of the Ring)), and{" "}
          <strong>SummerSlam</strong> (nights 1 and 2). They use the structures below.
        </p>
        <div className={styles.rulesBlock}>
          <p>A standard match victory earns full points. If a victory occurs via disqualification (DQ), it is worth half points.</p>
          <p>A successful title defense is worth an additional 4 points (2 if via DQ). An initial title win earns an additional 5 points.</p>
        </div>

        <h3 style={{ fontSize: "1.15rem", marginBottom: 12, marginTop: 8 }}>
          Minor PLEs <span style={{ fontWeight: 400, fontSize: "0.95rem" }}>(SNME = Saturday Night&apos;s Main Event)</span>
        </h3>
        <div className={styles.pleDarkBox}>
          <div className={styles.minorPleGrid}>
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
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 8 }}>
                Two Saturday Night&apos;s Main Event cards this season (league nav: SNME 1 / SNME 2) — same point table each.
              </p>
            </div>
            <div className={styles.minorPleCard}>
              <HowItWorksEventLogo eventKey="clash-in-paris" placeholderText="Clash in Italy" className={styles.eventCardLogo} />
              {MINOR_PLE_BASE_POINTS.map(([action, pts], i) => (
                <div key={i} className={styles.pointRow}>
                  <span>{action}</span>
                  <span className={styles.pointRowPoints}>{pts}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p style={{ margin: "24px 0 14px", fontSize: 14, color: "#555" }}>
          This premium live event includes the Night of Champions card and the King / Queen of the Ring tournament — point
          tables below.
        </p>
        <div className={styles.pleDarkBox}>
          <h3 className={styles.nocKqorCombinedTitle}>
            Medium PLE — Night of Champions (King/ Queen of the Ring)
          </h3>
          <div className={styles.nocKqorTwoCol}>
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

        <h3 style={{ fontSize: "1.15rem", marginBottom: 12, marginTop: 24 }}>Major PLE — SummerSlam (nights 1 &amp; 2)</h3>
        <div className={styles.pleDarkBox}>
          <div className={styles.majorPleSingle}>
            <div className={styles.eventCard}>
              <HowItWorksEventLogo eventKey="summerslam" placeholderText="SummerSlam logo" className={styles.eventCardLogo} />
              {SUMMERSLAM_POINTS.map(([action, pts], i) => (
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
          <strong>Main event points</strong>, <strong>Belt points</strong>, <strong>Special points</strong> (where applicable),
          and <strong>Battle royal points</strong> (if applicable).
        </p>
      </section>

      <p style={{ marginTop: 24 }}>
        <Link href="/points">Full Points System</Link> for cross-references. <Link href="/event-results">Event Results</Link> to
        see points in action.
      </p>
    </>
  );
}
