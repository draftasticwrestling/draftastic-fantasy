"use client";

import { useFormState } from "react-dom";
import { createLeagueAction, type CreateLeagueState } from "./new/actions";
import { SEASON_OPTIONS } from "@/lib/leagueSeasons";

const currentYear = new Date().getFullYear();
const SEASON_YEARS = [currentYear, currentYear + 1];

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
      <div>
        <label htmlFor="league-season" style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
          Season *
        </label>
        <select
          id="league-season"
          name="season_slug"
          required
          style={{
            width: "100%",
            padding: "10px 12px",
            fontSize: 16,
            border: "1px solid #ccc",
            borderRadius: 6,
            boxSizing: "border-box",
          }}
        >
          <option value="">Select a season</option>
          {SEASON_OPTIONS.map((s) => (
            <option key={s.id} value={s.slug}>
              {s.name} — {s.windowDescription}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="league-year" style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
          Season year *
        </label>
        <select
          id="league-year"
          name="season_year"
          required
          style={{
            width: "100%",
            padding: "10px 12px",
            fontSize: 16,
            border: "1px solid #ccc",
            borderRadius: 6,
            boxSizing: "border-box",
          }}
        >
          {SEASON_YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="league-draft" style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
          Draft date (optional)
        </label>
        <input
          id="league-draft"
          name="draft_date"
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
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "#666" }}>
          If the league starts after the season has begun, set the draft date. Points will count from the first event after the draft.
        </p>
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
