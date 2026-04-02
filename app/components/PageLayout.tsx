"use client";

import React from "react";
import { usePathname } from "next/navigation";
import styles from "./PageLayout.module.css";

export default function PageLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/coming-soon" || pathname === "/") {
    return <>{children}</>;
  }

  return <div className={styles.wrapper}>{children}</div>;
}
