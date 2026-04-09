import Link from "next/link";
import { Suspense } from "react";
import { HowItWorksLegacyContent } from "./HowItWorksLegacyContent";
import { HowItWorksRoadToSummerSlam } from "./HowItWorksRoadToSummerSlam";
import { HowItWorksSeasonPlaceholder } from "./HowItWorksSeasonPlaceholder";
import { HowItWorksTabs } from "./HowItWorksTabs";
import { parseHowItWorksTabParam } from "./howItWorksTabConfig";
import styles from "./HowItWorks.module.css";

export const metadata = {
  title: "How it Works — Draftastic Fantasy",
  description:
    "Season scoring (Road to SummerSlam, Survivor Series, WrestleMania) and Legacy year-round rules: fantasy points, event types, and titles.",
};

function TabsFallback() {
  return (
    <div style={{ padding: "24px 0", color: "var(--color-text-muted)" }} aria-hidden>
      Loading…
    </div>
  );
}

export default async function HowItWorksPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const initialTab = parseHowItWorksTabParam(sp.tab);

  return (
    <main className={styles.page}>
      <p style={{ marginBottom: 24 }}>
        <Link href="/">← Home</Link>
      </p>

      <h1 style={{ marginBottom: 8 }}>How it Works</h1>
      <p style={{ color: "#555", marginBottom: 20 }}>
        Choose a <strong>season</strong> to see what counts for that league window, or open <strong>Legacy League</strong> for
        the full year-round reference (all event types).
      </p>

      <Suspense fallback={<TabsFallback />}>
        <HowItWorksTabs
          initialTab={initialTab}
          roadToSummerSlam={<HowItWorksRoadToSummerSlam />}
          roadToSurvivorSeries={
            <HowItWorksSeasonPlaceholder
              seasonName="Road to Survivor Series"
              windowHint="shorter fall season (typically August through Survivor Series)"
            />
          }
          roadToWrestleMania={
            <HowItWorksSeasonPlaceholder
              seasonName="Road to WrestleMania"
              windowHint="winter–spring season (typically December through WrestleMania Night 2)"
            />
          }
          legacyLeague={<HowItWorksLegacyContent />}
        />
      </Suspense>
    </main>
  );
}
