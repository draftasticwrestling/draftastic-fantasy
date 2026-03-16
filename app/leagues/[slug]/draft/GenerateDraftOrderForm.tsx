"use client";

import { useFormState } from "react-dom";
import { generateDraftOrderWithStateAction } from "./actions";

export function GenerateDraftOrderForm({ leagueSlug }: { leagueSlug: string }) {
  const [state, formAction] = useFormState(generateDraftOrderWithStateAction, null as { error?: string } | null);
  const hasError = Boolean(state?.error);
  const hasSuccess = state != null && !state?.error;

  return (
    <form action={formAction} style={{ marginBottom: 24 }}>
      <input type="hidden" name="league_slug" value={leagueSlug} />
      <button
        type="submit"
        style={{
          padding: "10px 20px",
          background: "#1a73e8",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 16,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Generate draft order
      </button>
      {hasError && (
        <p style={{ marginTop: 8, fontSize: 13, color: "#b91c1c" }}>{state?.error}</p>
      )}
      {hasSuccess && !hasError && (
        <p style={{ marginTop: 8, fontSize: 13, color: "#166534" }}>Draft order generated.</p>
      )}
    </form>
  );
}

