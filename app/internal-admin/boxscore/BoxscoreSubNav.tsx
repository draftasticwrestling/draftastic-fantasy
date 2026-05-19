"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/internal-admin/boxscore/events", label: "Events", match: (p: string) => p.startsWith("/internal-admin/boxscore/events") },
  { href: "/internal-admin/boxscore/wrestlers", label: "Wrestlers", match: (p: string) => p.startsWith("/internal-admin/boxscore/wrestlers") },
  { href: "/internal-admin/boxscore/tag-teams-stables", label: "Tag teams", match: (p: string) => p.startsWith("/internal-admin/boxscore/tag-teams-stables") },
  { href: "/internal-admin/boxscore/championships", label: "Championships", match: (p: string) => p.startsWith("/internal-admin/boxscore/championships") },
  { href: "/internal-admin/boxscore/options", label: "Options", match: (p: string) => p.startsWith("/internal-admin/boxscore/options") },
] as const;

export function BoxscoreSubNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      aria-label="Boxscore admin sections"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        marginBottom: 22,
        paddingBottom: 14,
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      {LINKS.map((item) => {
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
