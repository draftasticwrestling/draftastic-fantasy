import Link from "next/link";
import { FA_SIGNINGS_PER_WEEK } from "@/lib/publicLeagueRosterRules";
import { HEAD_TO_HEAD_NXT_ROSTER_RULES_BY_TEAMS } from "@/lib/leagueStructure";
import { GENERAL_RULES, RAWSMACKDOWN_POINTS } from "@/lib/howItWorksPoints";
import { HowItWorksEventLogo } from "./HowItWorksEventLogo";
import { HowItWorksNxtScoring } from "./HowItWorksNxtScoring";
import { HowItWorksSpecialMatches } from "./HowItWorksSpecialMatches";
import { HowItWorksTitlePoints } from "./HowItWorksTitlePoints";
import styles from "./HowItWorks.module.css";

/** Faction counts shown in the R2WG roster table (TSP 3–6 + H2H 4–8). */
const R2WG_ROSTER_TABLE_SIZES = [3, 4, 5, 6, 7, 8] as const;

/**
 * Scoring / rules reference for Road to War Games private leagues
 * (Aug 3 – Nov 28, 2026; NXT always included; TSP or Head-to-Head).
 */
export function HowItWorksRoadToWarGames() {
  return (
    <>
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: "1.35rem", marginBottom: 12 }}>Season overview</h2>
        <p style={{ marginBottom: 12, lineHeight: 1.65, color: "#333" }}>
          <strong>Road to War Games</strong> runs from the first Raw in August through{" "}
          <strong>Survivor Series: War Games</strong> (late November) — a 17-week private-league season. NXT wrestlers,
          events, and belts are included for every league. New private leagues can be created through Monday, October
          19 (six weeks before the final).
        </p>
        <p style={{ marginBottom: 0, lineHeight: 1.65, color: "#333" }}>
          After the draft is completed and approved: <strong>Total Season Points</strong> leagues start scoring at the
          next WWE event (including NXT); <strong>Head-to-Head</strong> leagues start the following Monday so each
          matchup week is a full Monday–Sunday window.
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: "1.35rem", marginBottom: 12 }}>League types</h2>
        <ul style={{ listStyle: "none", paddingLeft: 0 }}>
          <li style={{ marginBottom: 16 }}>
            <strong>Total Season Points</strong> — 3–6 factions. Compete against your whole league all season; the
            faction with the most overall points wins the Road to War Games championship.
          </li>
          <li style={{ marginBottom: 16 }}>
            <strong>Head-to-Head</strong> — 4–8 factions. Weekly matchups, a win–loss record, and a playoff bracket
            anchored so the championship final is Survivor Series: War Games week. Odd-sized leagues use one
            triple-threat matchup per week when needed (spread evenly across the league).
          </li>
          <li style={{ marginBottom: 16 }}>
            <strong>Combo League (H2H + Total Season Points)</strong> — <em>Coming soon.</em>
          </li>
          <li style={{ marginBottom: 16 }}>
            <strong>Legacy</strong> — Long-term contracts and dynasty play. Coming soon.
          </li>
          <li>
            <strong>Salary Cap</strong> — Available in public leagues via Play Now; private salary-cap leagues are
            coming soon.
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 className={styles.sectionTitle}>Roster rules</h2>
        <p style={{ marginBottom: 16, lineHeight: 1.65, color: "#333" }}>
          <strong>NXT is always included</strong> for Road to War Games — the draft pool, weekly events, and title
          points cover Raw, SmackDown, NXT, and PLEs. See NXT scoring below.
        </p>

        <h3 style={{ fontSize: "1.15rem", marginBottom: 8, marginTop: 0 }}>Drafting</h3>
        <p style={{ marginBottom: 16, lineHeight: 1.65, color: "#333" }}>
          Leagues begin with a draft. The commissioner sets the round-1 pick order; the full order follows your
          league&apos;s draft style (snake or linear). You fill your roster up to your league&apos;s roster size while
          meeting the minimum number of men&apos;s and women&apos;s spots. Once the draft is completed and approved,
          the league size locks to the number of factions that drafted — no new teams can join.
        </p>

        <h3 style={{ fontSize: "1.15rem", marginBottom: 8, marginTop: 0 }}>Roster sizes</h3>
        <p style={{ marginBottom: 12, lineHeight: 1.65, color: "#333" }}>
          Total Season Points and Head-to-Head use the same roster ladder (NXT included). Smaller leagues get deeper
          benches:
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
              {R2WG_ROSTER_TABLE_SIZES.map((n) => {
                const r = HEAD_TO_HEAD_NXT_ROSTER_RULES_BY_TEAMS[n];
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
          Total Season Points leagues are 3–6 factions; Head-to-Head leagues are 4–8. See your league&apos;s roster
          view for the numbers that apply to you.
        </p>

        <h3 style={{ fontSize: "1.15rem", marginBottom: 8, marginTop: 0 }}>Trades</h3>
        <p style={{ marginBottom: 16, lineHeight: 1.65, color: "#333" }}>
          Managers propose trades with another faction; the other manager accepts or declines. When both sides agree,
          the commissioner (General Manager) must approve or reject the trade before it processes. Wrestlers involved
          in a pending trade can&apos;t be dropped until that trade finishes or is cancelled.
        </p>

        <h3 style={{ fontSize: "1.15rem", marginBottom: 8, marginTop: 0 }}>Free agency</h3>
        <p style={{ marginBottom: 12, lineHeight: 1.65, color: "#333" }}>
          Anyone not on a roster in your league is a free agent. From your faction page you can drop wrestlers and add
          free agents, as long as you stay within roster size and gender minimums.
        </p>
        <p style={{ marginBottom: 0, lineHeight: 1.65, color: "#333" }}>
          <strong>Total Season Points — Road to War Games:</strong> Each faction may complete up to{" "}
          <strong>{FA_SIGNINGS_PER_WEEK} free agent signings per week</strong>. A <strong>week</strong> is{" "}
          <strong>Monday through Sunday in Pacific Time</strong> (America/Los_Angeles), so the cap follows WWE show
          nights in the US and does not reset at midnight UTC. Only <strong>signings</strong> count toward this cap
          (including a swap where you drop someone to add a free agent). Standalone drops do not count.{" "}
          <strong>Trades are unlimited.</strong>
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
          Main roster PLE details for Road to War Games will be added here as the August–November card is finalized.
          The season championship final for Head-to-Head leagues is Survivor Series: War Games week.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.35rem", marginBottom: 12 }}>Point categories</h2>
        <p>
          Each wrestler&apos;s total for a match is the sum of: <strong>Match points</strong> (appearance + win),{" "}
          <strong>Main event points</strong>, <strong>Belt points</strong>, <strong>Special points</strong> (where
          applicable), and <strong>Battle royal points</strong> (if applicable).
        </p>
      </section>

      <HowItWorksNxtScoring
        sectionContext={
          <>
            This scoring profile is used for all <strong>Road to War Games</strong> leagues — NXT is always included.
          </>
        }
        beltContext={
          <>
            For all <strong>Road to War Games</strong> leagues (NXT always included).
          </>
        }
      />

      <p style={{ marginTop: 24 }}>
        <Link href="/points">Full Points System</Link> for cross-references.{" "}
        <Link href="/event-results">Event Results</Link> to see points in action.
      </p>
    </>
  );
}
