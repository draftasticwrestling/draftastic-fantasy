"use client";

import { useFormState } from "react-dom";
import { addRosterEntryAction, type AddRosterState } from "./actions";
import type { LeagueMember } from "@/lib/leagues";

type WrestlerOption = { id: string; name: string | null };

type Props = {
  leagueId: string;
  leagueSlug: string;
  members: LeagueMember[];
  wrestlers: WrestlerOption[];
};

export function AddRosterForm({ leagueId, leagueSlug, members, wrestlers }: Props) {
  const [state, formAction] = useFormState<AddRosterState | null, FormData>(
    addRosterEntryAction,
    null
  );

  return (
    <div
      style={{
        marginBottom: 24,
        padding: 16,
        background: "var(--color-bg-surface)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--color-border)",
      }}
    >
      <h3 style={{ fontSize: "1rem", marginBottom: 12, color: "var(--color-text)" }}>Add wrestler to roster</h3>
      {state?.error && (
        <p
          style={{
            marginBottom: 12,
            padding: "8px 12px",
            background: "var(--color-red-bg)",
            border: "1px solid var(--color-red-muted)",
            borderRadius: "var(--radius-sm)",
            color: "var(--color-red)",
            fontSize: 14,
          }}
        >
          {state.error}
        </p>
      )}
      <form action={formAction} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
        <input type="hidden" name="leagueSlug" value={leagueSlug} />
        <input type="hidden" name="leagueId" value={leagueId} />
        <div>
          <label htmlFor="roster-member" style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--color-text-muted)" }}>
            Member
          </label>
          <select
            id="roster-member"
            name="userId"
            required
            style={{ padding: "8px 12px", minWidth: 160, background: "var(--color-bg-input)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", color: "var(--color-text)" }}
          >
            <option value="">Select member</option>
            {members.map((m) => (
              <option key={m.id} value={m.user_id}>
                {m.display_name?.trim() || "Unknown"}
                {m.role === "commissioner" ? " (Commissioner)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="roster-wrestler" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
            Wrestler
          </label>
          <select
            id="roster-wrestler"
            name="wrestlerId"
            required
            style={{ padding: "8px 12px", minWidth: 200 }}
          >
            <option value="">Select wrestler</option>
            {wrestlers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name ?? w.id}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          style={{
            padding: "8px 16px",
            background: "var(--color-blue)",
            color: "var(--color-text)",
            border: "none",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Add
        </button>
      </form>
    </div>
  );
}
