"use client";

import { useState, useTransition } from "react";
import { setLineupAction } from "./actions";

type Wrestler = { id: string; name: string | null };

export function LineupForm({
  leagueSlug,
  eventId,
  eventName,
  roster,
  initialActiveIds,
  maxActive,
}: {
  leagueSlug: string;
  eventId: string;
  eventName: string;
  roster: Wrestler[];
  initialActiveIds: string[];
  maxActive: number;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialActiveIds));
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < maxActive) next.add(id);
      return next;
    });
  };

  const handleSubmit = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await setLineupAction(leagueSlug, eventId, [...selected]);
      if (result.error) setMessage({ type: "err", text: result.error });
      else setMessage({ type: "ok", text: "Lineup saved." });
    });
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: "1rem", marginBottom: 8 }}>Lineup for {eventName}</h3>
      <p style={{ fontSize: 14, color: "#666", marginBottom: 12 }}>
        Choose up to {maxActive} wrestlers to count for this event. The rest are benched.
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px 0" }}>
        {roster.map((w) => (
          <li key={w.id} style={{ padding: "6px 0", display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              id={`lineup-${w.id}`}
              checked={selected.has(w.id)}
              onChange={() => toggle(w.id)}
              disabled={!selected.has(w.id) && selected.size >= maxActive}
            />
            <label htmlFor={`lineup-${w.id}`} style={{ cursor: "pointer" }}>
              {w.name ?? w.id}
            </label>
          </li>
        ))}
      </ul>
      {message && (
        <p style={{ fontSize: 14, marginBottom: 8, color: message.type === "err" ? "#b91c1c" : "#166534" }}>
          {message.text}
        </p>
      )}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={pending || roster.length === 0}
        style={{
          padding: "8px 16px",
          background: "#1a73e8",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: pending ? "not-allowed" : "pointer",
        }}
      >
        {pending ? "Saving…" : "Save lineup"}
      </button>
    </div>
  );
}
