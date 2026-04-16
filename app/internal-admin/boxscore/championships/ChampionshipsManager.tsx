"use client";

import { useActionState, useMemo, useState, type CSSProperties } from "react";
import {
  createChampionshipHistoryAction,
  deleteChampionshipHistoryAction,
  updateChampionshipAction,
  updateChampionshipHistoryAction,
  type ChampionshipActionState,
} from "./actions";

type ChampionshipRow = {
  id: string;
  title_name?: string | null;
  brand?: string | null;
  type?: string | null;
  current_champion?: string | null;
  current_champion_slug?: string | null;
  previous_champion?: string | null;
  previous_champion_slug?: string | null;
  date_won?: string | null;
  event_name?: string | null;
  title_facts?: string | null;
};

type HistoryRow = {
  id: string;
  championship_id: string;
  champion?: string | null;
  champion_slug?: string | null;
  previous_champion?: string | null;
  previous_champion_slug?: string | null;
  date_won?: string | null;
  date_lost?: string | null;
  event_name?: string | null;
  event_lost?: string | null;
};

const defaultState: ChampionshipActionState = null;

export function ChampionshipsManager({
  championships,
  history,
}: {
  championships: ChampionshipRow[];
  history: HistoryRow[];
}) {
  const [selectedId, setSelectedId] = useState(championships[0]?.id ?? "");
  const selected = championships.find((c) => c.id === selectedId) ?? null;
  const selectedHistory = useMemo(
    () => history.filter((h) => h.championship_id === selectedId).sort((a, b) => String(b.date_won ?? "").localeCompare(String(a.date_won ?? ""))),
    [history, selectedId]
  );

  const [champState, champAction, champPending] = useActionState(updateChampionshipAction, defaultState);
  const [createHistoryState, createHistoryAction, createPending] = useActionState(createChampionshipHistoryAction, defaultState);
  const [updateHistoryState, updateHistoryAction, updatePending] = useActionState(updateChampionshipHistoryAction, defaultState);
  const [editingHistoryId, setEditingHistoryId] = useState<string>("");

  const editingRow = selectedHistory.find((h) => h.id === editingHistoryId) ?? null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 320px) minmax(0, 1fr)", gap: 16 }}>
      <aside style={{ border: "1px solid var(--color-border)", borderRadius: 8, background: "var(--color-bg-card)", overflow: "auto", maxHeight: 760 }}>
        {championships.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setSelectedId(c.id);
              setEditingHistoryId("");
            }}
            style={{
              width: "100%",
              textAlign: "left",
              border: "none",
              borderBottom: "1px solid var(--color-border)",
              padding: "10px 12px",
              background: selectedId === c.id ? "var(--color-bg-elevated)" : "transparent",
              cursor: "pointer",
            }}
          >
            <div style={{ fontWeight: 600 }}>{c.title_name ?? c.id}</div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{c.brand ?? "Unassigned"} · {c.current_champion ?? "VACANT"}</div>
          </button>
        ))}
      </aside>

      <section style={{ display: "grid", gap: 16 }}>
        {selected ? (
          <form action={champAction} style={cardStyle}>
            <h2 style={h2Style}>Current champion</h2>
            <input type="hidden" name="id" value={selected.id} />
            <GridFields
              fields={[
                { label: "Title name", name: "title_name", value: selected.title_name ?? "" },
                { label: "Brand", name: "brand", value: selected.brand ?? "" },
                { label: "Type", name: "type", value: selected.type ?? "" },
                { label: "Current champion", name: "current_champion", value: selected.current_champion ?? "" },
                { label: "Current champion slug", name: "current_champion_slug", value: selected.current_champion_slug ?? "" },
                { label: "Previous champion", name: "previous_champion", value: selected.previous_champion ?? "" },
                { label: "Previous champion slug", name: "previous_champion_slug", value: selected.previous_champion_slug ?? "" },
                { label: "Date won", name: "date_won", value: selected.date_won ?? "", type: "date" },
                { label: "Event won", name: "event_name", value: selected.event_name ?? "" },
                { label: "Title facts (JSON or text)", name: "title_facts", value: selected.title_facts ?? "", full: true },
              ]}
            />
            <div style={footerStyle}>
              <button className="btn-primary" type="submit" disabled={champPending}>
                {champPending ? "Saving..." : "Save championship"}
              </button>
              {champState?.error ? <span style={{ color: "var(--color-red)" }}>{champState.error}</span> : null}
              {champState?.success ? <span style={{ color: "var(--color-green)" }}>{champState.success}</span> : null}
            </div>
          </form>
        ) : null}

        <form action={createHistoryAction} style={cardStyle}>
          <h2 style={h2Style}>Add title history row</h2>
          <input type="hidden" name="championship_id" value={selectedId} />
          <GridFields
            fields={[
              { label: "Champion", name: "champion", value: "" },
              { label: "Champion slug", name: "champion_slug", value: "" },
              { label: "Previous champion", name: "previous_champion", value: "" },
              { label: "Previous champion slug", name: "previous_champion_slug", value: "" },
              { label: "Date won", name: "date_won", value: "", type: "date" },
              { label: "Date lost", name: "date_lost", value: "", type: "date" },
              { label: "Event won", name: "event_name", value: "" },
              { label: "Event lost", name: "event_lost", value: "" },
            ]}
          />
          <div style={footerStyle}>
            <button className="btn-primary" type="submit" disabled={createPending || !selectedId}>
              {createPending ? "Adding..." : "Add history row"}
            </button>
            {createHistoryState?.error ? <span style={{ color: "var(--color-red)" }}>{createHistoryState.error}</span> : null}
            {createHistoryState?.success ? <span style={{ color: "var(--color-green)" }}>{createHistoryState.success}</span> : null}
          </div>
        </form>

        <div style={cardStyle}>
          <h2 style={h2Style}>History rows ({selectedHistory.length})</h2>
          <div style={{ display: "grid", gap: 8 }}>
            {selectedHistory.map((row) => (
              <div key={row.id} style={{ border: "1px solid var(--color-border)", borderRadius: 6, padding: 10, display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{row.champion ?? "Unknown"} {row.date_won ? `· ${row.date_won}` : ""}</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                    Defeated: {row.previous_champion ?? "—"} · Lost: {row.date_lost ?? "—"} · {row.event_name ?? "—"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" className="btn-secondary" onClick={() => setEditingHistoryId(row.id)}>
                    Edit
                  </button>
                  <form action={deleteChampionshipHistoryAction}>
                    <input type="hidden" name="id" value={row.id} />
                    <button
                      className="btn-secondary"
                      type="submit"
                      onClick={(e) => {
                        if (!confirm("Delete this history row?")) e.preventDefault();
                      }}
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>

        {editingRow ? (
          <form action={updateHistoryAction} style={cardStyle}>
            <h2 style={h2Style}>Edit history row</h2>
            <input type="hidden" name="id" value={editingRow.id} />
            <GridFields
              fields={[
                { label: "Champion", name: "champion", value: editingRow.champion ?? "" },
                { label: "Champion slug", name: "champion_slug", value: editingRow.champion_slug ?? "" },
                { label: "Previous champion", name: "previous_champion", value: editingRow.previous_champion ?? "" },
                { label: "Previous champion slug", name: "previous_champion_slug", value: editingRow.previous_champion_slug ?? "" },
                { label: "Date won", name: "date_won", value: editingRow.date_won ?? "", type: "date" },
                { label: "Date lost", name: "date_lost", value: editingRow.date_lost ?? "", type: "date" },
                { label: "Event won", name: "event_name", value: editingRow.event_name ?? "" },
                { label: "Event lost", name: "event_lost", value: editingRow.event_lost ?? "" },
              ]}
            />
            <div style={footerStyle}>
              <button className="btn-primary" type="submit" disabled={updatePending}>
                {updatePending ? "Saving..." : "Save row"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setEditingHistoryId("")}>
                Cancel
              </button>
              {updateHistoryState?.error ? <span style={{ color: "var(--color-red)" }}>{updateHistoryState.error}</span> : null}
              {updateHistoryState?.success ? <span style={{ color: "var(--color-green)" }}>{updateHistoryState.success}</span> : null}
            </div>
          </form>
        ) : null}
      </section>
    </div>
  );
}

type Field = { label: string; name: string; value: string; type?: string; full?: boolean };
function GridFields({ fields }: { fields: Field[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
      {fields.map((f) => (
        <label key={f.name} style={f.full ? { gridColumn: "1 / span 3" } : undefined}>
          {f.label}
          <input name={f.name} defaultValue={f.value} type={f.type ?? "text"} style={inputStyle} />
        </label>
      ))}
    </div>
  );
}

const cardStyle: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  padding: 14,
  background: "var(--color-bg-card)",
};
const h2Style: CSSProperties = { marginTop: 0, fontSize: 18 };
const inputStyle: CSSProperties = { display: "block", width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: 6, border: "1px solid var(--color-border)" };
const footerStyle: CSSProperties = { marginTop: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" };

