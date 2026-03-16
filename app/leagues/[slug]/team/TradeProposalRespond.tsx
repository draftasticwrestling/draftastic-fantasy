"use client";

import { useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { respondToTradeAction } from "./actions";

export function TradeProposalRespond({
  leagueSlug,
  proposalId,
  proposalFromUserId,
}: {
  leagueSlug: string;
  proposalId: string;
  /** Used for Counter: propose a trade back to this user. */
  proposalFromUserId: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();

  const respond = (accept: boolean) => {
    startTransition(async () => {
      const result = await respondToTradeAction(leagueSlug, proposalId, accept);
      if (result.error) alert(result.error);
      else if (!accept) router.refresh();
    });
  };

  const handleCounter = () => {
    startTransition(async () => {
      const result = await respondToTradeAction(leagueSlug, proposalId, false);
      if (result.error) alert(result.error);
      else {
        const params = new URLSearchParams({ proposeTradeTo: proposalFromUserId });
        router.push(`${pathname}?${params.toString()}#propose-trade`);
      }
    });
  };

  return (
    <span style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
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
        Decline
      </button>
      <button
        type="button"
        onClick={handleCounter}
        disabled={pending}
        style={{ padding: "4px 12px", fontSize: 13, background: "#fff", color: "#1a73e8", border: "1px solid #1a73e8", borderRadius: 6, cursor: pending ? "not-allowed" : "pointer" }}
      >
        Counter
      </button>
    </span>
  );
}
