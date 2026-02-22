"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/wrestlers", label: "Add Wrestlers" },
  { href: "/wrestlers/watch", label: "Watch List" },
  { href: "/wrestlers/added-dropped", label: "Added / Dropped" },
  { href: "/wrestlers/waiver", label: "Waiver Order" },
] as const;

export function WrestlersSubNav() {
  const pathname = usePathname();

  return (
    <nav className="wrestlers-subnav" aria-label="Wrestlers section">
      <ul className="wrestlers-subnav-list">
        {LINKS.map(({ href, label }) => {
          const isActive =
            href === "/wrestlers"
              ? pathname === "/wrestlers" || pathname === "/wrestlers/"
              : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`wrestlers-subnav-link ${isActive ? "is-active" : ""}`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
