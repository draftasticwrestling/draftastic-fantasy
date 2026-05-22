import Link from "next/link";
import { HowItWorksMainRosterEventScoring } from "./HowItWorksMainRosterEventScoring";
import { HowItWorksTitlePoints } from "./HowItWorksTitlePoints";

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

      <HowItWorksMainRosterEventScoring />

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
