import Link from "next/link";
import { HowItWorksSpecialMatches } from "./HowItWorksSpecialMatches";

type Props = {
  seasonName: string;
  /** Short description of the window, e.g. "late summer through Survivor Series" */
  windowHint: string;
};

export function HowItWorksSeasonPlaceholder({ seasonName, windowHint }: Props) {
  return (
    <div style={{ padding: "8px 0 24px" }}>
      <p style={{ color: "#555", marginBottom: 20, lineHeight: 1.65 }}>
        <strong>{seasonName}</strong> uses a {windowHint}. Scoring tables for this window will be published here when we open
        this season for new leagues.
      </p>
      <p style={{ marginBottom: 16, lineHeight: 1.65 }}>
        For now, the <Link href="/how-it-works?tab=road-to-summerslam">Road to SummerSlam</Link> tab has the active beta
        schedule, and the <Link href="/how-it-works">Public League</Link> tab shows the full event-type scoring reference
        (Raw, SmackDown, all PLE tiers, and NXT).
      </p>
      <HowItWorksSpecialMatches variant="rts" />
    </div>
  );
}
