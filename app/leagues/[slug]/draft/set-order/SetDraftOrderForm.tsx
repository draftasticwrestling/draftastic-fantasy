"use client";

import { useState, useTransition } from "react";
import { setDraftOrderAction } from "../actions";

type Member = { user_id: string; display_name: string | null; team_name?: string | null };

export function SetDraftOrderForm({
  leagueSlug,
  members,
  initialRound1UserIds,
}: {
  leagueSlug: string;
  members: Member[];
  initialRound1UserIds: string[];
}) {
  const [order, setOrder] = useState<string[]>(() => {
    if (initialRound1UserIds.length === members.length) return initialRound1UserIds;
    return members.map((m) => m.user_id);
  });
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const moveUp = (index: number) => {
    if (index <= 0) return;
    setOrder((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
    setMessage(null);
  };

  const moveDown = (index: number) => {
    if (index >= order.length - 1) return;
    setOrder((prev) => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
    setMessage(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await setDraftOrderAction(leagueSlug, order);
      if (result.error) setMessage({ type: "err", text: result.error });
      else setMessage({ type: "ok", text: "Draft order saved. It will appear on the Draft page for everyone." });
    });
  };

  const byUserId = Object.fromEntries(members.map((m) => [m.user_id, m]));

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 480 }}>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 16, fontSize: 14 }}>
        Set the pick order for round 1. Later rounds follow your league&apos;s draft style (snake or linear). Drag or use the arrows to reorder.
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", border: "1px solid var(--color-border)", borderRadius: "var(--radius)", overflow: "hidden", background: "var(--color-bg-surface)" }}>
        {order.map((userId, index) => {
          const m = byUserId[userId];
          const label = m?.team_name?.trim() || m?.display_name?.trim() || userId;
          return (
            <li
              key={userId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                borderBottom: index < order.length - 1 ? "1px solid var(--color-border)" : "none",
                background: "var(--color-bg-elevated)",
              }}
            >
              <span style={{ fontWeight: 600, color: "var(--color-text-muted)", minWidth: 28 }}>{index + 1}.</span>
              <span style={{ flex: 1 }}>{label}</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                <button
                  type="button"
                  onClick={() => moveUp(index)}
                  disabled={index === 0}
                  aria-label="Move up"
                  style={{
                    padding: "2px 8px",
                    border: "none",
                    background: "transparent",
                    cursor: index === 0 ? "not-allowed" : "pointer",
                    opacity: index === 0 ? 0.4 : 1,
                    fontSize: 14,
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(index)}
                  disabled={index === order.length - 1}
                  aria-label="Move down"
                  style={{
                    padding: "2px 8px",
                    border: "none",
                    background: "transparent",
                    cursor: index === order.length - 1 ? "not-allowed" : "pointer",
                    opacity: index === order.length - 1 ? 0.4 : 1,
                    fontSize: 14,
                  }}
                >
                  ↓
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {message && (
        <p style={{ marginBottom: 16, fontSize: 14, color: message.type === "err" ? "var(--color-red)" : "var(--color-success)" }}>
          {message.text}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="app-btn-primary"
        style={{ padding: "10px 20px", fontWeight: 600 }}
      >
        {pending ? "Saving…" : "Save draft order"}
      </button>
    </form>
  );
}
