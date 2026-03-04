"use client";

import { useFormState } from "react-dom";
import { deleteLeagueFormAction } from "../actions";
import { useState } from "react";

type Props = {
  leagueSlug: string;
  leagueName: string;
};

export function DeleteLeagueSection({ leagueSlug, leagueName }: Props) {
  const [confirmName, setConfirmName] = useState("");
  const [confirmChecked, setConfirmChecked] = useState(false);

  const [state, formAction] = useFormState(deleteLeagueFormAction, null as { error?: string } | null);

  const nameMatches = confirmName.trim() === leagueName;
  const canSubmit = confirmChecked && nameMatches;

  return (
    <section aria-labelledby="delete-league-heading" style={{ marginBottom: 32 }}>
      <h2 id="delete-league-heading" style={{ fontSize: "1.25rem", marginBottom: 12, color: "var(--color-red, #c00)" }}>
        Delete League
      </h2>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 16, maxWidth: 560 }}>
        Permanently delete this league and all its data: rosters, draft order, settings, and membership.
        This cannot be undone.
      </p>

      <form action={formAction} style={{ maxWidth: 480 }}>
        <input type="hidden" name="league_slug" value={leagueSlug} />

        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              name="confirm_irreversible"
              checked={confirmChecked}
              onChange={(e) => setConfirmChecked(e.target.checked)}
              style={{ marginTop: 4, flexShrink: 0 }}
              aria-describedby="confirm-desc"
            />
            <span id="confirm-desc">
              I understand that this will permanently delete the league and all its data, and this action cannot be undone.
            </span>
          </label>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="confirm_league_name" style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
            Type the league name to confirm: <strong>{leagueName}</strong>
          </label>
          <input
            id="confirm_league_name"
            name="confirm_league_name"
            type="text"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={leagueName}
            className="app-input"
            style={{ width: "100%", maxWidth: 320 }}
            autoComplete="off"
          />
          {confirmName.trim() && !nameMatches && (
            <p style={{ color: "var(--color-red)", fontSize: 14, marginTop: 6 }}>
              The name must match exactly.
            </p>
          )}
        </div>

        {state?.error && (
          <p style={{ color: "var(--color-red)", marginBottom: 12 }}>{state.error}</p>
        )}

        <button
          type="submit"
          className="app-btn-primary"
          disabled={!canSubmit}
          style={{
            backgroundColor: "var(--color-red, #c00)",
            borderColor: "var(--color-red, #c00)",
          }}
        >
          Delete League
        </button>
      </form>
    </section>
  );
}
