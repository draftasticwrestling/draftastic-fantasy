"use client";

import { useFormState } from "react-dom";
import { makeDraftPickWithStateAction } from "./actions";

type Props = {
  leagueSlug: string;
  availableWrestlers: { id: string; name: string | null }[];
};

export function MakePickForm({ leagueSlug, availableWrestlers }: Props) {
  const [state, formAction] = useFormState(makeDraftPickWithStateAction, { error: undefined });

  return (
    <div
      style={{
        padding: 16,
        background: "#f8f9fa",
        borderRadius: 8,
        border: "1px solid #eee",
      }}
    >
      <h3 style={{ fontSize: "1rem", marginBottom: 12 }}>Your pick</h3>
      {state?.error && (
        <p style={{ marginBottom: 12, fontSize: 14, color: "#b91c1c" }}>{state.error}</p>
      )}
      <form
        action={formAction}
        style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}
      >
        <input type="hidden" name="league_slug" value={leagueSlug} />
        <div style={{ flex: "1 1 200px" }}>
          <label htmlFor="draft-wrestler" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
            Select wrestler
          </label>
          <select
            id="draft-wrestler"
            name="wrestler_id"
            required
            style={{
              width: "100%",
              padding: "10px 12px",
              fontSize: 16,
              border: "1px solid #ccc",
              borderRadius: 6,
            }}
          >
            <option value="">Choose…</option>
            {availableWrestlers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name ?? w.id}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          style={{
            padding: "10px 20px",
            background: "#333",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 16,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Submit pick
        </button>
      </form>
    </div>
  );
}
