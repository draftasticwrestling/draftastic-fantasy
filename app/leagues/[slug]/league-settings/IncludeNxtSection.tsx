"use client";

import { useActionState } from "react";
import { updateIncludeNxtFormAction } from "../actions";

type Props = {
  leagueSlug: string;
  includeNxt: boolean;
};

/** Site-admin-only: toggle NXT in draft / free-agent pool for Head-to-Head leagues. */
export function IncludeNxtSection({ leagueSlug, includeNxt }: Props) {
  const [state, formAction] = useActionState(updateIncludeNxtFormAction, null as { error?: string } | null);

  return (
    <section aria-labelledby="include-nxt-heading" style={{ marginBottom: 32 }}>
      <h2 id="include-nxt-heading" style={{ fontSize: "1.25rem", marginBottom: 12 }}>
        Include NXT (site admin)
      </h2>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 16, maxWidth: 560 }}>
        When enabled, NXT roster talent and NXT weekly events count for this Head-to-Head league. Standard leagues use
        Raw and SmackDown only.
      </p>
      <form action={formAction}>
        <input type="hidden" name="league_slug" value={leagueSlug} />
        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
          <input type="checkbox" name="include_nxt" value="1" defaultChecked={includeNxt} style={{ marginTop: 4 }} />
          <span>
            <strong>Include NXT</strong> in draft pool, free agents, and scoring
          </span>
        </label>
        {state?.error && (
          <p style={{ color: "var(--color-red)", marginTop: 12, marginBottom: 0 }}>{state.error}</p>
        )}
        <button type="submit" className="app-btn-primary" style={{ marginTop: 16 }}>
          Save Include NXT
        </button>
      </form>
    </section>
  );
}
