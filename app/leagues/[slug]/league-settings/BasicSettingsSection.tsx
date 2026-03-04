"use client";

import { useFormState } from "react-dom";
import { updateBasicSettingsFormAction } from "../actions";

const TEAM_COUNTS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] as const;

type Props = {
  leagueSlug: string;
  leagueName: string;
  maxTeams: number | null | undefined;
  autoReactivate: boolean | null | undefined;
};

export function BasicSettingsSection(props: Props) {
  const { leagueSlug, leagueName, maxTeams, autoReactivate } = props;
  const effectiveMaxTeams = maxTeams ?? 6;
  const [state, formAction] = useFormState(updateBasicSettingsFormAction, null as { error?: string } | null);

  return (
    <section aria-labelledby="basic-settings-heading" style={{ marginBottom: 32 }}>
      <h2 id="basic-settings-heading" style={{ fontSize: "1.25rem", marginBottom: 12 }}>
        Basic Settings
      </h2>
      <form action={formAction}>
        <input type="hidden" name="league_slug" value={leagueSlug} />
        <div style={{ marginBottom: 20 }}>
          <label htmlFor="league_name" style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
            League Name
          </label>
          <input
            id="league_name"
            name="league_name"
            type="text"
            required
            defaultValue={leagueName}
            maxLength={120}
            className="app-input"
            style={{ width: "100%", maxWidth: 320 }}
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label htmlFor="max_teams" style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
            Number of Teams
          </label>
          <select
            id="max_teams"
            name="max_teams"
            className="app-input"
            defaultValue={String(effectiveMaxTeams)}
            style={{ minWidth: 80 }}
          >
            {TEAM_COUNTS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 24 }}>
          <label htmlFor="auto_reactivate" style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
            Auto-reactivate
          </label>
          <select
            id="auto_reactivate"
            name="auto_reactivate"
            className="app-input"
            defaultValue={autoReactivate ? "yes" : "no"}
            style={{ minWidth: 100 }}
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
          <p style={{ color: "var(--color-text-muted)", fontSize: 14, marginTop: 6 }}>
            When enabled, the league can renew automatically for a new season.
          </p>
        </div>
        {state?.error && <p style={{ color: "var(--color-red)", marginBottom: 12 }}>{state.error}</p>}
        <button type="submit" className="app-btn-primary">Save Basic Settings</button>
      </form>
    </section>
  );
}
