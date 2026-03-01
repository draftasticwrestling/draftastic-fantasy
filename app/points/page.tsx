import Link from "next/link";

export const metadata = {
  title: "Points System — Draftastic Fantasy",
  description: "Full fantasy points breakdown: general rules, Raw/SmackDown, title points, and every PLE from WrestleMania to minor events.",
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
}: {
  title: string;
  rows: [string, number | string][];
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: "1.1rem", marginBottom: 8 }}>{title}</h3>
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
              ["Main Eventing", 3],
              ["Successful Title Defense", 4],
              ["Being on the Match Card (non-main event)", 1],
              ["Entering the Andre the Giant Battle Royal", 1],
              ["Winning the Main Event", 4],
              ["Title Changes Hands", 5],
              ["Winning Your Match", 2],
              ["Eliminating a BR Participant", 2],
              ["Winning the Battle Royal", 8],
            ].map(([action, pts], i) => (
              <tr key={i} style={{ borderBottom: "1px solid #ddd" }}>
                <td style={tdStyle}>{action}</td>
                <td style={tdStyle}>{pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Title points (end of month) */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.35rem", marginBottom: 12 }}>Title points</h2>
        <p style={{ color: "#555", marginBottom: 16 }}>
          Awarded to whoever holds the belt at the end of the last day of each month.
        </p>
        <div className="points-grid">
          <EventTable
            title="Men's Division"
            rows={[
              ["Undisputed WWE Champion", 10],
              ["Heavy Weight Champion", 10],
              ["Intercontinental Champion", 8],
              ["US Champion", 7],
              ["Tag Team Champion (per member)", 4],
            ]}
          />
          <EventTable
            title="Women's Division"
            rows={[
              ["WWE Women's Champion", 10],
              ["Women's World Champion", 10],
              ["Intercontinental Champion", 8],
              ["US Champion", 7],
              ["Tag Team Champion (per member)", 4],
            ]}
          />
        </div>
      </section>

      {/* Major PLE — Big Four */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.35rem", marginBottom: 12 }}>Major premium live events — The Big Four</h2>
        <div className="points-grid">
          <EventTable
            title="WrestleMania"
            rows={[
              ["Winning Main Event Night Two at WrestleMania", 40],
              ["Main Eventing Night Two at WrestleMania", 30],
              ["Winning Night One Main Event at WrestleMania", 30],
              ["Main Eventing Night One at WrestleMania", 25],
              ["Winning Non-ME Match at WrestleMania", 16],
              ["Being on the Non-ME Card at WrestleMania", 8],
            ]}
          />
          <EventTable
            title="SummerSlam"
            rows={[
              ["Winning the Main Event at SummerSlam (either night)", 20],
              ["Main Eventing Night Two of SummerSlam", 15],
              ["Main Eventing Night One of SummerSlam", 10],
              ["Winning Your Match", 10],
              ["Being on the Non-ME Card", 5],
            ]}
          />
          <EventTable
            title="Survivor Series War Games"
            rows={[
              ["Winning the Main Event", 15],
              ["Main Eventing", 12],
              ["Winning Your Match", 10],
              ["Wrestler Who Makes the Pin", 10],
              ["Being on a War Games Team", 8],
              ["Winning War Games", 14],
              ["Being on the Non-ME Card", 5],
              ["Point bonus for entry order (1st = 5 pts, 5th = 1 pt)", "1–5"],
            ]}
          />
          <EventTable
            title="Royal Rumble"
            rows={[
              ["Winning the Royal Rumble", 30],
              ["Winning the Main Event", 15],
              ["Main Eventing", 12],
              ["Iron Man / Iron Woman", 12],
              ["Person Who Eliminates the Most", 12],
              ["Winning Your Match", 10],
              ["Points for Each Person Eliminated", 3],
              ["Being on the Non-ME Card", 5],
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
            rows={[
              ["Participant (being in the match)", 10],
              ["Winning the Elimination Chamber", 30],
              ["Qualifying for the Elimination Chamber", 10],
              ["Eliminating an Opponent in the Chamber", 10],
              ["Longest Lasting Participant in the Chamber", 15],
              ["Winning the Main Event", 15],
              ["Main Eventing", 9],
              ["Winning Your Match", 8],
              ["Being on the Match Card (non-main event)", 4],
            ]}
          />
          <EventTable
            title="Night of Champions"
            rows={[
              ["Winning the Main Event", 15],
              ["Main Eventing", 9],
              ["Winning Your Match", 8],
              ["Being on the Match Card (non-main event)", 4],
            ]}
          />
          <EventTable
            title="King & Queen of the Ring"
            rows={[
              ["King or Queen of the Ring", 20],
              ["Finals Qualification", 10],
              ["Semi-Finals Qualification (in addition to Raw/SmackDown match points)", 7],
              ["First Round Qualification (in addition to Raw/SmackDown match points)", 3],
            ]}
          />
          <EventTable
            title="Money in the Bank"
            rows={[
              ["Money in the Bank Winner", 25],
              ["Earning a Spot in the Ladder Match", 12],
              ["Winning the Main Event", 15],
              ["Main Eventing", 9],
              ["Winning Your Match", 8],
              ["Being on the Match Card (non-main event)", 4],
            ]}
          />
          <EventTable
            title="Crown Jewel"
            rows={[
              ["Winning the Crown Jewel Championship", 20],
              ["Crown Jewel Championship (participating)", 10],
              ["Winning the Main Event (non-CJ Championship)", 15],
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
          Same base values for: Saturday Night’s Main Event, Backlash, Clash in Paris, WrestlePalooza. Evolution also includes Battle Royal points below.
        </p>
        <div className="points-grid">
          <EventTable
            title="Saturday Night's Main Event / Backlash / Clash in Paris / WrestlePalooza"
            rows={[
              ["Winning the Main Event", 12],
              ["Main Eventing", 7],
              ["Winning Your Match", 6],
              ["Being on the Match Card (non-main event)", 3],
            ]}
          />
          <EventTable
            title="Evolution (includes Battle Royal)"
            rows={[
              ["Winning the Main Event", 12],
              ["Main Eventing", 7],
              ["Winning Your Match", 6],
              ["Being on the Match Card (non-main event)", 3],
              ["Entering the Battle Royal", 1],
              ["Eliminating a BR Participant", 2],
              ["Winning the Battle Royal", 8],
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
