"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function LeagueError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname() ?? "";
  const match = pathname.match(/^\/leagues\/([^/]+)/);
  const leagueSlug = match?.[1] ? decodeURIComponent(match[1]) : null;
  const backHref = leagueSlug ? `/leagues/${encodeURIComponent(leagueSlug)}` : "/leagues";

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 640, margin: "0 auto" }}>
      <p style={{ marginBottom: 24 }}>
        <Link href={backHref} style={{ color: "#1a73e8", textDecoration: "none" }}>
          ← League
        </Link>
      </p>
      <h1 style={{ fontSize: "1.25rem", marginBottom: 16 }}>Something went wrong</h1>
      <p style={{ color: "#666", marginBottom: 16 }}>
        We couldn’t load this league. You may need to sign in, or the league may not exist.
      </p>
      <div style={{ display: "flex", gap: 12 }}>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            padding: "8px 16px",
            background: "#1a73e8",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
        <Link
          href={backHref}
          style={{
            padding: "8px 16px",
            color: "#1a73e8",
            textDecoration: "none",
            fontSize: 14,
          }}
        >
          Back to League
        </Link>
      </div>
    </main>
  );
}
