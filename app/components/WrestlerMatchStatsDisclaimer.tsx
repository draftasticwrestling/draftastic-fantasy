import type { CSSProperties } from "react";

/**
 * Match stats on profiles and stat tables are limited to televised 2025–26 scope; same note as /wrestlers.
 */
export function WrestlerMatchStatsDisclaimer({
  style,
  className,
}: {
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <p
      className={className}
      style={{
        margin: "0 0 16px",
        maxWidth: 720,
        fontSize: 14,
        lineHeight: 1.5,
        color: "var(--color-text-muted)",
        ...style,
      }}
    >
      Wrestler match statistics are currently based on 2025 and 2026 televised events. House shows and Main Event are not
      included.
    </p>
  );
}
