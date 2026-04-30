"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type MemberOption = {
  user_id: string;
  display_name?: string | null;
  team_name?: string | null;
  role: "commissioner" | "owner";
};

type Props = {
  leagueSlug: string;
  members: MemberOption[];
};

function memberLabel(m: MemberOption): string {
  const team = (m.team_name ?? "").trim();
  const name = (m.display_name ?? "").trim();
  if (team && name) return `${team} (${name})`;
  if (team) return team;
  if (name) return name;
  return `${m.user_id.slice(0, 8)}…`;
}

export function AdminOwnerPerspectiveSwitcher({ leagueSlug, members }: Props) {
  const sorted = useMemo(
    () =>
      [...members].sort((a, b) => {
        if (a.role !== b.role) return a.role === "commissioner" ? -1 : 1;
        return memberLabel(a).localeCompare(memberLabel(b), undefined, { sensitivity: "base" });
      }),
    [members]
  );
  const [selectedUserId, setSelectedUserId] = useState(sorted[0]?.user_id ?? "");
  const selected = sorted.find((m) => m.user_id === selectedUserId) ?? sorted[0] ?? null;
  if (!selected) return null;

  const teamHref = `/leagues/${leagueSlug}/team/${encodeURIComponent(selected.user_id)}`;
  const scoreboardHref = `${teamHref}/scoreboard`;
  const formerRosterHref = `${teamHref}/former-roster`;

  return (
    <section
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: 10,
        border: "1px solid var(--color-border)",
        background: "var(--color-bg-elevated)",
      }}
      aria-label="Admin owner perspective tools"
    >
      <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 14 }}>Admin owner perspective</p>
      <p style={{ margin: "0 0 10px", color: "var(--color-text-muted)", fontSize: 13 }}>
        Select an owner to quickly review their roster and scoreboard views.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <select
          value={selected.user_id}
          onChange={(e) => setSelectedUserId(e.target.value)}
          style={{ minWidth: 260, padding: "8px 10px" }}
        >
          {sorted.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {memberLabel(m)}
              {m.role === "commissioner" ? " (GM)" : ""}
            </option>
          ))}
        </select>
        <Link href={teamHref} className="lm-btn-secondary">
          View roster POV
        </Link>
        <Link href={scoreboardHref} className="lm-btn-secondary">
          View scoreboard POV
        </Link>
        <Link href={formerRosterHref} className="lm-btn-secondary">
          Former roster
        </Link>
      </div>
    </section>
  );
}
