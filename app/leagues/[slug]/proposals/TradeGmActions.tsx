"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { respondToTradeByGmAction } from "../team/actions";

export function TradeGmActions({
  leagueSlug,
  proposalId,
}: {
  leagueSlug: string;
  proposalId: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const respond = (approve: boolean) => {
    startTransition(async () => {
      const result = await respondToTradeByGmAction(leagueSlug, proposalId, approve);
      if (result.error) alert(result.error);
      else router.refresh();
    });
  };

  return (
    <span style={{ display: "flex", gap: 8 }}>
      <button
        type="button"
        onClick={() => respond(true)}
        disabled={pending}
        style={{ padding: "4px 12px", fontSize: 13, background: "#0d7d0d", color: "#fff", border: "none", borderRadius: 6, cursor: pending ? "not-allowed" : "pointer" }}
      >
        Approve
      </button>
      <button
        type="button"
        onClick={() => respond(false)}
        disabled={pending}
        style={{ padding: "4px 12px", fontSize: 13, background: "#fff", color: "#b91c1c", border: "1px solid #b91c1c", borderRadius: 6, cursor: pending ? "not-allowed" : "pointer" }}
      >
        Reject
      </button>
    </span>
  );
}
