import Link from "next/link";

export const metadata = {
  title: "Offline Draft Guide — Draftastic Fantasy",
  description: "How to prepare, run, and finalize an offline draft in your league.",
};

export default function OfflineDraftGuidePage() {
  return (
    <main className="app-page" style={{ maxWidth: 820, margin: "0 auto", paddingTop: 10 }}>
      <p style={{ marginBottom: 14 }}>
        <Link href="/how-it-works" className="app-link" style={{ fontWeight: 600 }}>
          ← How it Works
        </Link>
      </p>
      <h1 style={{ fontSize: "1.6rem", marginBottom: 10 }}>Offline Draft Guide</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 22 }}>
        Running an offline fantasy draft is simple, flexible, and a great way to bring everyone together. Follow these
        steps to keep things organized and running smoothly.
      </p>

      <section style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: "1.15rem", marginBottom: 8 }}>1) Prepare your materials</h2>
        <p style={{ marginBottom: 8 }}>Before the draft begins, make sure all owners have access to:</p>
        <ul style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.6 }}>
          <li>A complete available wrestlers list (printed or digital)</li>
          <li>A roster sheet to track their picks</li>
          <li>Any scoring rules or roster requirements</li>
        </ul>
        <p style={{ margin: "10px 0 8px" }}>Optional but helpful:</p>
        <ul style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.6 }}>
          <li>A draft board (whiteboard, poster board, or shared spreadsheet)</li>
          <li>Stickers or markers for tracking picks visually</li>
        </ul>
      </section>

      <section style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: "1.15rem", marginBottom: 8 }}>2) Randomize the draft order</h2>
        <p style={{ marginBottom: 8 }}>Determine the draft order ahead of time using a fair method:</p>
        <ul style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.6 }}>
          <li>Random number generator</li>
          <li>Drawing names from a hat</li>
          <li>Online draft order tools</li>
        </ul>
        <p style={{ marginTop: 10 }}>
          Announce the order clearly before starting. If you want to add some strategy, allow owners to choose their draft
          position based on the randomized results.
        </p>
      </section>

      <section style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: "1.15rem", marginBottom: 8 }}>3) Explain the snake draft format</h2>
        <p style={{ marginBottom: 8 }}>Most offline drafts use a snake format, which works like this:</p>
        <ul style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.6 }}>
          <li>Round 1 goes in standard order (1 → last)</li>
          <li>Round 2 reverses (last → 1)</li>
          <li>This pattern repeats for all rounds</li>
        </ul>
        <p style={{ margin: "10px 0 6px" }}>Example with 4 teams:</p>
        <p style={{ margin: 0, lineHeight: 1.6 }}>Round 1: 1, 2, 3, 4</p>
        <p style={{ margin: 0, lineHeight: 1.6 }}>Round 2: 4, 3, 2, 1</p>
        <p style={{ margin: 0, lineHeight: 1.6 }}>Round 3: 1, 2, 3, 4</p>
        <p style={{ marginTop: 10 }}>
          This format balances fairness by giving later picks a quicker turnaround.
        </p>
      </section>

      <section style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: "1.15rem", marginBottom: 8 }}>4) Set a time limit for picks</h2>
        <p style={{ marginBottom: 8 }}>To keep things moving:</p>
        <ul style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.6 }}>
          <li>Set a time limit per pick (typically 60–120 seconds)</li>
          <li>Have a timer ready (phone or app works fine)</li>
        </ul>
        <p style={{ margin: "10px 0 8px" }}>If a player exceeds the time limit, you can:</p>
        <ul style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.6 }}>
          <li>Skip their pick temporarily</li>
          <li>Auto-assign the best available wrestler</li>
        </ul>
      </section>

      <section style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: "1.15rem", marginBottom: 8 }}>5) Make and track picks</h2>
        <p style={{ marginBottom: 8 }}>As the draft progresses:</p>
        <ul style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.6 }}>
          <li>Each owner announces their selection clearly</li>
          <li>The pick is recorded on the draft board and/or shared tracker</li>
          <li>Owners should also track their own rosters</li>
        </ul>
        <p style={{ marginTop: 10 }}>
          Consistency matters here. One missed pick can snowball into chaos, so assign a dedicated scorekeeper or
          commissioner (GM) to track everything.
        </p>
      </section>

      <section style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: "1.15rem", marginBottom: 8 }}>6) Monitor rosters and eligibility</h2>
        <p style={{ marginBottom: 8 }}>Ensure all picks:</p>
        <ul style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.6 }}>
          <li>Meet roster requirements</li>
          <li>Only include available wrestlers (no duplicates unless your rules allow it)</li>
        </ul>
        <p style={{ marginTop: 10 }}>
          The GM should help resolve disputes or clarify rules in real time.
        </p>
      </section>

      <section style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: "1.15rem", marginBottom: 8 }}>7) Finalize the draft results</h2>
        <p style={{ marginBottom: 8 }}>Once the draft is complete:</p>
        <ul style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.6 }}>
          <li>Double-check all rosters for accuracy</li>
          <li>Confirm each owner&apos;s team</li>
        </ul>
      </section>

      <section style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: "1.15rem", marginBottom: 8 }}>8) Enter rosters into the website</h2>
        <p style={{ marginBottom: 8 }}>After the draft, rosters need to be uploaded to your platform:</p>
        <ul style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.6 }}>
          <li>
            Option 1: Send the final draft sheet into the website (
            <a className="app-link" href="mailto:draftasticwrestling@gmail.com">
              draftasticwrestling@gmail.com
            </a>
            ) and our admin team will input and finalize your rosters.
          </li>
          <li>Option 2: The GM manually inputs all rosters via the website.</li>
        </ul>
        <p style={{ margin: "10px 0 8px" }}>If using manual entry, it&apos;s best to:</p>
        <ul style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.6 }}>
          <li>Work from the official draft board or master sheet</li>
          <li>Have a second person verify entries to avoid errors</li>
        </ul>
      </section>

      <section>
        <h2 style={{ fontSize: "1.15rem", marginBottom: 8 }}>9) Share final rosters</h2>
        <p style={{ marginBottom: 8 }}>Once everything is entered:</p>
        <ul style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.6 }}>
          <li>Publish or share finalized teams with the league</li>
          <li>Give owners a chance to review and report any mistakes</li>
        </ul>
      </section>
    </main>
  );
}
