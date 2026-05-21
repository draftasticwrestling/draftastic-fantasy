"use client";

import Link from "next/link";
import type { CSSProperties } from "react";

type Props = {
  leagueSlug: string;
  wrestlerId: string;
  wrestlerName: string | null;
  isOnMyRoster: boolean;
  tradeLocked?: boolean;
};

const btnStyle: CSSProperties = {
  display: "inline-block",
  fontSize: 11,
  fontWeight: 700,
  padding: "4px 8px",
  borderRadius: 6,
  textDecoration: "none",
  lineHeight: 1.2,
  whiteSpace: "nowrap",
};

export function SalaryCapTableAddDrop({
  leagueSlug,
  wrestlerId,
  wrestlerName,
  isOnMyRoster,
  tradeLocked = false,
}: Props) {
  const name = wrestlerName || wrestlerId;
  const leaguePath = `/leagues/${encodeURIComponent(leagueSlug)}`;

  if (isOnMyRoster) {
    if (tradeLocked) {
      return (
        <span style={{ fontSize: 10, color: "var(--color-text-muted)" }} title="Pending trade">
          Locked
        </span>
      );
    }
    const href = `${leaguePath}/faction-actions?dropWrestlerId=${encodeURIComponent(wrestlerId)}#request-release`;
    return (
      <Link
        href={href}
        style={{ ...btnStyle, background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" }}
        title={`Drop ${name}`}
        onClick={(e) => {
          if (!window.confirm(`Drop ${name} from your roster?`)) e.preventDefault();
        }}
      >
        Drop
      </Link>
    );
  }

  const href = `${leaguePath}/faction-actions?addFa=${encodeURIComponent(wrestlerId)}#sign-free-agent`;
  return (
    <Link
      href={href}
      style={{ ...btnStyle, background: "var(--color-blue)", color: "#fff" }}
      title={`Sign ${name}`}
    >
      Add
    </Link>
  );
}
