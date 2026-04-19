import Link from "next/link";
import { BELT_DEFENSE_NEW_CHAMPION_POINTS } from "@/lib/howItWorksPoints";
import { EVENT_LOGO_URLS } from "@/lib/howItWorksImages";

export const metadata = {
  title: "Points System — Draftastic Fantasy",
  description:
    "Full fantasy points breakdown: general rules, Raw/SmackDown, belt points, and every PLE from WrestleMania to minor events.",
};

const tableBase = {
  width: "100%" as const,
  borderCollapse: "collapse" as const,
  marginTop: 8,
  fontSize: 15,
};
const thStyle = { padding: "8px 12px", borderBottom: "2px solid #333", textAlign: "left" as const };
const tdStyle = { padding: "8px 12px", borderBottom: "1px solid #ddd" };

function EventTable({
  title,
  rows,
  logoUrl,
}: {
  title?: string;
  rows: [string, number | string][];
  logoUrl?: string | null;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      {logoUrl && (
        <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
          <img src={logoUrl} alt="" style={{ height: 40, width: "auto", objectFit: "contain" }} loading="lazy" />
        </div>
      )}
      {title ? <h3 style={{ fontSize: "1.1rem", marginBottom: 8 }}>{title}</h3> : null}
      <table style={tableBase}>
        <thead>
          <tr>
            <th style={thStyle}>Action</th>
            <th style={thStyle}>Points</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([action, pts], i) => (
            <tr key={i} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={tdStyle}>{action}</td>
              <td style={tdStyle}>{typeof pts === "number" ? pts : pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PointsPage() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 960, margin: "0 auto", fontSize: 18, lineHeight: 1.6 }}>
      <p style={{ marginBottom: 24 }}>
        <Link href="/">← Home</Link>
        {" · "}
        <Link href="/how-it-works">How it Works</Link>
      </p>

      <h1 style={{ marginBottom: 8 }}>Points System</h1>
      <p style={{ color: "#555", marginBottom: 32 }}>
        Complete point values for TV, premium live events, titles, and special matches. Points are awarded during the event.
      </p>

      {/* General rules */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.35rem", marginBottom: 12 }}>General rules</h2>
        <ul style={{ marginBottom: 0 }}>
          <li>A <strong>standard match victory</strong> earns full points. A victory via <strong>disqualification (DQ)</strong> or any other disqualifying result is worth <strong>half points</strong>.</li>
          <li>A <strong>No Contest</strong> result only earns appearance points; no victory or title defense points are awarded.</li>
          <li>Additional <strong>main event points</strong> are awarded only if the match is <em>not</em> the PLE’s featured (titled) match. Example: if the Men’s Royal Rumble is the main event, the winner receives only standard event points, not extra for main eventing.</li>
          <li>A <strong>successful title defense</strong> is worth an additional <strong>4 points</strong>, regardless of event or match placement. If the title is retained via DQ, the bonus is <strong>2 points</strong> (half).</li>
          <li>An <strong>initial title win</strong> earns an additional <strong>5 points</strong>, regardless of where or how it occurs.</li>
          <li><strong>Points are awarded during the event.</strong></li>
        </ul>
      </section>

      {/* Raw & SmackDown */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.35rem", marginBottom: 12 }}>Raw / SmackDown points</h2>
        <p style={{ marginBottom: 8 }}>All actions below apply to both Raw and SmackDown.</p>
        <table style={tableBase}>
          <thead>
            <tr>
              <th style={thStyle}>Action</th>
              <th style={thStyle}>Points</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Winning the Battle Royal", 8],
              ["Title Changes Hands", 5],
              ["Successful Title Defense", 4],
              ["Winning the Main Event", 4],
              ["Main Eventing", 3],
              ["Winning Your Match", 2],
              ["Each elimination (non–Royal Rumble battle royal), per opponent removed", 2],
              ["Being on the Match Card (non-main event)", 1],
              ["Entering the Battle Royal (appearance)", 1],
            ].map(([action, pts], i) => (
              <tr key={i} style={{ borderBottom: "1px solid #ddd" }}>
                <td style={tdStyle}>{action}</td>
                <td style={tdStyle}>{pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Belt points — weekly hold + defense / new champion */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.35rem", marginBottom: 12 }}>Belt points</h2>
        <h3 style={{ fontSize: "1.15rem", marginBottom: 8, fontWeight: 700 }}>Weekly belt points</h3>
        <p style={{ color: "#555", marginBottom: 16 }}>
          Points are dispersed weekly at 11:59 PM PT (Los Angeles time) on Sunday. Weeks are Monday through Sunday; the holder is
          credited after that Sunday fully ends in Pacific time so late US shows can change a title before the
          week locks.
        </p>
        <div className="points-grid">
          <EventTable
            title="Men's Division"
            rows={[
              ["Undisputed WWE Champion", 3],
              ["Heavy Weight Champion", 3],
              ["Intercontinental Champion", 2],
              ["US Champion", 2],
              ["Tag Team Champion (per member)", 1],
            ]}
          />
          <EventTable
            title="Women's Division"
            rows={[
              ["WWE Women's Champion", 3],
              ["Women's World Champion", 3],
              ["Intercontinental Champion", 2],
              ["US Champion", 2],
              ["Tag Team Champion (per member)", 1],
            ]}
          />
        </div>
        <h3 style={{ fontSize: "1.15rem", marginTop: 28, marginBottom: 8, fontWeight: 700 }}>
          Belt defense / New champion points
        </h3>
        <p style={{ color: "#555", marginBottom: 16 }}>
          Awarded during the match when a championship is defended or changes hands (same values for every title).
        </p>
        <EventTable rows={BELT_DEFENSE_NEW_CHAMPION_POINTS} />
      </section>

      {/* Major PLE — Big Four */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.35rem", marginBottom: 12 }}>Major premium live events — The Big Four</h2>
        <div className="points-grid">
          <EventTable
            title="WrestleMania"
            logoUrl={EVENT_LOGO_URLS.wrestlemania}
            rows={[
              ["Winning Main Event Night Two at WrestleMania", 40],
              ["Main Eventing Night Two at WrestleMania", 30],
              ["Winning Night One in Main Event at Wrestlemania", 30],
              ["Main Eventing Night One at WrestleMania", 25],
              ["Winning Non-ME Match at WrestleMania", 16],
              ["Being on the Non-ME Card at WrestleMania", 8],
            ]}
          />
          <EventTable
            title="SummerSlam"
            logoUrl={EVENT_LOGO_URLS.summerslam}
            rows={[
              ["Winning main event SummerSlam Night 2", 30],
              ["Main eventing SummerSlam Night 2 (appearance)", 30],
              ["Winning main event SummerSlam Night 1", 25],
              ["Main eventing SummerSlam Night 1 (appearance)", 20],
              ["Winning your match (non–main event)", 20],
              ["Being on the card (non–main event)", 10],
            ]}
          />
          <EventTable
            title="Survivor Series War Games"
            logoUrl={EVENT_LOGO_URLS["survivor-series"]}
            rows={[
              ["Winning the Main Event", 15],
              ["Winning War Games", 14],
              ["Main Eventing", 12],
              ["Winning Your Match", 10],
              ["Wrestler Who Makes the Pin", 10],
              ["Being on a War Games Team", 8],
              ["Being on the Non-ME Card", 5],
              ["Point bonus for entry order (1st = 5 pts, 5th = 1 pt)", "1–5"],
            ]}
          />
          <EventTable
            title="Royal Rumble"
            logoUrl={EVENT_LOGO_URLS["royal-rumble"]}
            rows={[
              ["Winning the Royal Rumble", 30],
              ["Winning the Main Event", 15],
              ["Iron Man / Iron Woman", 12],
              ["Person Who Eliminates the Most", 12],
              ["Main Eventing", 12],
              ["Winning Your Match", 10],
              ["Being on the Non-ME Card", 5],
              ["Points for Each Person Eliminated", 3],
              ["Being in the Royal Rumble", 2],
            ]}
          />
        </div>
      </section>

      {/* Medium PLE */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.35rem", marginBottom: 12 }}>Medium premium live event points</h2>
        <div className="points-grid">
          <EventTable
            title="Elimination Chamber"
            logoUrl={EVENT_LOGO_URLS["elimination-chamber"]}
            rows={[
              ["Winning the Elimination Chamber", 30],
              ["Longest Lasting Participant in the Chamber", 15],
              ["Winning the Main Event", 15],
              ["Qualifying for the Elimination Chamber", 10],
              ["Eliminating an Opponent in the Chamber", 10],
              ["Main Eventing", 9],
              ["Winning Your Match", 8],
              ["Being on the Match Card (non-main event)", 4],
            ]}
          />
          <EventTable
            title="Night of Champions"
            logoUrl={EVENT_LOGO_URLS["night-of-champions"]}
            rows={[
              ["Winning the main event", 16],
              ["Main eventing (appearance)", 12],
              ["Winning your match", 10],
              ["Being on the card (non–main event)", 5],
            ]}
          />
          <EventTable
            title="King & Queen of the Ring"
            logoUrl={EVENT_LOGO_URLS["king-queen"]}
            rows={[
              ["King or Queen of the Ring", 20],
              ["Finals Qualification", 10],
              ["Semi-Finals Qualification (in addition to Raw/SmackDown match points)", 7],
              ["First Round Qualification (in addition to Raw/SmackDown match points)", 3],
            ]}
          />
          <EventTable
            title="Money in the Bank"
            logoUrl={EVENT_LOGO_URLS["money-in-the-bank"]}
            rows={[
              ["Money in the Bank Winner", 25],
              ["Winning the Main Event", 15],
              ["Earning a Spot in the Ladder Match", 12],
              ["Main Eventing", 9],
              ["Winning Your Match", 8],
              ["Being on the Match Card (non-main event)", 4],
            ]}
          />
          <EventTable
            title="Crown Jewel"
            logoUrl={EVENT_LOGO_URLS["crown-jewel"]}
            rows={[
              ["Winning the Crown Jewel Championship", 20],
              ["Winning the Main Event (non-CJ Championship)", 15],
              ["Crown Jewel Championship (participating)", 10],
              ["Main Eventing (non-CJ Championship)", 9],
              ["Winning Your Match", 8],
              ["Being on the Match Card (non-main event)", 4],
            ]}
          />
        </div>
      </section>

      {/* Minor PLE */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.35rem", marginBottom: 12 }}>Minor premium live event points</h2>
        <p style={{ marginBottom: 16 }}>
          Same base values for: Saturday Night&apos;s Main Event (SNME), Backlash, Clash in Italy, Clash in Paris,
          WrestlePalooza. Evolution also includes Battle Royal points below.
        </p>
        <div className="points-grid">
          <EventTable
            title="Saturday Night's Main Event (SNME) / Backlash / Clash in Italy / Clash in Paris / WrestlePalooza"
            logoUrl={EVENT_LOGO_URLS.backlash}
            rows={[
              ["Winning the main event", 12],
              ["Main eventing (appearance)", 9],
              ["Winning your match", 6],
              ["Being on the card (non–main event)", 3],
            ]}
          />
          <EventTable
            title="Evolution (includes Battle Royal)"
            logoUrl={EVENT_LOGO_URLS.evolution}
            rows={[
              ["Winning the main event", 12],
              ["Main eventing (appearance)", 9],
              ["Winning the Battle Royal", 8],
              ["Winning your match", 6],
              ["Being on the card (non–main event)", 3],
              ["Each elimination (per opponent removed)", 2],
              ["Entering the Battle Royal (appearance)", 1],
            ]}
          />
        </div>
      </section>

      <p style={{ marginTop: 24 }}>
        <Link href="/how-it-works">How it Works</Link> for an overview, or <Link href="/event-results">Event Results</Link> to see points in action.
      </p>
    </main>
  );
}
