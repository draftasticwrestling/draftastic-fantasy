"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { respondToTradeAction } from "./actions";

export function TradeProposalRespond({
  leagueSlug,
  proposalId,
  proposalFromUserId,
  requiredDropCount,
  dropChoices,
}: {
  leagueSlug: string;
  proposalId: string;
  /** Used for Counter: propose a trade back to this user. */
  proposalFromUserId: string;
  requiredDropCount?: number;
  dropChoices?: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const [showDropPrompt, setShowDropPrompt] = useState(false);
  const [selectedDropIds, setSelectedDropIds] = useState<string[]>([]);

  const required = Math.max(0, requiredDropCount ?? 0);
  const choices = dropChoices ?? [];
  const canSubmit = useMemo(() => {
    if (required <= 0) return true;
    return selectedDropIds.length === required;
  }, [required, selectedDropIds.length]);

  const respond = (accept: boolean) => {
    startTransition(async () => {
      const result = await respondToTradeAction(
        leagueSlug,
        proposalId,
        accept,
        accept && required > 0 ? selectedDropIds : undefined
      );
      if (result.error) alert(result.error);
      else if (!accept) router.refresh();
      else router.refresh();
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

  const toggleDrop = (id: string) => {
    setSelectedDropIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <span style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <button
        type="button"
        onClick={() => {
          if (required > 0) setShowDropPrompt(true);
          else respond(true);
        }}
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

      {showDropPrompt && required > 0 && (
        <span
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: 10,
            border: "1px solid #eee",
            borderRadius: 10,
            background: "#fff",
            minWidth: 260,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: "#333" }}>
            Accepting this trade puts you over roster max. Select {required} drop{required === 1 ? "" : "s"}:
          </span>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {choices.map((w) => (
              <li key={w.id}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={selectedDropIds.includes(w.id)}
                    onChange={() => toggleDrop(w.id)}
                    disabled={pending || (!selectedDropIds.includes(w.id) && selectedDropIds.length >= required)}
                  />
                  {w.name}
                </label>
              </li>
            ))}
          </ul>
          <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => respond(true)}
              disabled={pending || !canSubmit}
              style={{
                padding: "4px 12px",
                fontSize: 13,
                background: canSubmit ? "#0d7d0d" : "#9ca3af",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: pending || !canSubmit ? "not-allowed" : "pointer",
              }}
            >
              Confirm accept
            </button>
            <button
              type="button"
              onClick={() => { setShowDropPrompt(false); setSelectedDropIds([]); }}
              disabled={pending}
              style={{
                padding: "4px 12px",
                fontSize: 13,
                background: "#fff",
                color: "#111827",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                cursor: pending ? "not-allowed" : "pointer",
              }}
            >
              Cancel
            </button>
          </span>
        </span>
      )}
    </span>
  );
}
