"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { HowItWorksTabId } from "./howItWorksTabConfig";
import { HOW_IT_WORKS_TAB_IDS } from "./howItWorksTabConfig";
import styles from "./HowItWorks.module.css";

const TAB_LABELS: Record<HowItWorksTabId, string> = {
  "public-league": "Public League",
  "road-to-summerslam": "Road to SummerSlam",
  "road-to-war-games": "Road to War Games",
  "road-to-wrestlemania": "Road to WrestleMania",
};

type Props = {
  initialTab: HowItWorksTabId;
  publicLeague: React.ReactNode;
  roadToSummerSlam: React.ReactNode;
  roadToWarGames: React.ReactNode;
  roadToWrestleMania: React.ReactNode;
};

export function HowItWorksTabs({
  initialTab,
  publicLeague,
  roadToSummerSlam,
  roadToWarGames,
  roadToWrestleMania,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState<HowItWorksTabId>(initialTab);

  useEffect(() => {
    setActive(initialTab);
  }, [initialTab]);

  const setTab = useCallback(
    (id: HowItWorksTabId) => {
      setActive(id);
      const q = new URLSearchParams(searchParams.toString());
      if (id === "public-league") {
        q.delete("tab");
      } else {
        q.set("tab", id);
      }
      const qs = q.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const panels: Record<HowItWorksTabId, React.ReactNode> = {
    "public-league": publicLeague,
    "road-to-summerslam": roadToSummerSlam,
    "road-to-war-games": roadToWarGames,
    "road-to-wrestlemania": roadToWrestleMania,
  };

  return (
    <div>
      <ul className={styles.tabList} role="tablist" aria-label="Season scoring">
        {HOW_IT_WORKS_TAB_IDS.map((id) => (
          <li key={id} role="presentation">
            <button
              type="button"
              role="tab"
              id={`how-tab-${id}`}
              aria-selected={active === id}
              aria-controls={`how-panel-${id}`}
              className={`${styles.tabButton} ${active === id ? styles.tabButtonActive : ""}`}
              onClick={() => setTab(id)}
            >
              {TAB_LABELS[id]}
            </button>
          </li>
        ))}
      </ul>
      <div
        role="tabpanel"
        id={`how-panel-${active}`}
        aria-labelledby={`how-tab-${active}`}
        className={styles.tabPanel}
        tabIndex={0}
      >
        {panels[active]}
      </div>
    </div>
  );
}
