"use client";

import { useState, useTransition } from "react";
import { proposeTradeAction } from "./actions";

type Wrestler = { id: string; name: string | null };

export function ProposeTradeForm({
  leagueSlug,
  myRosterWrestlers,
  otherMembers,
  otherRosters,
  wrestlerNames,
}: {
  leagueSlug: string;
  myRosterWrestlers: Wrestler[];
  otherMembers: { id: string; name: string }[];
  otherRosters: Record<string, string[]>;
  wrestlerNames: Record<string, string>;
}) {
  const [toUserId, setToUserId] = useState("");
  const [giveIds, setGiveIds] = useState<string[]>([]);
  const [receiveIds, setReceiveIds] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const otherRoster = toUserId ? otherRosters[toUserId] ?? [] : [];
  const toggleGive = (id: string) => {
    setGiveIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const toggleReceive = (id: string) => {
    setReceiveIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!toUserId || (giveIds.length === 0 && receiveIds.length === 0)) {
      setMessage({ type: "err", text: "Select an owner and add at least one wrestler to give or receive." });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await proposeTradeAction(leagueSlug, toUserId, giveIds, receiveIds);
      if (result.error) setMessage({ type: "err", text: result.error });
      else {
        setMessage({ type: "ok", text: "Trade proposed. They can accept or reject." });
        setGiveIds([]);
        setReceiveIds([]);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <label htmlFor="trade-to" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
          Trade with
        </label>
        <select
          id="trade-to"
          value={toUserId}
          onChange={(e) => setToUserId(e.target.value)}
          style={{ padding: "8px 12px", minWidth: 180 }}
        >
          <option value="">Select owner…</option>
          {otherMembers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
      {toUserId && (
        <>
          <div>
            <span style={{ fontSize: 12, fontWeight: 600 }}>You give</span>
            <ul style={{ listStyle: "none", padding: 0, margin: "4px 0 0", display: "flex", flexWrap: "wrap", gap: 8 }}>
              {myRosterWrestlers.map((w) => (
                <li key={w.id}>
                  <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                    <input type="checkbox" checked={giveIds.includes(w.id)} onChange={() => toggleGive(w.id)} />
                    {w.name ?? w.id}
                  </label>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <span style={{ fontSize: 12, fontWeight: 600 }}>You receive</span>
            <ul style={{ listStyle: "none", padding: 0, margin: "4px 0 0", display: "flex", flexWrap: "wrap", gap: 8 }}>
              {otherRoster.map((wid) => (
                <li key={wid}>
                  <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                    <input type="checkbox" checked={receiveIds.includes(wid)} onChange={() => toggleReceive(wid)} />
                    {wrestlerNames[wid] ?? wid}
                  </label>
                </li>
              ))}
            </ul>
            {otherRoster.length === 0 && <p style={{ margin: "4px 0 0", fontSize: 14, color: "#666" }}>Their roster is empty.</p>}
          </div>
        </>
      )}
      <button
        type="submit"
        disabled={pending || !toUserId}
        style={{
          padding: "8px 16px",
          background: "#333",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 14,
          alignSelf: "flex-start",
          cursor: pending ? "not-allowed" : "pointer",
        }}
      >
        {pending ? "Submitting…" : "Propose trade"}
      </button>
      {message && (
        <p style={{ margin: 0, fontSize: 14, color: message.type === "err" ? "#b91c1c" : "#166534" }}>
          {message.text}
        </p>
      )}
    </form>
  );
}
