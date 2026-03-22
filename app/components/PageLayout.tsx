"use client";

import React, { useMemo } from "react";
import { usePathname } from "next/navigation";
import styles from "./PageLayout.module.css";
import SeasonTimelineRail from "./SeasonTimelineRail";

const RESERVED_LEAGUE_SEGMENTS = new Set(["new"]);

function leagueSlugFromPathname(pathname: string | null): string | null {
  if (!pathname) return null;
  const m = pathname.match(/^\/leagues\/([^/]+)(?:\/|$)/);
  const seg = m?.[1];
  if (!seg || RESERVED_LEAGUE_SEGMENTS.has(seg)) return null;
  return seg;
}

export default function PageLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const leagueSlug = useMemo(() => leagueSlugFromPathname(pathname), [pathname]);

  if (pathname === "/coming-soon") {
    return <>{children}</>;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.topAd}>Ad placeholder (banner)</div>
      <div className={styles.columns}>
        <div className={styles.main}>{children}</div>
        <aside className={styles.sidebar}>
          {leagueSlug ? <SeasonTimelineRail leagueSlug={leagueSlug} /> : null}
          <div className={styles.sidebarAd}>Ad placeholder (sidebar)</div>
          <div className={styles.sidebarAd}>Ad placeholder (sidebar)</div>
        </aside>
      </div>
    </div>
  );
}
