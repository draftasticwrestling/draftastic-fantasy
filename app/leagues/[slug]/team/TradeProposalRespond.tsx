"use client";

import { useTransition } from "react";
import { respondToTradeAction } from "./actions";

export function TradeProposalRespond({
  leagueSlug,
  proposalId,
}: {
  leagueSlug: string;
  proposalId: string;
}) {
  const [pending, startTransition] = useTransition();
  const respond = (accept: boolean) => {
    startTransition(async () => {
      const result = await respondToTradeAction(leagueSlug, proposalId, accept);
      if (result.error) alert(result.error);
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
        Accept
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
