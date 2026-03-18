"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelTradeAction } from "./actions";

export function CancelTradeButton({
  leagueSlug,
  proposalId,
}: {
  leagueSlug: string;
  proposalId: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const onCancel = () => {
    if (!confirm("Cancel this trade offer?")) return;
    startTransition(async () => {
      const result = await cancelTradeAction(leagueSlug, proposalId);
      if (result.error) alert(result.error);
      else router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={onCancel}
      disabled={pending}
      style={{
        padding: "4px 10px",
        fontSize: 13,
        background: "#fff",
        color: "#b91c1c",
        border: "1px solid #b91c1c",
        borderRadius: 6,
        cursor: pending ? "not-allowed" : "pointer",
      }}
    >
      Cancel
    </button>
  );
}

