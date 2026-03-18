"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { voteOnTradeAction } from "../team/actions";

export function TradeVoteControls({
  leagueSlug,
  proposalId,
  up,
  down,
  myVote,
  disabled,
  disabledReason,
}: {
  leagueSlug: string;
  proposalId: string;
  up: number;
  down: number;
  myVote: -1 | 0 | 1;
  disabled: boolean;
  disabledReason?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const vote = (v: -1 | 1) => {
    if (disabled) {
      if (disabledReason) alert(disabledReason);
      return;
    }
    startTransition(async () => {
      const result = await voteOnTradeAction(leagueSlug, proposalId, v);
      if (result.error) alert(result.error);
      else router.refresh();
    });
  };

  return (
    <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span style={{ fontSize: 12, color: "#555" }}>
        League vote: <strong>{up}</strong> 👍 / <strong>{down}</strong> 👎
      </span>
      <button
        type="button"
        onClick={() => vote(1)}
        disabled={pending}
        style={{
          padding: "3px 10px",
          fontSize: 12,
          background: myVote === 1 ? "#0d7d0d" : "#fff",
          color: myVote === 1 ? "#fff" : "#0d7d0d",
          border: "1px solid #0d7d0d",
          borderRadius: 999,
          cursor: pending ? "not-allowed" : "pointer",
          opacity: disabled ? 0.55 : 1,
        }}
        title={disabledReason ?? undefined}
      >
        👍 Up-vote
      </button>
      <button
        type="button"
        onClick={() => vote(-1)}
        disabled={pending}
        style={{
          padding: "3px 10px",
          fontSize: 12,
          background: myVote === -1 ? "#b91c1c" : "#fff",
          color: myVote === -1 ? "#fff" : "#b91c1c",
          border: "1px solid #b91c1c",
          borderRadius: 999,
          cursor: pending ? "not-allowed" : "pointer",
          opacity: disabled ? 0.55 : 1,
        }}
        title={disabledReason ?? undefined}
      >
        👎 Down-vote
      </button>
    </span>
  );
}

