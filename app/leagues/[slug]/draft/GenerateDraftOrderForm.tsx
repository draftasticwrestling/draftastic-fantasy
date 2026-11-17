"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { generateDraftOrderWithStateAction } from "./actions";

export function GenerateDraftOrderForm({
  leagueSlug,
  replaceExisting = false,
}: {
  leagueSlug: string;
  /** Live drafts can replace the order until the GM begins the draft. */
  replaceExisting?: boolean;
}) {
  const [state, formAction] = useActionState(
    generateDraftOrderWithStateAction,
    null as { error?: string; ok?: boolean; at?: number } | null
  );
  const router = useRouter();
  const refreshedAt = useRef<number | null>(null);
  const hasError = Boolean(state?.error);
  const hasSuccess = state != null && !state?.error;
  useEffect(() => {
    if (!state?.ok || state.at == null || refreshedAt.current === state.at) return;
    refreshedAt.current = state.at;
    router.refresh();
  }, [state, router]);

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
        {replaceExisting ? "Replace draft order" : "Set draft order"}
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

