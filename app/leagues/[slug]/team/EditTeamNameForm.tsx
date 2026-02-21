"use client";

import { useState, useTransition } from "react";
import { updateTeamNameAction } from "./actions";

export function EditTeamNameForm(props: {
  leagueSlug: string;
  initialTeamName: string;
}) {
  const { leagueSlug, initialTeamName } = props;
  const [value, setValue] = useState(initialTeamName);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await updateTeamNameAction(leagueSlug, value.trim() || null);
      if (result.error) setMessage({ type: "err", text: result.error });
      else setMessage({ type: "ok", text: "Team name saved." });
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        marginBottom: 24,
        padding: 16,
        background: "#f8f9fa",
        borderRadius: 8,
        border: "1px solid #eee",
      }}
    >
      <label htmlFor="team-name" style={{ display: "block", fontSize: 14, marginBottom: 8 }}>
        Team name
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <input
          id="team-name"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Your team name"
          style={{
            padding: "8px 12px",
            fontSize: 14,
            border: "1px solid #ccc",
            borderRadius: 6,
            minWidth: 200,
          }}
        />
        <button
          type="submit"
          disabled={pending}
          style={{
            padding: "8px 16px",
            background: "#333",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 14,
            cursor: pending ? "wait" : "pointer",
          }}
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      {message && (
        <p
          style={{
            marginTop: 8,
            marginBottom: 0,
            fontSize: 14,
            color: message.type === "err" ? "#c00" : "#166534",
          }}
        >
          {message.text}
        </p>
      )}
    </form>
  );
}
