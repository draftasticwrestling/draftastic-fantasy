"use client";

import { useState, useTransition } from "react";
import {
  MANAGER_CATCHPHRASE_MAX_LENGTH,
  validateManagerCatchphraseForSave,
} from "@/lib/managerCatchphrase";
import { updateLeagueCatchphraseAction } from "./actions";

export function EditManagerCatchphraseForm(props: {
  leagueSlug: string;
  initialCatchphrase: string;
}) {
  const { leagueSlug, initialCatchphrase } = props;
  const [value, setValue] = useState(initialCatchphrase);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const checked = validateManagerCatchphraseForSave(value.trim() || null);
    if (!checked.ok) {
      setMessage({ type: "err", text: checked.error });
      return;
    }
    startTransition(async () => {
      const result = await updateLeagueCatchphraseAction(leagueSlug, checked.value);
      if (result.error) setMessage({ type: "err", text: result.error });
      else setMessage({ type: "ok", text: "Catchphrase saved." });
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
      <label htmlFor="manager-catchphrase" style={{ display: "block", fontSize: 14, marginBottom: 8 }}>
        Manager catchphrase{" "}
        <span style={{ color: "#666", fontWeight: 400 }}>(optional, max {MANAGER_CATCHPHRASE_MAX_LENGTH} characters)</span>
      </label>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "#666" }}>
        A short tagline for this league only — like a nickname for your faction. Must be different from every other
        manager&apos;s catchphrase here (not case-sensitive). Leave blank to remove.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <input
          id="manager-catchphrase"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder='e.g. "Rent&apos;s Due!"'
          style={{
            padding: "8px 12px",
            fontSize: 14,
            border: "1px solid #ccc",
            borderRadius: 6,
            minWidth: 220,
            maxWidth: "100%",
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
      {value.trim().length > MANAGER_CATCHPHRASE_MAX_LENGTH && (
        <p style={{ marginTop: 8, marginBottom: 0, fontSize: 13, color: "#b45309" }}>
          {value.trim().length}/{MANAGER_CATCHPHRASE_MAX_LENGTH} — shorten to save.
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
