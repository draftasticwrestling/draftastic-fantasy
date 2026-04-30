"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type MemberOption = {
  user_id: string;
  role: string;
  team_name: string | null;
  display_name: string | null;
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

export function MemberPovQuickNav({ leagueSlug, members }: Props) {
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
        marginBottom: 20,
        border: "1px solid var(--color-border)",
        borderRadius: 10,
        padding: 12,
        background: "var(--color-bg-elevated)",
      }}
    >
      <h2 style={{ fontSize: "1rem", margin: "0 0 8px" }}>Owner POV quick access</h2>
      <p style={{ margin: "0 0 10px", color: "var(--color-text-muted)", fontSize: 13 }}>
        Jump to exactly what that owner sees for roster and scoreboard review.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <select value={selected.user_id} onChange={(e) => setSelectedUserId(e.target.value)} style={{ minWidth: 280, padding: "8px 10px" }}>
          {sorted.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {memberLabel(m)}
              {m.role === "commissioner" ? " (GM)" : ""}
            </option>
          ))}
        </select>
        <Link href={teamHref} className="admin-article-submit" style={{ textDecoration: "none" }}>
          Roster POV
        </Link>
        <Link href={scoreboardHref} className="admin-article-submit" style={{ textDecoration: "none" }}>
          Scoreboard POV
        </Link>
        <Link href={formerRosterHref} className="admin-article-submit" style={{ textDecoration: "none" }}>
          Former roster
        </Link>
      </div>
    </section>
  );
}
