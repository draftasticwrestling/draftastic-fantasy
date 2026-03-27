"use client";

import { factionDisplayName } from "@/lib/factionName";
import type { LeagueMember } from "@/lib/leagues";
import { RemoveManagerButton } from "../RemoveManagerButton";

type Props = {
  leagueSlug: string;
  members: LeagueMember[];
};

/**
 * GM Tools only. Lists non-GM members with Remove manager action.
 * Only shown when draft has not started (caller hides section when draft started).
 */
export function RemoveOwnerSection({ leagueSlug, members }: Props) {
  const owners = members.filter((m) => m.role !== "commissioner");
  if (owners.length === 0) return null;

  return (
    <section aria-labelledby="remove-manager-heading" style={{ marginBottom: 32 }}>
      <h2 id="remove-manager-heading" style={{ fontSize: "1.25rem", marginBottom: 12 }}>
        Remove manager
      </h2>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 12 }}>
        Remove a manager from the league. Their slot can be refilled by someone else. This is only available before the draft starts.
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {owners.map((m) => {
          const teamLabel = factionDisplayName(m, "Unknown");
          return (
            <li
              key={m.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "8px 0",
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              <span style={{ fontWeight: 500 }}>{teamLabel}</span>
              <RemoveManagerButton leagueSlug={leagueSlug} userId={m.user_id} teamLabel={teamLabel} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
