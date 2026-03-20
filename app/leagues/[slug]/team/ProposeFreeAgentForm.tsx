"use client";

import { useState, useTransition } from "react";
import { addFreeAgentAction } from "./actions";

type Wrestler = { id: string; name: string | null };

export function ProposeFreeAgentForm({
  leagueSlug,
  freeAgents,
  myRosterWrestlers,
  rosterSize,
  initialWrestlerId,
  tradeLockedWrestlerIds = [],
}: {
  leagueSlug: string;
  freeAgents: Wrestler[];
  myRosterWrestlers: Wrestler[];
  rosterSize: number;
  pendingFaIds: string[];
  /** Pre-select this wrestler (e.g. from League Leaders / Free Agents "Add" link). */
  initialWrestlerId?: string | null;
  tradeLockedWrestlerIds?: string[];
}) {
  const [wrestlerId, setWrestlerId] = useState(initialWrestlerId ?? "");
  const [dropWrestlerId, setDropWrestlerId] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const tradeLocked = new Set(tradeLockedWrestlerIds.map((id) => String(id).trim()).filter(Boolean));
  const needDrop = rosterSize > 0 && myRosterWrestlers.length >= rosterSize;
  const dropSelectionLocked = !!(dropWrestlerId.trim() && tradeLocked.has(dropWrestlerId.trim()));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wrestlerId.trim()) return;
    if (needDrop && !dropWrestlerId.trim()) {
      setMessage({ type: "err", text: "Roster is full. Select a wrestler to drop." });
      return;
    }
    if (needDrop && dropWrestlerId.trim() && tradeLocked.has(dropWrestlerId.trim())) {
      setMessage({
        type: "err",
        text: "That wrestler is tied to a pending trade. Pick someone else to drop or finish/cancel the trade first.",
      });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await addFreeAgentAction(
        leagueSlug,
        wrestlerId.trim(),
        dropWrestlerId.trim() || null
      );
      if (result.error) setMessage({ type: "err", text: result.error });
      else {
        setMessage({ type: "ok", text: "Free agent added." });
        setWrestlerId("");
        setDropWrestlerId("");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label htmlFor="fa-wrestler" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
          Free agent to sign
        </label>
        <select
          id="fa-wrestler"
          value={wrestlerId}
          onChange={(e) => setWrestlerId(e.target.value)}
          style={{ padding: "8px 12px", minWidth: 200 }}
        >
          <option value="">Select…</option>
          {freeAgents.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name ?? w.id}
            </option>
          ))}
        </select>
      </div>
      {needDrop && (
        <div>
          <label htmlFor="fa-drop" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
            Drop wrestler to make room (required)
          </label>
          <select
            id="fa-drop"
            value={dropWrestlerId}
            onChange={(e) => setDropWrestlerId(e.target.value)}
            style={{ padding: "8px 12px", minWidth: 200 }}
          >
            <option value="">Select wrestler to drop…</option>
            {myRosterWrestlers.map((w) => (
              <option key={w.id} value={w.id} disabled={tradeLocked.has(w.id)}>
                {tradeLocked.has(w.id) ? `${w.name ?? w.id} (pending trade)` : (w.name ?? w.id)}
              </option>
            ))}
          </select>
        </div>
      )}
      <button
        type="submit"
        disabled={
          pending ||
          !wrestlerId.trim() ||
          (needDrop && !dropWrestlerId.trim()) ||
          dropSelectionLocked
        }
        style={{
          padding: "8px 16px",
          background: "#1a73e8",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 14,
          alignSelf: "flex-start",
          cursor: pending ? "not-allowed" : "pointer",
        }}
      >
        {pending ? "Adding…" : "Add free agent"}
      </button>
      {message && (
        <p style={{ margin: 0, fontSize: 14, color: message.type === "err" ? "#b91c1c" : "#166534" }}>
          {message.text}
        </p>
      )}
    </form>
  );
}
