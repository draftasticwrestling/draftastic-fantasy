import Link from "next/link";
import { Suspense } from "react";
import { HowItWorksPublicLeague } from "./HowItWorksPublicLeague";
import { HowItWorksRoadToWarGames } from "./HowItWorksRoadToWarGames";
import { HowItWorksRoadToSummerSlam } from "./HowItWorksRoadToSummerSlam";
import { HowItWorksSeasonPlaceholder } from "./HowItWorksSeasonPlaceholder";
import { HowItWorksTabs } from "./HowItWorksTabs";
import { parseHowItWorksTabParam } from "./howItWorksTabConfig";
import styles from "./HowItWorks.module.css";

export const metadata = {
  title: "How it Works — Draftastic Fantasy",
  description:
    "Public salary cap leagues and Road to season scoring (SummerSlam, War Games, WrestleMania).",
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
        Choose a <strong>season</strong> or <strong>Public League</strong> to see roster rules and scoring for that league
        window.
      </p>

      <Suspense fallback={<TabsFallback />}>
        <HowItWorksTabs
          initialTab={initialTab}
          publicLeague={<HowItWorksPublicLeague />}
          roadToSummerSlam={<HowItWorksRoadToSummerSlam />}
          roadToWarGames={<HowItWorksRoadToWarGames />}
          roadToWrestleMania={
            <HowItWorksSeasonPlaceholder
              seasonName="Road to WrestleMania"
              windowHint="winter–spring season (typically December through WrestleMania Night 2)"
            />
          }
        />
      </Suspense>
    </main>
  );
}
