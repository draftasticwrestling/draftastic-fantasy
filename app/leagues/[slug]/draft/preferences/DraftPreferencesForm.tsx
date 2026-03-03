"use client";

import { useState } from "react";
import { saveDraftPreferencesAction } from "../actions";

const FOCUS_OPTIONS = [
  { value: "all", label: "All-time points" },
  { value: "2026", label: "2026 points" },
  { value: "2025", label: "2025 points" },
];

const POINT_STRATEGY_OPTIONS = [
  { value: "total", label: "Total Points" },
  { value: "rs", label: "R/S points" },
  { value: "ple", label: "PLE Points" },
  { value: "belt", label: "Belt Points" },
];

const WRESTLER_STRATEGY_OPTIONS = [
  { value: "best_available", label: "Best available" },
  { value: "balanced_gender", label: "Balanced male/female" },
  { value: "balanced_brands", label: "Balanced Raw/SmackDown" },
  { value: "high_males", label: "High ranking males" },
  { value: "high_females", label: "High ranking females" },
];

type Props = {
  leagueSlug: string;
  initialFocus: string;
  initialPointStrategy: string;
  initialWrestlerStrategy: string;
  disabled?: boolean;
};

export function DraftPreferencesForm({
  leagueSlug,
  initialFocus,
  initialPointStrategy,
  initialWrestlerStrategy,
  disabled = false,
}: Props) {
  const [focus, setFocus] = useState(initialFocus);
  const [pointStrategy, setPointStrategy] = useState(initialPointStrategy);
  const [wrestlerStrategy, setWrestlerStrategy] = useState(initialWrestlerStrategy);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    const result = await saveDraftPreferencesAction(leagueSlug, {
      focus,
      pointStrategy,
      wrestlerStrategy,
    });
    setSaving(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    setMessage({ type: "success", text: "Preferences saved." });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <section>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 8, color: "var(--color-text)" }}>
          Choose a focus
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {FOCUS_OPTIONS.map((opt) => (
            <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: disabled ? "default" : "pointer" }}>
              <input
                type="radio"
                name="focus"
                checked={focus === opt.value}
                onChange={() => setFocus(opt.value)}
                disabled={disabled}
                style={{ width: 18, height: 18 }}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 8, color: "var(--color-text)" }}>
          Choose a point strategy
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {POINT_STRATEGY_OPTIONS.map((opt) => (
            <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: disabled ? "default" : "pointer" }}>
              <input
                type="radio"
                name="pointStrategy"
                checked={pointStrategy === opt.value}
                onChange={() => setPointStrategy(opt.value)}
                disabled={disabled}
                style={{ width: 18, height: 18 }}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 4, color: "var(--color-text)" }}>
          Choose a wrestler strategy
        </h2>
        <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 8 }}>
          Best available: top by points. Balanced male/female: balance roster by gender. Balanced Raw/SmackDown: by brand. High ranking males/females: rank by total points × 1.2, draft best.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {WRESTLER_STRATEGY_OPTIONS.map((opt) => (
            <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: disabled ? "default" : "pointer" }}>
              <input
                type="radio"
                name="wrestlerStrategy"
                checked={wrestlerStrategy === opt.value}
                onChange={() => setWrestlerStrategy(opt.value)}
                disabled={disabled}
                style={{ width: 18, height: 18 }}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </section>

      {message && (
        <p style={{ color: message.type === "error" ? "var(--color-error, #c00)" : "var(--color-success, #0d7d0d)", fontSize: 14 }}>
          {message.text}
        </p>
      )}

      {!disabled && (
        <button
          type="submit"
          disabled={saving}
          style={{
            padding: "12px 24px",
            background: "var(--color-blue, #1a73e8)",
            color: "#fff",
            border: "none",
            borderRadius: "var(--radius)",
            fontSize: 16,
            fontWeight: 600,
            cursor: saving ? "default" : "pointer",
            alignSelf: "flex-start",
          }}
        >
          {saving ? "Saving…" : "Save preferences"}
        </button>
      )}
    </form>
  );
}
