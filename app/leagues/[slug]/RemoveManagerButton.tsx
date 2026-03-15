"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { removeMemberFromLeagueAction } from "./actions";

type Props = {
  leagueSlug: string;
  userId: string;
  teamLabel: string;
};

export function RemoveManagerButton({ leagueSlug, userId, teamLabel }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleRemove() {
    setError(null);
    const result = await removeMemberFromLeagueAction(leagueSlug, userId);
    if (result.error) {
      setError(result.error);
      return;
    }
    setConfirming(false);
    router.refresh();
  }

  if (confirming) {
    return (
      <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
          Remove {teamLabel}? Slot can be refilled.
        </span>
        <button
          type="button"
          onClick={handleRemove}
          className="lm-btn-remove-confirm"
          style={{
            padding: "4px 10px",
            fontSize: "0.8rem",
            background: "var(--color-red)",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Remove
        </button>
        <button
          type="button"
          onClick={() => { setConfirming(false); setError(null); }}
          style={{
            padding: "4px 10px",
            fontSize: "0.8rem",
            background: "var(--color-border)",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
        {error && <span style={{ fontSize: "0.8rem", color: "var(--color-red)", width: "100%" }}>{error}</span>}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="lm-btn-remove"
      style={{
        padding: "4px 10px",
        fontSize: "0.8rem",
        background: "transparent",
        color: "var(--color-red)",
        border: "1px solid var(--color-red)",
        borderRadius: 4,
        cursor: "pointer",
      }}
    >
      Remove
    </button>
  );
}
