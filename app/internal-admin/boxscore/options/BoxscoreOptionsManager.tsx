"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { BoxscoreUiOptionCategory } from "@/lib/boxscoreAdmin/boxscoreUiOptionsCore";
import {
  addBoxscoreUiOptionAction,
  deleteBoxscoreUiOptionAction,
  type BoxscoreOptionActionState,
} from "./actions";

const CATEGORY_LABELS: Record<BoxscoreUiOptionCategory, string> = {
  event_type: "Event type",
  stipulation: "Stipulation",
  special_winner: "Special match winner",
};

type Row = { id: string; label: string; sort_order: number; category: BoxscoreUiOptionCategory };

function AddForm({ category }: { category: BoxscoreUiOptionCategory }) {
  const [state, formAction] = useActionState(addBoxscoreUiOptionAction, null);
  return (
    <form action={formAction} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end", marginBottom: 12 }}>
      <input type="hidden" name="category" value={category} />
      <label style={{ flex: "1 1 200px", minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--color-text-muted)" }}>
          Add option
        </span>
        <input
          name="label"
          type="text"
          required
          maxLength={256}
          placeholder="e.g. Clash in Italy"
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-border)",
            background: "var(--color-bg-surface)",
            color: "var(--color-text)",
            fontSize: 14,
          }}
        />
      </label>
      <button
        type="submit"
        style={{
          padding: "8px 14px",
          fontWeight: 600,
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--color-border)",
          background: "var(--color-blue)",
          color: "#fff",
          cursor: "pointer",
          fontSize: 14,
        }}
      >
        Add
      </button>
      {state?.error ? (
        <span style={{ width: "100%", fontSize: 13, color: "var(--color-red)" }} role="alert">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

function DeleteButton({ id }: { id: string }) {
  const [state, formAction] = useActionState(deleteBoxscoreUiOptionAction, null);
  return (
    <form action={formAction} style={{ display: "inline" }}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        style={{
          padding: "4px 10px",
          fontSize: 13,
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--color-border)",
          background: "transparent",
          color: "var(--color-red)",
          cursor: "pointer",
        }}
      >
        Remove
      </button>
      {state?.error ? (
        <span style={{ display: "block", fontSize: 12, color: "var(--color-red)", marginTop: 4 }}>{state.error}</span>
      ) : null}
    </form>
  );
}

export function BoxscoreOptionsManager({ rows }: { rows: Row[] }) {
  const grouped: Record<BoxscoreUiOptionCategory, Row[]> = {
    event_type: [],
    stipulation: [],
    special_winner: [],
  };
  for (const r of rows) {
    if (grouped[r.category]) grouped[r.category].push(r);
  }
  for (const cat of Object.keys(grouped) as BoxscoreUiOptionCategory[]) {
    grouped[cat].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {(Object.keys(CATEGORY_LABELS) as BoxscoreUiOptionCategory[]).map((cat) => (
        <section key={cat}>
          <h2 style={{ fontSize: 17, marginBottom: 8 }}>{CATEGORY_LABELS[cat]}</h2>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 10, maxWidth: 640 }}>
            {cat === "event_type" &&
              "Shown in Event type on add/edit event. Built-in and custom labels are merged and sorted A–Z."}
            {cat === "stipulation" &&
              "Merged with built-in stipulations in MatchEdit (A–Z; None first, Custom/Other last)."}
            {cat === "special_winner" &&
              "Used for event-level special winner and per-match Special Match Winner (A–Z; None first)."}
          </p>
          <AddForm category={cat} />
          {grouped[cat].length === 0 ? (
            <p style={{ fontSize: 14, color: "var(--color-text-muted)", margin: 0 }}>No custom rows yet — defaults from code still apply.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {grouped[cat].map((r) => (
                <li
                  key={r.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--color-border)",
                    background: "var(--color-bg-surface)",
                    fontSize: 14,
                  }}
                >
                  <span>{r.label}</span>
                  <DeleteButton id={r.id} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: 0 }}>
        Built-in lists live in{" "}
        <code style={{ fontSize: 12 }}>lib/boxscoreAdmin/boxscoreMatchOptions.ts</code> and{" "}
        <code style={{ fontSize: 12 }}>lib/boxscoreAdmin/boxscoreUiOptions.ts</code> (event types). To remove a built-in option,
        edit the code; this page only manages <strong>additional</strong> labels.
      </p>
      <p style={{ fontSize: 13, margin: 0 }}>
        <Link href="/internal-admin/boxscore" className="app-link">
          ← Boxscore admin
        </Link>
      </p>
    </div>
  );
}
