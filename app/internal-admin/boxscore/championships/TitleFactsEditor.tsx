"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { updateChampionshipTitleFactsAction, type ChampionshipActionState } from "./actions";

function parseTitleFacts(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.map((x) => String(x ?? "").trim()).filter(Boolean);
  } catch {
    return [raw.trim()];
  }
  return [];
}

export function TitleFactsEditor({ championshipId, titleFacts }: { championshipId: string; titleFacts: string | null }) {
  const initial = useMemo(() => parseTitleFacts(titleFacts), [titleFacts]);
  const [facts, setFacts] = useState(initial);
  const [newFact, setNewFact] = useState("");
  const [state, action, pending] = useActionState(updateChampionshipTitleFactsAction, null as ChampionshipActionState);

  function move(index: number, direction: "up" | "down") {
    const next = [...facts];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setFacts(next);
  }

  return (
    <form action={action} style={{ display: "grid", gap: 10 }}>
      <input type="hidden" name="id" value={championshipId} />
      <input type="hidden" name="title_facts_json" value={JSON.stringify(facts)} readOnly />
      <h3 style={{ margin: 0, fontSize: 16 }}>Title facts &amp; trivia</h3>
      <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)" }}>
        Same workflow as PWBS: add facts one at a time, reorder, then save.
      </p>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
        {facts.map((fact, i) => (
          <li
            key={`${i}-${fact.slice(0, 24)}`}
            style={{
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
              padding: 8,
              border: "1px solid var(--color-border)",
              borderRadius: 6,
              background: "var(--color-bg-elevated)",
            }}
          >
            <span style={{ flex: 1, fontSize: 14 }}>{fact}</span>
            <button type="button" className="btn-secondary" disabled={i === 0} onClick={() => move(i, "up")}>
              ↑
            </button>
            <button type="button" className="btn-secondary" disabled={i === facts.length - 1} onClick={() => move(i, "down")}>
              ↓
            </button>
            <button type="button" className="btn-secondary" onClick={() => setFacts(facts.filter((_, j) => j !== i))}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          value={newFact}
          onChange={(e) => setNewFact(e.target.value)}
          placeholder="Add a fact…"
          style={{ flex: 1, minWidth: 200, padding: "8px 10px", borderRadius: 6, border: "1px solid var(--color-border)" }}
        />
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            const t = newFact.trim();
            if (!t) return;
            setFacts([...facts, t]);
            setNewFact("");
          }}
        >
          Add fact
        </button>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save facts"}
        </button>
      </div>
      {state?.error ? <span style={{ color: "var(--color-red)" }}>{state.error}</span> : null}
      {state?.success ? <span style={{ color: "var(--color-green)" }}>{state.success}</span> : null}
    </form>
  );
}
