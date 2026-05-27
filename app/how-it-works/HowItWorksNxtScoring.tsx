import type { BeltKey, EventLogoKey } from "@/lib/howItWorksImages";
import { HowItWorksBeltPointsTable } from "./HowItWorksBeltPointsTable";
import { HowItWorksEventLogo } from "./HowItWorksEventLogo";
import { BELT_HOLDER_MONTHLY_WEEKLY_EXPLAINER } from "./HowItWorksTitlePoints";
import { MAIN_ROSTER_CALL_UP_POINTS } from "@/lib/scoring/mainRosterCallUp.js";
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

const NXT_PLE_KEYS: EventLogoKey[] = [
  "nxt-battleground",
  "nxt-great-american-bash",
  "nxt-heatwave",
  "nxt-no-mercy",
  "nxt-halloween-havoc",
  "nxt-vengeance-day",
  "nxt-deadline",
];

const NXT_SPECIAL_EPISODE_KEYS: EventLogoKey[] = [
  "nxt-new-years-evil",
  "nxt-roadblock",
  "nxt-homecoming",
  "nxt-showdown",
  "nxt-gold-rush",
  "nxt-revenge",
];

type Props = {
  /** Short line under the NXT section heading (e.g. public vs Road to War Games). */
  sectionContext: React.ReactNode;
  /** Extra line on the title-holder table (before Mo./Wk. explainer). */
  beltContext?: React.ReactNode;
};

/**
 * Full NXT scoring reference: title holder points, PLEs, special episodes, Tuesday NXT, and specialty bonuses.
 */
export function HowItWorksNxtScoring({ sectionContext, beltContext }: Props) {
  return (
    <>
      <section style={{ marginBottom: 32 }}>
        <h2 className={styles.sectionTitle}>NXT scoring</h2>
        <p className={styles.sectionSubtitle} style={{ maxWidth: 820, marginLeft: "auto", marginRight: "auto" }}>
          {sectionContext}
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 className={styles.sectionTitle}>NXT title holder points</h2>
        <p className={styles.sectionSubtitle} style={{ maxWidth: 820, marginLeft: "auto", marginRight: "auto" }}>
          {beltContext ? (
            <>
              {beltContext}{" "}
            </>
          ) : null}
          {BELT_HOLDER_MONTHLY_WEEKLY_EXPLAINER}
        </p>
        <HowItWorksBeltPointsTable mensRows={NXT_TITLE_POINTS_MENS} womensRows={NXT_TITLE_POINTS_WOMENS} />
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 className={styles.sectionTitle}>Main roster call-up</h2>
        <p className={styles.sectionSubtitle} style={{ maxWidth: 820, marginLeft: "auto", marginRight: "auto" }}>
          When an NXT wrestler is officially announced as joining the main roster (Raw or SmackDown), they receive a{" "}
          <strong>one-time bonus of {MAIN_ROSTER_CALL_UP_POINTS} points</strong> on the date of that announcement. This is
          logged as a promo outcome in event results and does not repeat weekly like title-holder credit.
        </p>
        <div className={styles.darkBox} style={{ maxWidth: 520, margin: "0 auto" }}>
          <div className={styles.pointRow}>
            <span>Main roster call-up (one-time)</span>
            <span className={styles.pointRowPoints}>{MAIN_ROSTER_CALL_UP_POINTS}</span>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 className={styles.sectionTitle}>NXT PLEs</h2>
        <div className={styles.rulesBlock}>
          <p>
            A standard match victory earns full points. If a victory occurs via disqualification (DQ), points are halved. No
            Contest earns appearance points only.
          </p>
          <p>
            A successful title defense adds <strong>1</strong> point (<strong>0.5</strong> via DQ). An initial title win adds{" "}
            <strong>2</strong> points.
          </p>
          <p>Additional main event points apply only when the match is not the featured/titled match for that event.</p>
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
            {NXT_PLE_KEYS.map((key) => (
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
            {NXT_SPECIAL_EPISODE_KEYS.map((key) => (
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
          For multi-person matches (Triple Threat, Fatal Four-Way, Five Way, Six Pack, etc.), add this bonus per participant
          or per pinfall, depending on match result formatting.
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
    </>
  );
}
