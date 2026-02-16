import React from "react";
import styles from "./PageLayout.module.css";

export default function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.topAd}>Ad placeholder (banner)</div>
      <div className={styles.columns}>
        <div className={styles.main}>{children}</div>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarAd}>Ad placeholder (sidebar)</div>
          <div className={styles.sidebarAd}>Ad placeholder (sidebar)</div>
        </aside>
      </div>
    </div>
  );
}
