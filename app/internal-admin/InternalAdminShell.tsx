"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./internal-admin.module.css";

const NAV = [
  { href: "/internal-admin", label: "Home", match: (p: string) => p === "/internal-admin" },
  {
    href: "/internal-admin/users",
    label: "Users",
    match: (p: string) => p.startsWith("/internal-admin/users"),
  },
  {
    href: "/internal-admin/leagues",
    label: "Leagues",
    match: (p: string) => p.startsWith("/internal-admin/leagues"),
  },
  {
    href: "/internal-admin/engagement",
    label: "Engagement",
    match: (p: string) => p.startsWith("/internal-admin/engagement"),
  },
  {
    href: "/internal-admin/weekly-leaderboards",
    label: "Weekly XP",
    match: (p: string) => p.startsWith("/internal-admin/weekly-leaderboards"),
  },
  {
    href: "/internal-admin/boxscore/events",
    label: "Events",
    match: (p: string) =>
      p.startsWith("/internal-admin/boxscore/events") ||
      p.startsWith("/internal-admin/events"),
  },
  {
    href: "/internal-admin/boxscore",
    label: "Boxscore",
    match: (p: string) =>
      p.startsWith("/internal-admin/boxscore") && !p.startsWith("/internal-admin/boxscore/events"),
  },
  {
    href: "/internal-admin/stat-corrections",
    label: "Corrections",
    match: (p: string) => p.startsWith("/internal-admin/stat-corrections"),
  },
  {
    href: "/internal-admin/breaking-news",
    label: "Breaking news",
    match: (p: string) => p.startsWith("/internal-admin/breaking-news"),
  },
  {
    href: "/internal-admin/articles",
    label: "Articles",
    match: (p: string) => p.startsWith("/internal-admin/articles"),
  },
  {
    href: "/internal-admin/draft-testing",
    label: "Draft testing",
    match: (p: string) => p.startsWith("/internal-admin/draft-testing"),
  },
] as const;

export function InternalAdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";

  return (
    <div className={styles.wrap}>
      <header className={styles.top}>
        <Link href="/internal-admin" className={styles.brand}>
          Draftastic
          <span className={styles.brandMuted}>Site admin</span>
        </Link>
        <nav className={styles.nav} aria-label="Site admin">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} data-active={item.match(pathname) ? "true" : undefined}>
              {item.label}
            </Link>
          ))}
          <Link href="/">Exit to site</Link>
        </nav>
      </header>
      <div className={styles.main}>{children}</div>
      <p className={styles.footerNote}>
        Privileged area — changes may affect live leagues and published content.{" "}
        <Link href="/news">View news</Link>
      </p>
    </div>
  );
}
