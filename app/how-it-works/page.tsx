import Link from "next/link";

export const metadata = {
  title: "How it Works — Draftastic Fantasy",
  description: "Fantasy scoring system for pro wrestling: event types, match points, titles, and special matches.",
};

export default function HowItWorksPage() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 960, margin: "0 auto", fontSize: 18, lineHeight: 1.6 }}>
      <p style={{ marginBottom: 24 }}>
        <Link href="/">← Home</Link>
      </p>

      <h1 style={{ marginBottom: 8 }}>How it Works</h1>
      <p style={{ color: "#555", marginBottom: 32 }}>
        Fantasy points are calculated from <strong>Pro Wrestling Boxscore</strong> event data. Your wrestlers earn points for appearing, winning, main eventing, and title matches — with bonuses for premium live events (PLEs) and special match types.
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.35rem", marginBottom: 12 }}>Point categories</h2>
        <p>
          Each wrestler’s total for a match is the sum of:
        </p>
        <ul>
          <li><strong>Match points</strong> — Appearance (on card) + win bonus, scaled by event type</li>
          <li><strong>Main event points</strong> — Extra for main eventing the show</li>
          <li><strong>Title points</strong> — Title win or title defense</li>
          <li><strong>Special points</strong> — Royal Rumble, War Games, Elimination Chamber, Money in the Bank, etc.</li>
          <li><strong>Battle royal points</strong> — Entry and winner bonus for battle royals</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.35rem", marginBottom: 12 }}>TV shows (RAW / SmackDown)</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #333", textAlign: "left" }}>
              <th style={{ padding: "8px 12px" }}>Situation</th>
              <th style={{ padding: "8px 12px" }}>Points</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: "1px solid #ddd" }}><td style={{ padding: "8px 12px" }}>On match card (appearance)</td><td style={{ padding: "8px 12px" }}>+1</td></tr>
            <tr style={{ borderBottom: "1px solid #ddd" }}><td style={{ padding: "8px 12px" }}>Winning a match</td><td style={{ padding: "8px 12px" }}>+2</td></tr>
            <tr style={{ borderBottom: "1px solid #ddd" }}><td style={{ padding: "8px 12px" }}>Main eventing</td><td style={{ padding: "8px 12px" }}>+3</td></tr>
            <tr style={{ borderBottom: "1px solid #ddd" }}><td style={{ padding: "8px 12px" }}>Winning the main event</td><td style={{ padding: "8px 12px" }}>+4</td></tr>
          </tbody>
        </table>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.35rem", marginBottom: 12 }}>Premium live events (PLEs)</h2>
        <p style={{ marginBottom: 12 }}>
          Bigger events give higher appearance and win bonuses. “On card” points are always awarded (including for No Contest); win and main event bonuses only apply when there is a clear winner.
        </p>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 15 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #333", textAlign: "left" }}>
              <th style={{ padding: "8px 12px" }}>Event</th>
              <th style={{ padding: "8px 12px" }}>On card</th>
              <th style={{ padding: "8px 12px" }}>Win</th>
              <th style={{ padding: "8px 12px" }}>Main event (bonus)</th>
              <th style={{ padding: "8px 12px" }}>Win main event</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "8px 12px" }}>WrestleMania Night 1</td>
              <td style={{ padding: "8px 12px" }}>+6</td>
              <td style={{ padding: "8px 12px" }}>+12</td>
              <td style={{ padding: "8px 12px" }}>+20</td>
              <td style={{ padding: "8px 12px" }}>+25</td>
            </tr>
            <tr style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "8px 12px" }}>WrestleMania Night 2</td>
              <td style={{ padding: "8px 12px" }}>+6</td>
              <td style={{ padding: "8px 12px" }}>+12</td>
              <td style={{ padding: "8px 12px" }}>+25</td>
              <td style={{ padding: "8px 12px" }}>+35</td>
            </tr>
            <tr style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "8px 12px" }}>SummerSlam</td>
              <td style={{ padding: "8px 12px" }}>+5</td>
              <td style={{ padding: "8px 12px" }}>+10</td>
              <td style={{ padding: "8px 12px" }}>+10 (N1) / +15 (N2)</td>
              <td style={{ padding: "8px 12px" }}>+20</td>
            </tr>
            <tr style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "8px 12px" }}>Survivor Series</td>
              <td style={{ padding: "8px 12px" }}>+5</td>
              <td style={{ padding: "8px 12px" }}>+10</td>
              <td style={{ padding: "8px 12px" }}>+12</td>
              <td style={{ padding: "8px 12px" }}>+15</td>
            </tr>
            <tr style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "8px 12px" }}>Royal Rumble (non-Rumble match)</td>
              <td style={{ padding: "8px 12px" }}>+5</td>
              <td style={{ padding: "8px 12px" }}>+10</td>
              <td style={{ padding: "8px 12px" }}>+12</td>
              <td style={{ padding: "8px 12px" }}>+15</td>
            </tr>
            <tr style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "8px 12px" }}>Elimination Chamber / Crown Jewel / Night of Champions / MITB (non-special match)</td>
              <td style={{ padding: "8px 12px" }}>+4</td>
              <td style={{ padding: "8px 12px" }}>+8</td>
              <td style={{ padding: "8px 12px" }}>+9</td>
              <td style={{ padding: "8px 12px" }}>+15</td>
            </tr>
            <tr style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "8px 12px" }}>Other PLEs (e.g. Backlash, Saturday Night’s Main Event)</td>
              <td style={{ padding: "8px 12px" }}>+3</td>
              <td style={{ padding: "8px 12px" }}>+6</td>
              <td style={{ padding: "8px 12px" }}>+7</td>
              <td style={{ padding: "8px 12px" }}>+12</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.35rem", marginBottom: 12 }}>Titles</h2>
        <ul>
          <li><strong>Title win</strong> (new champion): +5</li>
          <li><strong>Title defense</strong> (retention): +4</li>
          <li><strong>Title defense via DQ</strong>: +2</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.35rem", marginBottom: 12 }}>Special matches</h2>
        <ul>
          <li><strong>Battle royal</strong> — Entry: +1; Winner: +8</li>
          <li><strong>Royal Rumble match</strong> — Participant: +2; +3 per elimination; Iron Man / Iron Woman: +12; Most eliminations: +12; Winner: +30</li>
          <li><strong>War Games</strong> (Survivor Series) — Team: +8; Winning team: +14</li>
          <li><strong>Elimination Chamber</strong> — Qualifier: +10; Winner: +30</li>
          <li><strong>Money in the Bank ladder match</strong> — Participant: +12; Winner: +25</li>
          <li><strong>Crown Jewel Championship match</strong> — Participant: +10; Winner: +20</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.35rem", marginBottom: 12 }}>Other rules</h2>
        <ul>
          <li><strong>DQ win</strong> — Match points for the winner are <strong>halved</strong> (rounded down). Title and main event bonuses are unchanged.</li>
          <li><strong>No Contest</strong> — Only <strong>appearance</strong> (“on card”) points are awarded. No win or main event bonus.</li>
          <li><strong>Promos / segments</strong> — No points. Segments classified as “Promo” in the data are excluded from scoring.</li>
          <li><strong>Tag teams</strong> — Points are awarded to <strong>individual wrestlers</strong> only (e.g. each member of a tag team gets their own match/win/main event points).</li>
        </ul>
      </section>

      <p style={{ marginTop: 24 }}>
        <Link href="/score">Score an event</Link> to see points in action, or open any <Link href="/">completed event</Link> from the list to view the full breakdown per wrestler.
      </p>
    </main>
  );
}
