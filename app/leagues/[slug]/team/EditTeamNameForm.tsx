"use client";

import { useState, useTransition } from "react";
import { FACTION_NAME_MAX_LENGTH, validateFactionNameForSave } from "@/lib/factionName";
import {
  DEFAULT_FACTION_EMOJI,
  FACTION_EMOJI_CHOICES,
} from "@/lib/factionEmoji";
import { updateFactionInfoAction } from "./actions";

export function EditTeamNameForm(props: {
  leagueSlug: string;
  initialTeamName: string;
  /** Raw DB value; null/empty → default trophy */
  initialFactionEmoji: string | null;
}) {
  const { leagueSlug, initialTeamName, initialFactionEmoji } = props;
  const [value, setValue] = useState(initialTeamName);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(() =>
    initialFactionEmoji?.trim() ? initialFactionEmoji.trim() : null
  );
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const checked = validateFactionNameForSave(value.trim() || null);
    if (!checked.ok) {
      setMessage({ type: "err", text: checked.error });
      return;
    }
    startTransition(async () => {
      const result = await updateFactionInfoAction(leagueSlug, checked.value, selectedEmoji);
      if (result.error) setMessage({ type: "err", text: result.error });
      else setMessage({ type: "ok", text: "Faction name and logo saved." });
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
      <fieldset style={{ border: "none", margin: 0, padding: 0, marginBottom: 20 }}>
        <legend style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: "#111" }}>
          Faction logo
        </legend>
        <p style={{ fontSize: 13, color: "#666", margin: "0 0 12px" }}>
          Choose an emoji for your faction. It appears on the league page and in standings.
        </p>
        <div
          role="group"
          aria-label="Faction logo choices"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <button
            type="button"
            aria-pressed={selectedEmoji === null}
            onClick={() => setSelectedEmoji(null)}
            disabled={pending}
            style={{
              padding: "8px 12px",
              fontSize: 13,
              borderRadius: 8,
              border: selectedEmoji === null ? "2px solid #1a73e8" : "1px solid #ccc",
              background: selectedEmoji === null ? "rgba(26,115,232,0.08)" : "#fff",
              cursor: pending ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ fontSize: 20 }} aria-hidden>{DEFAULT_FACTION_EMOJI}</span>
            Default
          </button>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))",
            gap: 8,
            maxWidth: 360,
          }}
        >
          {FACTION_EMOJI_CHOICES.map((emoji) => {
            const isSel = selectedEmoji === emoji;
            return (
              <button
                key={emoji}
                type="button"
                aria-label={`Logo ${emoji}`}
                aria-pressed={isSel}
                onClick={() => setSelectedEmoji(emoji)}
                disabled={pending}
                style={{
                  height: 44,
                  fontSize: 24,
                  lineHeight: 1,
                  borderRadius: 10,
                  border: isSel ? "2px solid #1a73e8" : "1px solid #ddd",
                  background: isSel ? "rgba(26,115,232,0.1)" : "#fff",
                  cursor: pending ? "wait" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {emoji}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label htmlFor="team-name" style={{ display: "block", fontSize: 14, marginBottom: 8 }}>
        Faction name <span style={{ color: "#666", fontWeight: 400 }}>(max {FACTION_NAME_MAX_LENGTH} characters)</span>
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <input
          id="team-name"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Your faction name"
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
      {value.trim().length > FACTION_NAME_MAX_LENGTH && (
        <p style={{ marginTop: 8, marginBottom: 0, fontSize: 13, color: "#b45309" }}>
          {value.trim().length}/{FACTION_NAME_MAX_LENGTH} — shorten to save (legacy names over the limit must be edited).
        </p>
      )}
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
