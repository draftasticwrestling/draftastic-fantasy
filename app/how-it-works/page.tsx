import Link from "next/link";
import { Suspense } from "react";
import { HowItWorksEngagementTrack } from "@/app/components/HowItWorksEngagementTrack";
import { HowItWorksBeatTheFounders } from "./HowItWorksBeatTheFounders";
import { HowItWorksPublicLeague } from "./HowItWorksPublicLeague";
import { HowItWorksRoadToWarGames } from "./HowItWorksRoadToWarGames";
import { HowItWorksRoadToSummerSlam } from "./HowItWorksRoadToSummerSlam";
import { HowItWorksRoadToWrestleMania } from "./HowItWorksRoadToWrestleMania";
import { HowItWorksTabs } from "./HowItWorksTabs";
import { parseHowItWorksTabParam } from "./howItWorksTabConfig";
import styles from "./HowItWorks.module.css";

export const metadata = {
  title: { absolute: "How Fantasy Pro Wrestling Works — Draftastic" },
  description:
    "How fantasy pro wrestling works on Draftastic: public salary cap leagues, private leagues, and season scoring for SummerSlam, War Games, and WrestleMania.",
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
      <HowItWorksEngagementTrack />
      <p style={{ marginBottom: 24 }}>
        <Link href="/">← Home</Link>
      </p>

      <h1 style={{ marginBottom: 8 }}>How it Works</h1>
      <p style={{ color: "#555", marginBottom: 20 }}>
        Choose <strong>Beat the Founders</strong>, a <strong>season</strong>, or <strong>Public League</strong> to see
        roster rules and scoring for that league.
      </p>

      <Suspense fallback={<TabsFallback />}>
        <HowItWorksTabs
          initialTab={initialTab}
          publicLeague={<HowItWorksPublicLeague />}
          beatTheFounders={<HowItWorksBeatTheFounders />}
          roadToSummerSlam={<HowItWorksRoadToSummerSlam />}
          roadToWarGames={<HowItWorksRoadToWarGames />}
          roadToWrestleMania={<HowItWorksRoadToWrestleMania />}
        />
      </Suspense>
    </main>
  );
}
