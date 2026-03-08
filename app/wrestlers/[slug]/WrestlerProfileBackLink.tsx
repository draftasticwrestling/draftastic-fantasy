"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

/**
 * Back link that uses the current URL's ?league= and ?from= so it reliably
 * returns to League Leaders or Free Agents when the user came from there.
 */
export function WrestlerProfileBackLink() {
  const searchParams = useSearchParams();
  const league = searchParams.get("league")?.trim() || null;
  const from = searchParams.get("from")?.trim() || null;

  const href =
    league && from === "league-leaders"
      ? `/leagues/${encodeURIComponent(league)}/wrestlers/league-leaders`
      : league && from === "free-agents"
        ? `/leagues/${encodeURIComponent(league)}/wrestlers/free-agents`
        : "/wrestlers";
  const label =
    from === "league-leaders" ? "League Leaders" : from === "free-agents" ? "Free Agents" : "Wrestlers";

  return (
    <Link href={href} style={{ color: "#1a73e8", textDecoration: "none" }}>
      ← {label}
    </Link>
  );
}
