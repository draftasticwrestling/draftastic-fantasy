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
        background: "#f8f9fa",
        borderRadius: 8,
        border: "1px solid #eee",
      }}
    >
      <h3 style={{ fontSize: "1rem", marginBottom: 12 }}>Add wrestler to roster</h3>
      {state?.error && (
        <p
          style={{
            marginBottom: 12,
            padding: "8px 12px",
            background: "#fff0f0",
            border: "1px solid #fcc",
            borderRadius: 6,
            color: "#c00",
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
          <label htmlFor="roster-member" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
            Member
          </label>
          <select
            id="roster-member"
            name="userId"
            required
            style={{ padding: "8px 12px", minWidth: 160 }}
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
            background: "#333",
            color: "#fff",
            border: "none",
            borderRadius: 6,
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
