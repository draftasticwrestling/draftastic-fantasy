import Link from "next/link";
import { Fragment } from "react";
import { FA_SIGNINGS_PER_WEEK } from "@/lib/publicLeagueRosterRules";
import { RTS_BETA_ROSTER_RULES_3_TO_6 } from "@/lib/leagueStructure";
import type { BeltKey, EventLogoKey } from "@/lib/howItWorksImages";
import { BELT_IMAGE_URLS } from "@/lib/howItWorksImages";
import {
  GENERAL_RULES,
  RAWSMACKDOWN_POINTS,
} from "@/lib/howItWorksPoints";
import { HowItWorksEventLogo } from "./HowItWorksEventLogo";
import { HowItWorksSpecialMatches } from "./HowItWorksSpecialMatches";
import { HowItWorksTitlePoints } from "./HowItWorksTitlePoints";
import styles from "./HowItWorks.module.css";

const NXT_TITLE_POINTS_MENS: Array<{ name: string; points: number; beltKey?: BeltKey }> = [
  { name: "NXT Championship", points: 3, beltKey: "nxt-mens" },
  { name: "NXT North American Championship", points: 2, beltKey: "nxt-na-mens" },
  { name: "NXT Men's Speed Championship", points: 1, beltKey: "nxt-speed-mens" },
  { name: "NXT Tag Team Championship (per member)", points: 1, beltKey: "nxt-tag-team" },
];

const NXT_TITLE_POINTS_WOMENS: Array<{ name: string; points: number; beltKey?: BeltKey }> = [
  { name: "NXT Women's Championship", points: 3, beltKey: "nxt-womens" },
  { name: "NXT Women's North American Championship", points: 2, beltKey: "nxt-na-womens" },
  { name: "NXT Women's Speed Championship", points: 1, beltKey: "nxt-speed-womens" },
  { name: "Main roster call-up", points: 15 },
];

const NXT_STAND_AND_DELIVER_POINTS: Array<[string, number]> = [
  ["Main Eventing", 8],
  ["Winning the Main Event", 10],
  ["Being on the Match Card (non-main event)", 4],
  ["Winning your Match", 5],
];

const NXT_PLE_SPECIAL_POINTS: Array<[string, number]> = [
  ["Main Eventing", 3],
  ["Winning the Main Event", 4],
  ["Being on the Match Card (non-main event)", 2],
  ["Winning your Match", 3],
];

const NXT_SPECIAL_EPISODE_POINTS: Array<[string, number]> = [
  ["Main Eventing", 2],
  ["Winning the Main Event", 3],
  ["Being on the Match Card (non-main event)", 1],
  ["Winning your Match", 2],
];

const NXT_TUESDAY_POINTS: Array<[string, number]> = [
  ["Main Eventing", 1.5],
  ["Winning the Main Event", 2],
  ["Being on the Match Card (non-main event)", 0.5],
  ["Winning your Match", 1],
];

const NXT_IRON_SURVIVOR_POINTS: Array<[string, number]> = [
  ["Iron Survivor participant", 4],
  ["Each Iron Survivor pin", 1],
  ["Winning Iron Survivor Challenge", 5],
];

const NXT_MULTI_PERSON_BONUS: Array<[string, number]> = [
  ["Tuesday NXT", 0.5],
  ["Minor NXT PLE / Special", 1],
  ["Stand & Deliver", 1.5],
];

export function HowItWorksRoadToSurvivorSeries() {
  const nxtPleKeys: EventLogoKey[] = [
    "nxt-battleground",
    "nxt-great-american-bash",
    "nxt-heatwave",
    "nxt-no-mercy",
    "nxt-halloween-havoc",
    "nxt-vengeance-day",
    "nxt-deadline",
  ];
  const nxtSpecialEpisodeKeys: EventLogoKey[] = [
    "nxt-new-years-evil",
    "nxt-roadblock",
    "nxt-homecoming",
    "nxt-showdown",
    "nxt-gold-rush",
    "nxt-revenge",
  ];

  return (
    <>
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: "1.35rem", marginBottom: 12 }}>League types</h2>
        <ul style={{ listStyle: "none", paddingLeft: 0 }}>
          <li style={{ marginBottom: 16 }}>
            <strong>Total Season Points</strong> — Compete against your whole league all season; the faction with the most overall points wins.
          </li>
          <li style={{ marginBottom: 16 }}>
            <strong>Head-to-Head</strong> — New this season! Compete against weekly opponents, earn the best win/loss record, dominate the playoffs and earn the belt at the end of the season.
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
        <p style={{ marginBottom: 16, lineHeight: 1.65, color: "#333" }}>
          <strong>New this season:</strong> Choose to Add NXT wrestlers, events, and belts. See NXT scoring below.
        </p>

        <h3 style={{ fontSize: "1.15rem", marginBottom: 8, marginTop: 0 }}>Drafting</h3>
        <p style={{ marginBottom: 16, lineHeight: 1.65, color: "#333" }}>
          Leagues begin with a draft. The commissioner sets the round-1 pick order; the full order follows your league&apos;s
          draft style (snake or linear). You fill your roster up to your league&apos;s roster size while meeting the
          minimum number of men&apos;s and women&apos;s spots on the roster.
        </p>

        <h3 style={{ fontSize: "1.15rem", marginBottom: 8, marginTop: 0 }}>Roster sizes</h3>
        <p style={{ marginBottom: 12, lineHeight: 1.65, color: "#333" }}>
          For <strong>Road to Survivor Series</strong> leagues with <strong>3–6 factions</strong> (current beta sizing), roster
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
          <strong>Total Season Points — Road to Survivor Series:</strong> Each faction may complete up to{" "}
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

      <HowItWorksSpecialMatches variant="rts" />

      <section style={{ marginBottom: 40 }}>
        <h2 className={styles.sectionTitle}>Premium live events in this season</h2>
        <p style={{ marginBottom: 16, color: "#555" }}>
          Main roster PLE details for Road to Survivor Series will be added here.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.35rem", marginBottom: 12 }}>Point categories</h2>
        <p>
          Each wrestler&apos;s total for a match is the sum of: <strong>Match points</strong> (appearance + win),{" "}
          <strong>Main event points</strong>, <strong>Belt points</strong>, <strong>Special points</strong> (where applicable),
          and <strong>Battle royal points</strong> (if applicable).
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 className={styles.sectionTitle}>NXT information (add-on scoring)</h2>
        <p className={styles.sectionSubtitle} style={{ maxWidth: 820, marginLeft: "auto", marginRight: "auto" }}>
          This scoring profile is used for <strong>Road to Survivor Series</strong> leagues when <strong>Include NXT</strong> is enabled.
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 className={styles.sectionTitle}>NXT monthly title points / Main roster promotion</h2>
        <p className={styles.sectionSubtitle}>
          The table below shows monthly-equivalent values. In scoring, points are awarded weekly at one quarter of
          these values.
        </p>
        <div className={styles.titlePointsGrid}>
          <div className={styles.titlePointsThMens}>Men&apos;s Division</div>
          <div className={styles.titlePointsThBeltMens} aria-hidden />
          <div className={styles.titlePointsThPtsMens}>Points</div>
          <div className={styles.titlePointsThWomens}>Women&apos;s Division</div>
          <div className={styles.titlePointsThBeltWomens} aria-hidden />
          <div className={styles.titlePointsThPtsWomens}>Points</div>
          {NXT_TITLE_POINTS_MENS.map((mensRow, i) => {
            const womensRow = NXT_TITLE_POINTS_WOMENS[i];
            const rowAlt = i % 2 === 1 ? styles.titlePointsRowAlt : "";
            return (
              <Fragment key={mensRow.name}>
                <div className={`${styles.titlePointsTdNameMens} ${rowAlt}`}>
                  {mensRow.name}
                </div>
                <div className={`${styles.titlePointsTdBeltMens} ${rowAlt}`}>
                  {mensRow.beltKey && BELT_IMAGE_URLS[mensRow.beltKey] ? (
                    <div className={styles.beltImageWrap}>
                      <img src={BELT_IMAGE_URLS[mensRow.beltKey]} alt="" className={styles.beltImage} />
                    </div>
                  ) : (
                    <div className={styles.beltPlaceholder}>NXT</div>
                  )}
                </div>
                <div className={`${styles.titlePointsTdPtsMens} ${rowAlt}`}>
                  {mensRow.points}
                </div>
                <div className={`${styles.titlePointsTdNameWomens} ${rowAlt}`}>
                  {womensRow.name}
                </div>
                <div className={`${styles.titlePointsTdBeltWomens} ${rowAlt}`}>
                  {womensRow.beltKey && BELT_IMAGE_URLS[womensRow.beltKey] ? (
                    <div className={styles.beltImageWrap}>
                      <img src={BELT_IMAGE_URLS[womensRow.beltKey]} alt="" className={styles.beltImage} />
                    </div>
                  ) : (
                    <div className={styles.beltPlaceholder}>Call Up</div>
                  )}
                </div>
                <div className={`${styles.titlePointsTdPtsWomens} ${rowAlt}`}>
                  {womensRow.points}
                </div>
              </Fragment>
            );
          })}
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 className={styles.sectionTitle}>NXT PLEs</h2>
        <div className={styles.rulesBlock}>
          <p>
            A standard match victory earns full points. If a victory occurs via disqualification (DQ), points are
            halved. No Contest earns appearance points only.
          </p>
          <p>
            A successful title defense adds <strong>1</strong> point (<strong>0.5</strong> via DQ). An initial title
            win adds <strong>2</strong> points.
          </p>
          <p>
            Additional main event points apply only when the match is not the featured/titled match for that event.
          </p>
        </div>

        <h3 style={{ fontSize: "1.15rem", marginBottom: 12 }}>Stand &amp; Deliver</h3>
        <div className={styles.pleDarkBox}>
          <div className={styles.majorPleSingle}>
            <div className={styles.eventCard}>
              <HowItWorksEventLogo
                eventKey="nxt-stand-and-deliver"
                placeholderText="NXT Stand and Deliver"
                className={styles.eventCardLogo}
              />
              {NXT_STAND_AND_DELIVER_POINTS.map(([action, pts]) => (
                <div key={action} className={styles.pointRow}>
                  <span>{action}</span>
                  <span className={styles.pointRowPoints}>{pts}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <h3 style={{ fontSize: "1.15rem", marginBottom: 12 }}>Other NXT PLEs / specials</h3>
        <div className={styles.pleDarkBox}>
          <div className={styles.minorPleGrid}>
            {nxtPleKeys.map((key) => (
              <div key={key} className={styles.minorPleCard}>
                <HowItWorksEventLogo eventKey={key} placeholderText={key} className={styles.eventCardLogo} />
                {NXT_PLE_SPECIAL_POINTS.map(([action, pts]) => (
                  <div key={`${key}-${action}`} className={styles.pointRow}>
                    <span>{action}</span>
                    <span className={styles.pointRowPoints}>{pts}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ maxWidth: 460, margin: "18px auto 0" }}>
            <h4 style={{ margin: "0 0 8px", textAlign: "center", fontSize: 15 }}>Iron Survivor Challenge (Deadline)</h4>
            {NXT_IRON_SURVIVOR_POINTS.map(([action, pts]) => (
              <div key={action} className={styles.pointRow}>
                <span>{action}</span>
                <span className={styles.pointRowPoints}>{pts}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 className={styles.sectionTitle}>NXT special episodes</h2>
        <div className={styles.pleDarkBox}>
          <div className={styles.minorPleGrid}>
            {nxtSpecialEpisodeKeys.map((key) => (
                <div key={key} className={styles.minorPleCard}>
                  <HowItWorksEventLogo eventKey={key} placeholderText={key} className={styles.eventCardLogo} />
                  {NXT_SPECIAL_EPISODE_POINTS.map(([action, pts]) => (
                    <div key={`${key}-${action}`} className={styles.pointRow}>
                      <span>{action}</span>
                      <span className={styles.pointRowPoints}>{pts}</span>
                    </div>
                  ))}
                </div>
              ))}
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 className={styles.sectionTitle}>NXT Tuesday Night</h2>
        <div className={styles.pleDarkBox}>
          <div className={styles.majorPleSingle}>
            <div className={styles.eventCard}>
              <HowItWorksEventLogo eventKey="nxt" placeholderText="NXT" className={styles.eventCardLogo} />
              {NXT_TUESDAY_POINTS.map(([action, pts]) => (
                <div key={action} className={styles.pointRow}>
                  <span>{action}</span>
                  <span className={styles.pointRowPoints}>{pts}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 className={styles.sectionTitle}>NXT specialty match bonus</h2>
        <p className={styles.sectionSubtitle} style={{ maxWidth: 780, marginLeft: "auto", marginRight: "auto" }}>
          For multi-person matches (Triple Threat, Fatal Four-Way, Five Way, Six Pack, etc.), add this bonus per
          participant or per pinfall, depending on match result formatting.
        </p>
        <div className={styles.darkBox} style={{ maxWidth: 680, margin: "0 auto" }}>
          {NXT_MULTI_PERSON_BONUS.map(([bucket, pts]) => (
            <div key={bucket} className={styles.pointRow}>
              <span>{bucket}</span>
              <span className={styles.pointRowPoints}>{pts}</span>
            </div>
          ))}
        </div>
      </section>

      <p style={{ marginTop: 24 }}>
        <Link href="/points">Full Points System</Link> for cross-references. <Link href="/event-results">Event Results</Link> to
        see points in action.
      </p>
    </>
  );
}
