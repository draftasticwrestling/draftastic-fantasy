"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const WRESTLERS_LINKS = [
  {
    href: "/internal-admin/boxscore/wrestlers",
    label: "Wrestlers",
    match: (p: string) => p.startsWith("/internal-admin/boxscore/wrestlers"),
  },
  {
    href: "/internal-admin/boxscore/tag-teams-stables",
    label: "Tag teams & stables",
    match: (p: string) => p.startsWith("/internal-admin/boxscore/tag-teams-stables"),
  },
] as const;

function isWrestlersSection(pathname: string): boolean {
  return (
    pathname === "/internal-admin/boxscore" ||
    pathname === "/internal-admin/boxscore/" ||
    pathname.startsWith("/internal-admin/boxscore/wrestlers") ||
    pathname.startsWith("/internal-admin/boxscore/tag-teams-stables")
  );
}

/** Sub-nav for the Wrestlers section (wrestlers + tag teams / stables). */
export function BoxscoreSubNav() {
  const pathname = usePathname() ?? "";
  if (!isWrestlersSection(pathname)) return null;

  return (
    <nav
      aria-label="Wrestlers admin sections"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        marginBottom: 22,
        paddingBottom: 14,
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      {WRESTLERS_LINKS.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              padding: "6px 12px",
              borderRadius: "var(--radius-sm)",
              fontSize: 14,
              fontWeight: active ? 600 : 500,
              textDecoration: "none",
              color: active ? "var(--color-blue)" : "var(--color-text-muted)",
              background: active ? "var(--color-blue-bg)" : "transparent",
              border: `1px solid ${active ? "var(--color-border)" : "transparent"}`,
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
