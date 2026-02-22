"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { restartDraftAction, clearLastPickAction } from "./actions";

export function CommissionerDraftActions({
  leagueSlug,
  canClearLastPick,
}: {
  leagueSlug: string;
  canClearLastPick: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleRestart() {
    if (!confirm("Restart the draft? This will clear all picks and rosters. You’ll need to generate a new draft order.")) return;
    startTransition(async () => {
      const result = await restartDraftAction(leagueSlug);
      if (result.error) alert(result.error);
      else router.refresh();
    });
  }

  function handleClearLast() {
    if (!confirm("Undo the last pick? That wrestler will be back in the pool and it will be that manager’s turn again.")) return;
    startTransition(async () => {
      const result = await clearLastPickAction(leagueSlug);
      if (result.error) alert(result.error);
      else router.refresh();
    });
  }

  return (
    <section style={{ marginTop: 24, paddingTop: 24, borderTop: "1px solid var(--color-border)" }}>
      <h3 style={{ fontSize: "1rem", marginBottom: 12, color: "var(--color-text-muted)" }}>Commissioner</h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {canClearLastPick && (
          <button
            type="button"
            onClick={handleClearLast}
            disabled={pending}
            style={{
              padding: "8px 16px",
              fontSize: 14,
              background: "var(--color-bg-surface)",
              color: "var(--color-blue)",
              border: "1px solid var(--color-blue)",
              borderRadius: "var(--radius)",
              cursor: pending ? "not-allowed" : "pointer",
            }}
          >
            {pending ? "…" : "Clear last pick"}
          </button>
        )}
        <button
          type="button"
          onClick={handleRestart}
          disabled={pending}
          style={{
            padding: "8px 16px",
            fontSize: 14,
            background: "var(--color-bg-surface)",
            color: "var(--color-red)",
            border: "1px solid var(--color-red)",
            borderRadius: "var(--radius)",
            cursor: pending ? "not-allowed" : "pointer",
          }}
        >
          {pending ? "…" : "Restart draft"}
        </button>
      </div>
    </section>
  );
}
