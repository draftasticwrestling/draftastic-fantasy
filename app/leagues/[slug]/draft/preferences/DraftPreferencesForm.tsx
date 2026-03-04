"use client";

import { useState, useMemo } from "react";
import { saveDraftPreferencesAction } from "../actions";

const MIN_PRIORITY = 10;
const MAX_PRIORITY = 50;

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

type WrestlerOption = { id: string; name: string | null };

type Props = {
  leagueSlug: string;
  wrestlerOptions: WrestlerOption[];
  initialPriorityList: string[];
  initialFocus: string;
  initialPointStrategy: string;
  initialWrestlerStrategy: string;
  disabled?: boolean;
};

export function DraftPreferencesForm({
  leagueSlug,
  wrestlerOptions,
  initialPriorityList,
  initialFocus,
  initialPointStrategy,
  initialWrestlerStrategy,
  disabled = false,
}: Props) {
  const [priorityList, setPriorityList] = useState<string[]>(initialPriorityList);
  const [addWrestlerId, setAddWrestlerId] = useState("");
  const [focus, setFocus] = useState(initialFocus);
  const [pointStrategy, setPointStrategy] = useState(initialPointStrategy);
  const [wrestlerStrategy, setWrestlerStrategy] = useState(initialWrestlerStrategy);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const optionById = useMemo(() => new Map(wrestlerOptions.map((w) => [w.id, w])), [wrestlerOptions]);
  const availableToAdd = useMemo(
    () => wrestlerOptions.filter((w) => !priorityList.includes(w.id)),
    [wrestlerOptions, priorityList]
  );

  const addWrestler = () => {
    if (!addWrestlerId || priorityList.includes(addWrestlerId) || priorityList.length >= MAX_PRIORITY) return;
    setPriorityList((prev) => [...prev, addWrestlerId]);
    setAddWrestlerId("");
  };

  const removeWrestler = (index: number) => {
    setPriorityList((prev) => prev.filter((_, i) => i !== index));
  };

  const moveUp = (index: number) => {
    if (index <= 0) return;
    setPriorityList((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const moveDown = (index: number) => {
    if (index >= priorityList.length - 1) return;
    setPriorityList((prev) => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (priorityList.length > 0 && (priorityList.length < MIN_PRIORITY || priorityList.length > MAX_PRIORITY)) {
      setMessage({ type: "error", text: `Preferred wrestlers list must have between ${MIN_PRIORITY} and ${MAX_PRIORITY} wrestlers when set.` });
      return;
    }
    setSaving(true);
    const result = await saveDraftPreferencesAction(leagueSlug, {
      priority_list: priorityList,
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
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 4, color: "var(--color-text)" }}>
          Preferred wrestlers (optional)
        </h2>
        <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 12 }}>
          You can list 10–50 wrestlers in ranked order of preference. Auto-pick will choose the highest-ranked available wrestler from this list. Once none from your list are available, your focus and strategies below take over. Leave empty to use only the strategies below.
        </p>
        {!disabled && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <select
              value={addWrestlerId}
              onChange={(e) => setAddWrestlerId(e.target.value)}
              className="app-input"
              style={{ minWidth: 200, maxWidth: 320 }}
              aria-label="Add wrestler to list"
            >
              <option value="">Select a wrestler…</option>
              {availableToAdd.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name || w.id}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addWrestler}
              disabled={!addWrestlerId || priorityList.length >= MAX_PRIORITY}
              className="app-btn-primary"
              style={{ padding: "8px 16px" }}
            >
              Add
            </button>
          </div>
        )}
        {priorityList.length > 0 && (
          <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius)", overflow: "hidden", background: "var(--color-bg-surface)" }}>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: 320, overflowY: "auto" }}>
              {priorityList.map((id, index) => {
                const w = optionById.get(id);
                const name = w?.name || id;
                return (
                  <li
                    key={`${id}-${index}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 12px",
                      borderBottom: index < priorityList.length - 1 ? "1px solid var(--color-border)" : "none",
                      fontSize: 14,
                    }}
                  >
                    <span style={{ color: "var(--color-text-muted)", fontWeight: 600, minWidth: 28 }}>#{index + 1}</span>
                    <span style={{ flex: 1 }}>{name}</span>
                    {!disabled && (
                      <span style={{ display: "flex", gap: 4 }}>
                        <button type="button" onClick={() => moveUp(index)} disabled={index === 0} style={{ padding: "4px 8px", fontSize: 12 }} aria-label="Move up">
                          ↑
                        </button>
                        <button type="button" onClick={() => moveDown(index)} disabled={index === priorityList.length - 1} style={{ padding: "4px 8px", fontSize: 12 }} aria-label="Move down">
                          ↓
                        </button>
                        <button type="button" onClick={() => removeWrestler(index)} style={{ padding: "4px 8px", fontSize: 12, color: "var(--color-red, #c00)" }} aria-label="Remove">
                          Remove
                        </button>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            <p style={{ padding: "8px 12px", fontSize: 12, color: "var(--color-text-muted)", borderTop: "1px solid var(--color-border)", margin: 0 }}>
              {priorityList.length} wrestler{priorityList.length !== 1 ? "s" : ""}. {priorityList.length > 0 && priorityList.length < MIN_PRIORITY && "Add at least " + (MIN_PRIORITY - priorityList.length) + " more to save this list, or remove all."}
              {priorityList.length >= MIN_PRIORITY && priorityList.length <= MAX_PRIORITY && " List is valid."}
              {priorityList.length > MAX_PRIORITY && " Maximum is " + MAX_PRIORITY + "."}
            </p>
          </div>
        )}
      </section>

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
