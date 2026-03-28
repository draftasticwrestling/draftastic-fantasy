"use client";

import { useState } from "react";
import styles from "./EventResults.module.css";

type Props = {
  summary: string | null;
  commentary: string | null;
  statistics: string | null;
};

export function EventMatchTabs({ summary, commentary, statistics }: Props) {
  const tabs = [
    { id: "summary" as const, label: "Summary", body: summary },
    { id: "commentary" as const, label: "Commentary", body: commentary },
    { id: "statistics" as const, label: "Statistics", body: statistics },
  ].filter((t) => t.body && t.body.trim());

  if (tabs.length === 0) return null;

  const [active, setActive] = useState(tabs[0].id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div className={styles.matchTabs}>
      <div className={styles.matchTabBar} role="tablist" aria-label="Match details">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            className={active === t.id ? styles.matchTabActive : styles.matchTab}
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        className={styles.matchTabPanel}
      >
        {(current.body ?? "").split(/\n\n+/).map((para, i) => (
          <p key={i} className={styles.matchTabPara}>
            {para}
          </p>
        ))}
      </div>
    </div>
  );
}
