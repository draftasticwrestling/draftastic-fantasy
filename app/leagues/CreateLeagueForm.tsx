"use client";

import { useFormState } from "react-dom";
import { createLeagueAction, type CreateLeagueState } from "./new/actions";

export function CreateLeagueForm() {
  const [state, formAction] = useFormState(createLeagueAction, null);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <label htmlFor="league-name" style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
          League name *
        </label>
        <input
          id="league-name"
          name="name"
          type="text"
          required
          placeholder="e.g. The Road to SummerSlam"
          maxLength={120}
          style={{
            width: "100%",
            padding: "10px 12px",
            fontSize: 16,
            border: "1px solid #ccc",
            borderRadius: 6,
            boxSizing: "border-box",
          }}
        />
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 140px" }}>
          <label htmlFor="league-start" style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
            Start date
          </label>
          <input
            id="league-start"
            name="start_date"
            type="date"
            style={{
              width: "100%",
              padding: "10px 12px",
              fontSize: 16,
              border: "1px solid #ccc",
              borderRadius: 6,
              boxSizing: "border-box",
            }}
          />
        </div>
        <div style={{ flex: "1 1 140px" }}>
          <label htmlFor="league-end" style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
            End date
          </label>
          <input
            id="league-end"
            name="end_date"
            type="date"
            style={{
              width: "100%",
              padding: "10px 12px",
              fontSize: 16,
              border: "1px solid #ccc",
              borderRadius: 6,
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>
      {state?.error && (
        <p style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}>{state.error}</p>
      )}
      <button
        type="submit"
        style={{
          padding: "12px 16px",
          fontSize: 16,
          fontWeight: 600,
          border: "none",
          borderRadius: 8,
          background: "#1a73e8",
          color: "#fff",
          cursor: "pointer",
        }}
      >
        Create league
      </button>
    </form>
  );
}
