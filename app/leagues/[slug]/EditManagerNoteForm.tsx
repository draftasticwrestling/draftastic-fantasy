"use client";

import { useActionState } from "react";
import { updateManagerNoteAction } from "./actions";

const DEFAULT_PLACEHOLDER =
  "Welcome to your Draftastic Fantasy league. Your GM can post a note to the entire league and it will appear here.";

export function EditManagerNoteForm(props: {
  leagueSlug: string;
  initialNote: string | null;
}) {
  const { leagueSlug, initialNote } = props;
  const [state, formAction] = useActionState(updateManagerNoteAction, null as { error?: string } | null);
  const value = initialNote?.trim() ?? "";

  return (
    <form action={formAction} style={{ marginTop: 16 }}>
      <input type="hidden" name="league_slug" value={leagueSlug} />
      <label htmlFor="manager_note" style={{ display: "block", fontSize: 14, marginBottom: 6, fontWeight: 500 }}>
        Note
      </label>
      <textarea
        id="manager_note"
        name="manager_note"
        rows={6}
        defaultValue={value}
        placeholder={DEFAULT_PLACEHOLDER}
        style={{
          width: "100%",
          padding: 12,
          fontSize: 14,
          border: "1px solid var(--color-border)",
          borderRadius: 6,
          resize: "vertical",
        }}
      />
      {state?.error && (
        <p style={{ color: "var(--color-red)", fontSize: 14, marginTop: 8 }}>{state.error}</p>
      )}
      <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center" }}>
        <button
          type="submit"
          style={{
            padding: "8px 16px",
            background: "var(--color-blue)",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Save note
        </button>
        <a href={`/leagues/${leagueSlug}`} className="app-link" style={{ fontSize: 14 }}>
          Cancel
        </a>
      </div>
    </form>
  );
}
