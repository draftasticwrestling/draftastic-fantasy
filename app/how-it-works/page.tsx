import Link from "next/link";
import { Fragment } from "react";
import type { BeltKey, EventLogoKey } from "@/lib/howItWorksImages";
import { BELT_IMAGE_URLS, EVENT_LOGO_URLS } from "@/lib/howItWorksImages";
import styles from "./HowItWorks.module.css";

/** Renders event logo image from Supabase when URL exists, otherwise placeholder text. */
function EventLogo({
  eventKey,
  placeholderText,
  className,
}: {
  eventKey: EventLogoKey;
  placeholderText: string;
  className: string;
}) {
  const url = EVENT_LOGO_URLS[eventKey];
  const hasImg = Boolean(url);
  return (
    <div className={`${className}${hasImg ? ` ${styles.hasImg}` : ""}`}>
      {hasImg && url ? (
        <img src={url} alt="" loading="lazy" />
      ) : (
        placeholderText
      )}
    </div>
  );
}

export const metadata = {
  title: "How it Works — Draftastic Fantasy",
  description:
    "League types (Total Season Points, Head-to-Head, Combo League, Legacy), fantasy scoring, event points, titles, and special matches.",
};

const GENERAL_RULES = [
  "A standard match victory earns full points. If a victory occurs via disqualification (DQ) or any other disqualifying result, it is worth half points. A No Contest result only earns appearance points; no victory or title defense points are awarded.",
  "Additional main event points are awarded only if the match is not the PLE's featured (titled) match. Example: If the Men's Royal Rumble is the main event of the PLE, the winner receives only the standard event points, not extra for it being the main event.",
  "A successful title defense is worth an additional 4 points, regardless of the event or match placement. If the title is retained via disqualification, the bonus is reduced to 2 points (half points).",
  "An initial title win earns an additional 5 points, regardless of where or how it occurs.",
  "Points are awarded during the event.",
];

const MENS_BELT_KEYS: BeltKey[] = [
  "undisputed-wwe",
  "heavyweight",
  "intercontinental-mens",
  "us-mens",
  "tag-team-mens",
];
const TITLE_POINTS_MENS = [
  { name: "Undisputed WWE Champion", points: 10 },
  { name: "Heavy Weight Champion", points: 10 },
  { name: "Intercontinental Champion", points: 8 },
  { name: "US Champion", points: 7 },
  { name: "Tag Team Champion (Per Member)", points: 4 },
];

const WOMENS_BELT_KEYS: BeltKey[] = [
  "wwe-womens",
  "womens-world",
  "intercontinental-womens",
  "us-womens",
  "tag-team-womens",
];

/** Exact pixel size for every belt image so men's and women's match. */
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

const TITLE_POINTS_WOMENS = [
  { name: "WWE Women's Champion", points: 10 },
  { name: "Women's World Champion", points: 10 },
  { name: "Intercontinental Champion", points: 8 },
  { name: "US Champion", points: 7 },
  { name: "Tag Team Champion (Per Member)", points: 4 },
];

const RAW_POINTS = [
  ["Main Eventing", 3],
  ["Successful Title Defense", 4],
  ["Being on the Match Card (non-main event)", 1],
  ["Entering the Andre the Giant Battle Royal", 1],
];

const SMACKDOWN_POINTS = [
  ["Winning the Main Event", 4],
  ["Title Changes Hands", 5],
  ["Winning Your Match", 2],
  ["Eliminating a BR Participant", 2],
  ["Winning the Battle Royal", 8],
];

const WRESTLEMANIA_POINTS = [
  ["Main Eventing Night Two at Wrestlemania", 30],
  ["Winning Non-ME Match at Wrestlemania", 16],
  ["Being on the Non-ME Card at Wrestlemania", 8],
  ["Winning Main Event Night Two at Wrestlemania", 40],
  ["Winning Night One in Main Event at Wrestlemania", 30],
  ["Main Eventing Night One at Wrestlemania", 25],
];

const SUMMERSLAM_POINTS = [
  ["Winning the Main Event at Summer Slam either Night", 20],
  ["Main Eventing Night Two of Summer Slam", 15],
  ["Main Eventing Night One of Summer Slam", 10],
  ["Winning Your Match", 10],
  ["Being on the Non-ME Card", 5],
];

const SURVIVOR_SERIES_POINTS = [
  ["Winning the Main Event", 15],
  ["Main Eventing", 12],
  ["Winning Your Match", 10],
  ["Being on the Non-ME Card", 5],
  ["Being on a War Games Team", 8],
  ["Winning War Games", 14],
  ["Wrestler Who Makes the Pin", 10],
  ["Point Bonus for Entry Order", "1-5"],
];

const ROYAL_RUMBLE_POINTS = [
  ["Winning the Royal Rumble", 30],
  ["Points for Each Person Eliminated", 3],
  ["Iron Man/Iron Woman", 12],
  ["Person Who Eliminates the Most", 12],
  ["Winning the Main Event", 15],
  ["Main Eventing", 12],
  ["Winning Your Match", 10],
  ["Being on the Non-ME Card", 5],
  ["Being in the Royal Rumble", 2],
];

const ELIMINATION_CHAMBER_POINTS = [
  ["Winning the Elimination Chamber", 30],
  ["Qualifying for the Elimination Chamber", 10],
  ["Eliminating an Opponent in the Chamber", 10],
  ["Longest Lasting Participant in the Chamber", 15],
  ["Winning the Main Event", 15],
  ["Main Eventing", 9],
  ["Winning Your Match", 8],
  ["Being on the Match Card (non-main event)", 4],
];

const NOC_POINTS = [
  ["Winning the Main Event", 15],
  ["Main Eventing", 9],
  ["Winning Your Match", 8],
  ["Being on the Match Card (non-main event)", 4],
];

const MITB_POINTS = [
  ["Money in the Bank Winner", 25],
  ["Earning a Spot in the Ladder Match", 12],
  ["Winning the Main Event", 15],
  ["Main Eventing", 9],
  ["Winning Your Match", 8],
  ["Being on the Match Card (non-main event)", 4],
];

const CROWN_JEWEL_POINTS = [
  ["Winning the Crown Jewel Championship", 20],
  ["Crown Jewel Championship", 10],
  ["Winning the Main Event (non CJ Championship)", 15],
  ["Main Eventing (non CJ Championship)", 9],
  ["Winning Your Match", 8],
  ["Being on the Match Card (non-main event)", 4],
];

const KING_QUEEN_POINTS = [
  ["King or Queen of the Ring", 20],
  ["Finals Qualification", 10],
  ["Semi-Finals Qualification (in addition to Raw/Smackdown match points)", 7],
  ["First Round Qualification (in addition to Raw/Smackdown match points)", 3],
];

const MINOR_PLE_BASE_POINTS = [
  ["Winning the Main Event", 12],
  ["Main Eventing", 7],
  ["Winning Your Match", 6],
  ["Being on the Match Card (non-main event)", 3],
];

const EVOLUTION_EXTRA_POINTS = [
  ["Entering the Battle Royal", 1],
  ["Eliminating a BR Participant", 2],
  ["Winning the Battle Royal", 8],
];

export default function HowItWorksPage() {
  return (
    <main className={styles.page}>
      <p style={{ marginBottom: 24 }}>
        <Link href="/">← Home</Link>
      </p>

      <h1 style={{ marginBottom: 8 }}>How it Works</h1>
      <p style={{ color: "#555", marginBottom: 32 }}>
        Fantasy points are calculated from <strong>Pro Wrestling Boxscore</strong> event data. Your wrestlers earn points for appearing, winning, main eventing, and title matches — with bonuses for premium live events (PLEs) and special match types.
      </p>

      {/* League types — keep compact */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: "1.35rem", marginBottom: 12 }}>League types</h2>
        <ul style={{ listStyle: "none", paddingLeft: 0 }}>
          <li style={{ marginBottom: 16 }}>
            <strong>Total Season Points</strong> — Compete against your whole league all season. The team with the most overall points wins!
          </li>
          <li style={{ marginBottom: 16 }}>
            <strong>Head-to-Head</strong> — Minimum 4 teams, maximum 16. Weekly matchups during the Road to SummerSlam; the team with the best win-loss-draw record wins the league and the Draftastic Championship Belt.
          </li>
          <li style={{ marginBottom: 16 }}>
            <strong>Combo League (H2H + Total Season Points)</strong> — <em>Coming soon.</em>
          </li>
          <li>
            <strong>Legacy</strong> — Long-term contracts and dynasty play. <em>Coming soon.</em>
          </li>
        </ul>
      </section>

      {/* ---------- Title Points ---------- */}
      <section style={{ marginBottom: 40 }}>
        <h2 className={styles.sectionTitle}>Title Points</h2>
        <p className={styles.sectionSubtitle}>
          (Awarded to whoever holds the belt at the end of the last day of each month)
        </p>
        <div className={styles.titlePointsGrid}>
          {/* Row 1: headers — Men's Division | (belt) | Points | Women's Division | (belt) | Points */}
          <div className={styles.titlePointsThMens}>Men&apos;s Division</div>
          <div className={styles.titlePointsThBeltMens} aria-hidden />
          <div className={styles.titlePointsThPtsMens}>Points</div>
          <div className={styles.titlePointsThWomens}>Women&apos;s Division</div>
          <div className={styles.titlePointsThBeltWomens} aria-hidden />
          <div className={styles.titlePointsThPtsWomens}>Points</div>
          {/* Data rows: 6 cells each, left to right */}
          {TITLE_POINTS_MENS.map((mensRow, i) => {
            const womensRow = TITLE_POINTS_WOMENS[i];
            const rowAlt = i % 2 === 1 ? styles.titlePointsRowAlt : "";
            const mensBeltKey = MENS_BELT_KEYS[i];
            const womensBeltKey = WOMENS_BELT_KEYS[i];
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
      </section>

      {/* ---------- Raw / Smackdown Points ---------- */}
      <section style={{ marginBottom: 40 }}>
        <h2 className={styles.sectionTitle}>Raw/Smackdown Points</h2>
        <div className={styles.rulesBlock}>
          {GENERAL_RULES.slice(0, 4).map((text, i) => (
            <p key={i}>{text}</p>
          ))}
        </div>
        <div className={styles.darkBox}>
          <div className={styles.rawSmackdownLogoRow}>
            <EventLogo eventKey="raw" placeholderText="RAW logo" className={styles.eventLogoPlaceholder} />
            <div className={styles.rawSmackdownAmp} aria-hidden>&</div>
            <EventLogo eventKey="smackdown" placeholderText="SmackDown logo" className={styles.eventLogoPlaceholder} />
          </div>
          <div className={styles.rawSmackdownFlex}>
            <div className={styles.rawSmackdownCol}>
              {RAW_POINTS.map(([action, pts], i) => (
                <div key={i} className={styles.pointRow}>
                  <span>{action}</span>
                  <span className={styles.pointRowPoints}>{pts}</span>
                </div>
              ))}
            </div>
            <div className={styles.rawSmackdownCol}>
              {SMACKDOWN_POINTS.map(([action, pts], i) => (
                <div key={i} className={styles.pointRow}>
                  <span>{action}</span>
                  <span className={styles.pointRowPoints}>{pts}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Major PLE — Big Four ---------- */}
      <section style={{ marginBottom: 40 }}>
        <h2 className={styles.sectionTitle}>Major Premium Live Event Points — The &quot;Big Four&quot;</h2>
        <div className={styles.rulesBlock}>
          {GENERAL_RULES.map((text, i) => (
            <p key={i}>{text}</p>
          ))}
        </div>
        <div className={styles.pleDarkBox}>
        <div className={styles.wrestlemaniaBlock}>
          <EventLogo eventKey="wrestlemania" placeholderText="WrestleMania logo" className={styles.wrestlemaniaLogoPlaceholder} />
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
            <EventLogo eventKey="summerslam" placeholderText="SummerSlam logo" className={styles.eventCardLogo} />
            {SUMMERSLAM_POINTS.map(([action, pts], i) => (
              <div key={i} className={styles.pointRow}>
                <span>{action}</span>
                <span className={styles.pointRowPoints}>{pts}</span>
              </div>
            ))}
          </div>
          <div className={styles.eventCard}>
            <EventLogo eventKey="survivor-series" placeholderText="Survivor Series: War Games logo" className={styles.eventCardLogo} />
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
            <EventLogo eventKey="royal-rumble" placeholderText="Royal Rumble logo" className={styles.eventCardLogo} />
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

      {/* ---------- Medium PLE ---------- */}
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
            <EventLogo eventKey="elimination-chamber" placeholderText="Elimination Chamber logo" className={styles.eventCardLogo} />
            {ELIMINATION_CHAMBER_POINTS.map(([action, pts], i) => (
              <div key={i} className={styles.pointRow}>
                <span>{action}</span>
                <span className={styles.pointRowPoints}>{pts}</span>
              </div>
            ))}
          </div>
          <div className={styles.mediumPleCard}>
            <EventLogo eventKey="night-of-champions" placeholderText="Night of Champions logo" className={styles.eventCardLogo} />
            {NOC_POINTS.map(([action, pts], i) => (
              <div key={i} className={styles.pointRow}>
                <span>{action}</span>
                <span className={styles.pointRowPoints}>{pts}</span>
              </div>
            ))}
          </div>
          <div className={styles.mediumPleCard}>
            <EventLogo eventKey="money-in-the-bank" placeholderText="Money in the Bank logo" className={styles.eventCardLogo} />
            {MITB_POINTS.map(([action, pts], i) => (
              <div key={i} className={styles.pointRow}>
                <span>{action}</span>
                <span className={styles.pointRowPoints}>{pts}</span>
              </div>
            ))}
          </div>
          <div className={styles.mediumPleCard}>
            <EventLogo eventKey="crown-jewel" placeholderText="Crown Jewel logo" className={styles.eventCardLogo} />
            {CROWN_JEWEL_POINTS.map(([action, pts], i) => (
              <div key={i} className={styles.pointRow}>
                <span>{action}</span>
                <span className={styles.pointRowPoints}>{pts}</span>
              </div>
            ))}
          </div>
          <div className={styles.mediumPleCard}>
            <EventLogo eventKey="king-queen" placeholderText="King & Queen of the Ring logo" className={styles.eventCardLogo} />
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

      {/* ---------- Minor PLE ---------- */}
      <section style={{ marginBottom: 40 }}>
        <h2 className={styles.sectionTitle}>Minor Premium Live Event Points</h2>
        <div className={styles.rulesBlock}>
          <p>A standard match victory earns full points. If a victory occurs via disqualification (DQ) or any other disqualifying result, it is worth half points. A No Contest result only earns appearance points; no victory or title defense points are awarded.</p>
          <p>A successful title defense is worth an additional 4 points, regardless of the event or match placement. If the title is retained via disqualification, the bonus is reduced to 2 points (half points).</p>
          <p>An initial title win earns an additional 5 points, regardless of where or how it occurs.</p>
          <p>Points are awarded during the event</p>
        </div>
        <div className={styles.pleDarkBox}>
        <div className={styles.minorPleGrid}>
          <div className={styles.minorPleCard}>
            <EventLogo eventKey="saturday-nights-main-event" placeholderText="Saturday Night's Main Event" className={styles.eventCardLogo} />
            {MINOR_PLE_BASE_POINTS.map(([action, pts], i) => (
              <div key={i} className={styles.pointRow}>
                <span>{action}</span>
                <span className={styles.pointRowPoints}>{pts}</span>
              </div>
            ))}
          </div>
          <div className={styles.minorPleCard}>
            <EventLogo eventKey="backlash" placeholderText="Backlash" className={styles.eventCardLogo} />
            {MINOR_PLE_BASE_POINTS.map(([action, pts], i) => (
              <div key={i} className={styles.pointRow}>
                <span>{action}</span>
                <span className={styles.pointRowPoints}>{pts}</span>
              </div>
            ))}
          </div>
          <div className={styles.minorPleCard}>
            <EventLogo eventKey="evolution" placeholderText="Evolution" className={styles.eventCardLogoTall} />
            {[...MINOR_PLE_BASE_POINTS, ...EVOLUTION_EXTRA_POINTS].map(([action, pts], i) => (
              <div key={i} className={styles.pointRow}>
                <span>{action}</span>
                <span className={styles.pointRowPoints}>{pts}</span>
              </div>
            ))}
          </div>
          <div className={styles.minorPleCard}>
            <EventLogo eventKey="clash-in-paris" placeholderText="Clash in Paris" className={styles.eventCardLogo} />
            {MINOR_PLE_BASE_POINTS.map(([action, pts], i) => (
              <div key={i} className={styles.pointRow}>
                <span>{action}</span>
                <span className={styles.pointRowPoints}>{pts}</span>
              </div>
            ))}
          </div>
          <div className={styles.minorPleCard}>
            <EventLogo eventKey="wrestlepalooza" placeholderText="Wrestlepalooza" className={styles.eventCardLogoTall} />
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

      {/* Point categories summary + links */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.35rem", marginBottom: 12 }}>Point categories</h2>
        <p>Each wrestler&apos;s total for a match is the sum of: <strong>Match points</strong> (appearance + win), <strong>Main event points</strong>, <strong>Title points</strong>, <strong>Special points</strong> (Rumble, War Games, Chamber, MITB, etc.), and <strong>Battle royal points</strong>.</p>
      </section>

      <p style={{ marginTop: 24 }}>
        <Link href="/points">Full Points System</Link> for the complete breakdown. <Link href="/event-results">Event Results</Link> to see points in action.
      </p>
    </main>
  );
}
