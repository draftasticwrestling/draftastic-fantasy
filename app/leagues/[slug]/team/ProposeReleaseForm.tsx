"use client";

import { useState, useTransition } from "react";
import { proposeReleaseAction } from "./actions";

type Wrestler = { id: string; name: string | null };

export function ProposeReleaseForm(props: {
  leagueSlug: string;
  rosterWrestlers: Wrestler[];
  pendingReleaseIds: string[];
}) {
  const { leagueSlug, rosterWrestlers, pendingReleaseIds } = props;
  const pendingSet = new Set(pendingReleaseIds);
  const [wrestlerId, setWrestlerId] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wrestlerId.trim()) return;
    setMessage(null);
    startTransition(async () => {
      const result = await proposeReleaseAction(leagueSlug, wrestlerId.trim());
      if (result.error) setMessage({ type: "err", text: result.error });
      else {
        setMessage({ type: "ok", text: "Release requested. Waiting on commissioner approval." });
        setWrestlerId("");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
      <div>
        <label htmlFor="release-wrestler" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
          Wrestler to release
        </label>
        <select
          id="release-wrestler"
          value={wrestlerId}
          onChange={(e) => setWrestlerId(e.target.value)}
          style={{ padding: "8px 12px", minWidth: 180 }}
        >
          <option value="">Select…</option>
          {rosterWrestlers.map((w) => (
            <option key={w.id} value={w.id} disabled={pendingSet.has(w.id)}>
              {w.name ?? w.id} {pendingSet.has(w.id) ? "(request pending)" : ""}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={pending || !wrestlerId.trim()}
        style={{
          padding: "8px 16px",
          background: "#333",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 14,
          cursor: pending ? "not-allowed" : "pointer",
        }}
      >
        {pending ? "Submitting…" : "Request release"}
      </button>
      {message && (
        <p style={{ width: "100%", margin: 0, fontSize: 14, color: message.type === "err" ? "#b91c1c" : "#166534" }}>
          {message.text}
        </p>
      )}
    </form>
  );
}
