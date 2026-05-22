"use client";

import { useEffect, useActionState } from "react";
import { useRouter } from "next/navigation";
import { updateBasicSettingsFormAction } from "../actions";

type Props = {
  leagueSlug: string;
  leagueName: string;
  maxTeams: number | null | undefined;
  autoReactivate: boolean | null | undefined;
  visibilityType?: string | null | undefined;
  isPublicSalaryCap?: boolean;
  teamCountOptions: number[];
};

export function BasicSettingsSection(props: Props) {
  const { leagueSlug, leagueName, maxTeams, autoReactivate, visibilityType, isPublicSalaryCap = false, teamCountOptions } = props;
  const effectiveMaxTeams = maxTeams ?? 6;
  const isPublicLeague = String(visibilityType ?? "").toLowerCase() === "public";
  const router = useRouter();
  const [state, formAction] = useActionState(updateBasicSettingsFormAction, null as { error?: string } | null);

  // After a successful save, refresh so the page gets updated league data and the key/props update
  useEffect(() => {
    if (state != null && !state.error) {
      router.refresh();
    }
  }, [state, router]);

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
          {isPublicLeague ? (
            <>
              <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
                {isPublicSalaryCap
                  ? "Public salary cap leagues have no team maximum — anyone can join until the season starts."
                  : "Public leagues always use 6 team spots."}
              </p>
              {!isPublicSalaryCap ? (
                <input type="hidden" id="max_teams" name="max_teams" value="6" />
              ) : null}
            </>
          ) : (
            <select
              id="max_teams"
              name="max_teams"
              className="app-input"
              defaultValue={String(effectiveMaxTeams)}
              style={{ minWidth: 80 }}
            >
              {teamCountOptions.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          )}
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
