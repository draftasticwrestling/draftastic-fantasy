"use client";

import { useFormState } from "react-dom";
import { updateLeagueTypeFormAction } from "../actions";

const LEAGUE_TYPES: Array<{
  value: string;
  label: string;
  description: string;
  disabled?: boolean;
}> = [
  {
    value: "season_overall",
    label: "Total Season Points",
    description:
      "Earn as many points as possible over the entire season to win the championship.",
  },
  {
    value: "head_to_head",
    label: "Head to Head Points",
    description:
      "Face-off with one opponent each week, trying to score more total points.",
  },
  {
    value: "combo",
    label: "Combo (H2H + Overall)",
    description:
      "Earn extra season points for winning your weekly matchup, but the final winner is determined by your roster's cumulative overall points.",
    disabled: true,
  },
  {
    value: "legacy",
    label: "Legacy",
    description:
      "Draft your wrestlers and sign them to long-term contracts. For die-hard fans who want to play the long game.",
    disabled: true,
  },
];

type Props = {
  leagueSlug: string;
  leagueType: string | null | undefined;
};

export function LeagueTypeSection({ leagueSlug, leagueType }: Props) {
  const effectiveType = leagueType ?? "head_to_head";

  const [state, formAction] = useFormState(updateLeagueTypeFormAction, null as { error?: string } | null);

  return (
    <section aria-labelledby="league-type-heading" style={{ marginBottom: 32 }}>
      <h2 id="league-type-heading" style={{ fontSize: "1.25rem", marginBottom: 12 }}>
        League Type
      </h2>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 20, maxWidth: 560 }}>
        Choose how your league competes. Changing league type may affect roster size and scoring.
      </p>

      <form action={formAction}>
        <input type="hidden" name="league_slug" value={leagueSlug} />

        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {LEAGUE_TYPES.map((opt) => (
            <li key={opt.value} style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  cursor: opt.disabled ? "not-allowed" : "pointer",
                  opacity: opt.disabled ? 0.7 : 1,
                }}
              >
                <input
                  type="radio"
                  name="league_type"
                  value={opt.value}
                  defaultChecked={effectiveType === opt.value}
                  disabled={opt.disabled}
                  style={{ marginTop: 4, flexShrink: 0 }}
                />
                <span>
                  <span style={{ fontWeight: 600 }}>{opt.label}</span>
                  {opt.disabled && (
                    <span style={{ marginLeft: 8, fontSize: 12, color: "var(--color-text-muted)" }}>
                      (Coming soon)
                    </span>
                  )}
                  {" — "}
                  <span style={{ color: "var(--color-text-muted)" }}>{opt.description}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>

        {state?.error && (
          <p style={{ color: "var(--color-red)", marginTop: 12, marginBottom: 12 }}>{state.error}</p>
        )}
        <button type="submit" className="app-btn-primary" style={{ marginTop: 16 }}>
          Save League Type
        </button>
      </form>
    </section>
  );
}
