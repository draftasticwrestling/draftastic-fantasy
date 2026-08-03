"use client";

import Link from "next/link";
import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import {
  formatChampionshipAdminDate,
  displayHistoryDaysHeld,
} from "@/lib/championshipAdminDisplay";
import {
  createChampionshipAction,
  createChampionshipHistoryAction,
  deleteChampionshipAction,
  deleteChampionshipHistoryAction,
  syncChampionshipFromHistoryAction,
  updateChampionshipAction,
  updateChampionshipHistoryAction,
  type ChampionshipActionState,
} from "./actions";
import { TitleFactsEditor } from "./TitleFactsEditor";
import { PARTNER_SUBSTITUTION_EVENT_LABEL } from "@/lib/championshipPartnerSubstitution";
import { reignKindLabel, normalizeReignKind } from "@/lib/championshipReignKind";

type ReignMode = "title_change" | "historical" | "partner_substitution" | "interim" | "resolve_interim";

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
  days_held?: number | null;
  reign_kind?: string | null;
};

type ReignForm = {
  champion: string;
  champion_slug: string;
  previous_champion: string;
  previous_champion_slug: string;
  date_won: string;
  date_lost: string;
  event_name: string;
  event_lost: string;
};

const emptyReignForm = (): ReignForm => ({
  champion: "",
  champion_slug: "",
  previous_champion: "",
  previous_champion_slug: "",
  date_won: "",
  date_lost: "",
  event_name: "",
  event_lost: "",
});

const defaultState: ChampionshipActionState = null;

function toDateInputValue(ymd: string | null | undefined): string {
  if (!ymd) return "";
  const m = String(ymd).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

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
    () =>
      history
        .filter((h) => h.championship_id === selectedId)
        .sort((a, b) => String(b.date_won ?? "").localeCompare(String(a.date_won ?? ""))),
    [history, selectedId]
  );

  const [champState, champAction, champPending] = useActionState(updateChampionshipAction, defaultState);
  const [createChampState, createChampAction, createChampPending] = useActionState(createChampionshipAction, defaultState);
  const [deleteChampState, deleteChampAction, deleteChampPending] = useActionState(deleteChampionshipAction, defaultState);
  const [createHistoryState, createHistoryAction, createPending] = useActionState(createChampionshipHistoryAction, defaultState);
  const [updateHistoryState, updateHistoryAction, updatePending] = useActionState(updateChampionshipHistoryAction, defaultState);
  const [syncState, syncAction, syncPending] = useActionState(syncChampionshipFromHistoryAction, defaultState);

  const [showAddReign, setShowAddReign] = useState(false);
  const [addReignType, setAddReignType] = useState<ReignMode | null>(null);
  const [editingHistoryId, setEditingHistoryId] = useState("");
  const [reignForm, setReignForm] = useState<ReignForm>(emptyReignForm);
  const [showCreateChamp, setShowCreateChamp] = useState(false);
  const [idempotencyToken, setIdempotencyToken] = useState("");
  const createSubmitLock = useRef(false);

  const reignPanelOpen = showAddReign || Boolean(editingHistoryId);
  const reignFormReady = Boolean(editingHistoryId) || addReignType != null;

  const newIdempotencyToken = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `reign-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  useEffect(() => {
    if (createHistoryState?.success || updateHistoryState?.success) {
      createSubmitLock.current = false;
      setShowAddReign(false);
      setAddReignType(null);
      setEditingHistoryId("");
      setReignForm(emptyReignForm());
      setIdempotencyToken("");
    }
  }, [createHistoryState?.success, updateHistoryState?.success]);

  useEffect(() => {
    if (createHistoryState?.error) {
      createSubmitLock.current = false;
      setIdempotencyToken(newIdempotencyToken());
    }
  }, [createHistoryState?.error]);

  useEffect(() => {
    if (!createPending) createSubmitLock.current = false;
  }, [createPending]);

  useEffect(() => {
    if (createChampState?.success) setShowCreateChamp(false);
  }, [createChampState?.success]);

  const openAddReign = () => {
    setEditingHistoryId("");
    setAddReignType(null);
    setReignForm(emptyReignForm());
    setIdempotencyToken("");
    createSubmitLock.current = false;
    setShowAddReign(true);
  };

  const startAddReignAs = (type: ReignMode) => {
    setAddReignType(type);
    setIdempotencyToken(newIdempotencyToken());
    createSubmitLock.current = false;
    const prev = selectedHistory[0];
    if (type === "title_change" && prev) {
      setReignForm((f) => ({
        ...f,
        previous_champion: prev.champion ?? "",
        previous_champion_slug: prev.champion_slug ?? "",
        date_won: toDateInputValue(prev.date_lost) || f.date_won,
        event_name: prev.event_lost ?? "",
      }));
    }
    if (type === "partner_substitution") {
      setReignForm((f) => ({
        ...emptyReignForm(),
        date_won: new Date().toISOString().slice(0, 10),
        event_name: PARTNER_SUBSTITUTION_EVENT_LABEL,
      }));
    }
    if (type === "interim") {
      setReignForm((f) => ({
        ...emptyReignForm(),
        date_won: new Date().toISOString().slice(0, 10),
        // Defeated left blank — interim crowns are often multi-way; injured champ was not defeated.
        // Event won is the real show/PLE name (not a mode label).
        event_name: "",
      }));
    }
    if (type === "resolve_interim") {
      const inactive = selectedHistory.find(
        (h) =>
          (!h.date_lost || String(h.date_lost).trim() === "") &&
          normalizeReignKind(h.reign_kind) === "inactive_injured"
      );
      const interim = selectedHistory.find(
        (h) =>
          (!h.date_lost || String(h.date_lost).trim() === "") &&
          normalizeReignKind(h.reign_kind) === "interim"
      );
      setReignForm((f) => ({
        ...emptyReignForm(),
        champion: inactive?.champion ?? interim?.champion ?? "",
        champion_slug: inactive?.champion_slug ?? interim?.champion_slug ?? "",
        date_won: new Date().toISOString().slice(0, 10),
        event_name: "",
      }));
    }
  };

  const openEditReign = (row: HistoryRow) => {
    setShowAddReign(false);
    setAddReignType(null);
    setIdempotencyToken("");
    setEditingHistoryId(row.id);
    setReignForm({
      champion: row.champion ?? "",
      champion_slug: row.champion_slug ?? "",
      previous_champion: row.previous_champion ?? "",
      previous_champion_slug: row.previous_champion_slug ?? "",
      date_won: toDateInputValue(row.date_won),
      date_lost: toDateInputValue(row.date_lost),
      event_name: row.event_name ?? "",
      event_lost: row.event_lost ?? "",
    });
  };

  const cancelReignForm = () => {
    createSubmitLock.current = false;
    setShowAddReign(false);
    setAddReignType(null);
    setEditingHistoryId("");
    setReignForm(emptyReignForm());
    setIdempotencyToken("");
  };

  const onCreateReignSubmit = (e: FormEvent<HTMLFormElement>) => {
    // Block twin submits from double-click / Strict Mode before the action runs.
    if (createSubmitLock.current || createPending) {
      e.preventDefault();
      e.stopPropagation();
    } else {
      createSubmitLock.current = true;
    }
  };

  const historyActionError = createHistoryState?.error ?? updateHistoryState?.error;
  const historyActionSuccess = createHistoryState?.success ?? updateHistoryState?.success;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 320px) minmax(0, 1fr)", gap: 16 }}>
      <aside style={sidebarStyle}>
        {championships.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setSelectedId(c.id);
              cancelReignForm();
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
            <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {c.brand ?? "Unassigned"} · {c.current_champion ?? "VACANT"}
            </div>
          </button>
        ))}
      </aside>

      <section style={{ display: "grid", gap: 16 }}>
        {selected ? (
          <>
            <div style={cardStyle}>
              <h2 style={{ ...h2Style, marginBottom: 4 }}>{selected.title_name ?? selected.id}</h2>
              <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--color-text-muted)" }}>
                Post event results first, then record title changes here (not from match saves).
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 14 }}>
                <Link href={`/championship/${encodeURIComponent(selected.id)}`} className="app-link" target="_blank">
                  View public title page →
                </Link>
                <a
                  href={`https://prowrestlingboxscore.com/championship/${encodeURIComponent(selected.id)}`}
                  className="app-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open on PWBS →
                </a>
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
                <h2 style={{ ...h2Style, marginBottom: 0 }}>Title History</h2>
                {!reignPanelOpen ? (
                  <button type="button" className="btn-primary" onClick={openAddReign}>
                    + Add reign
                  </button>
                ) : null}
              </div>
              <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--color-text-muted)" }}>
                Most recent champion at top, chronological order.
              </p>

              {reignPanelOpen ? (
                <div style={{ ...panelStyle, marginBottom: 16 }}>
                  <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>{editingHistoryId ? "Edit reign" : "Add reign"}</h3>
                  {historyActionError ? <p style={{ color: "var(--color-red)", fontSize: 13, margin: "0 0 10px" }}>{historyActionError}</p> : null}
                  {historyActionSuccess ? (
                    <p style={{ color: "var(--color-green)", fontSize: 13, margin: "0 0 10px" }}>{historyActionSuccess}</p>
                  ) : null}

                  {!editingHistoryId && !addReignType ? (
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
                      <button type="button" className="btn-secondary" onClick={() => startAddReignAs("historical")}>
                        Historical Reign
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => startAddReignAs("title_change")}>
                        Title Change
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => startAddReignAs("interim")}>
                        Interim Champion
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => startAddReignAs("resolve_interim")}>
                        Resolve Interim / Restore Sole
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => startAddReignAs("partner_substitution")}>
                        Partner Substitution
                      </button>
                      <span style={{ fontSize: 13, color: "var(--color-text-muted)", maxWidth: 520 }}>
                        Historical = past reign for records. Title Change = new sole champion (closes prior open reigns).
                        Interim = crown an interim while the injured champ stays open (both earn belt points). Resolve =
                        close the other open reign(s) and restore sole ownership. Partner Substitution = injured tag
                        partner swap.
                      </span>
                    </div>
                  ) : null}

                  {reignFormReady && addReignType && !editingHistoryId ? (
                    <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--color-text-muted)" }}>
                      {addReignType === "interim"
                        ? "Enter the interim champion and the event where they were crowned. Leave Defeated blank unless you want an optional note (interim matches are often multi-way; the injured champion was not defeated). Open reigns stay open and are marked inactive."
                        : addReignType === "resolve_interim"
                          ? "Champion = who remains the sole champion (must match an open reign). Date/Event won = when the interim period ended."
                          : null}
                    </p>
                  ) : null}

                  {reignFormReady ? (
                    editingHistoryId ? (
                      <form action={updateHistoryAction}>
                        <input type="hidden" name="id" value={editingHistoryId} />
                        <ReignFormFields form={reignForm} setForm={setReignForm} />
                        <ReignFormActions
                          pending={updatePending}
                          submitLabel={updatePending ? "Saving…" : "Update"}
                          onCancel={cancelReignForm}
                        />
                      </form>
                    ) : (
                      <form action={createHistoryAction} onSubmit={onCreateReignSubmit}>
                        <input type="hidden" name="championship_id" value={selectedId} />
                        <input type="hidden" name="reign_mode" value={addReignType ?? "title_change"} />
                        <input type="hidden" name="idempotency_token" value={idempotencyToken} />
                        <ReignFormFields form={reignForm} setForm={setReignForm} mode={addReignType} />
                        <ReignFormActions
                          pending={createPending}
                          submitLabel={
                            createPending
                              ? "Saving…"
                              : addReignType === "resolve_interim"
                                ? "Resolve"
                                : "Add"
                          }
                          onCancel={cancelReignForm}
                        />
                      </form>
                    )
                  ) : null}
                </div>
              ) : null}

              {selectedHistory.length === 0 && !reignPanelOpen ? (
                <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-muted)" }}>
                  No title history yet. Use + Add reign to record a title change or backfill a historical reign.
                </p>
              ) : (
                <div style={{ overflowX: "auto", border: "1px solid var(--color-border)", borderRadius: 6 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                    <thead>
                      <tr style={{ background: "var(--color-bg-elevated)", textAlign: "left" }}>
                        <th style={thStyle}>Champion</th>
                        <th style={thStyle}>Defeated</th>
                        <th style={thStyle}>Date Won</th>
                        <th style={thStyle}>Event Won</th>
                        <th style={thStyle}>Date Lost</th>
                        <th style={thStyle}>Event Lost</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Days</th>
                        <th style={{ ...thStyle, width: 140 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {selectedHistory.map((row) => (
                        <tr key={row.id} style={{ borderTop: "1px solid var(--color-border)" }}>
                          <td style={tdStyle}>
                            <strong>{row.champion ?? "—"}</strong>
                            {reignKindLabel(normalizeReignKind(row.reign_kind)) ? (
                              <span
                                style={{
                                  marginLeft: 8,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  letterSpacing: "0.04em",
                                  textTransform: "uppercase",
                                  color:
                                    normalizeReignKind(row.reign_kind) === "interim"
                                      ? "#b45309"
                                      : "#64748b",
                                }}
                              >
                                {reignKindLabel(normalizeReignKind(row.reign_kind))}
                              </span>
                            ) : null}
                          </td>
                          <td style={tdStyle}>{row.previous_champion ?? "—"}</td>
                          <td style={tdStyle}>{formatChampionshipAdminDate(row.date_won)}</td>
                          <td style={{ ...tdStyle, color: "var(--color-text-muted)" }}>{row.event_name ?? "—"}</td>
                          <td style={tdStyle}>{formatChampionshipAdminDate(row.date_lost)}</td>
                          <td style={{ ...tdStyle, color: "var(--color-text-muted)" }}>{row.event_lost ?? "—"}</td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>{displayHistoryDaysHeld(row)}</td>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <button type="button" className="btn-secondary" style={smallBtn} onClick={() => openEditReign(row)}>
                                Edit
                              </button>
                              <form action={deleteChampionshipHistoryAction}>
                                <input type="hidden" name="id" value={row.id} />
                                <button
                                  type="submit"
                                  className="btn-secondary"
                                  style={{ ...smallBtn, color: "#b91c1c", borderColor: "#fecaca" }}
                                  onClick={(e) => {
                                    if (!confirm("Remove this reign from title history?")) e.preventDefault();
                                  }}
                                >
                                  Delete
                                </button>
                              </form>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={cardStyle}>
              <TitleFactsEditor championshipId={selected.id} titleFacts={selected.title_facts ?? null} />
            </div>

            <details style={cardStyle}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                Advanced &amp; overrides
              </summary>
              <div style={{ display: "grid", gap: 16, marginTop: 12 }}>
                <form action={syncAction} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <input type="hidden" name="championship_id" value={selected.id} />
                  <button type="submit" className="btn-secondary" disabled={syncPending}>
                    {syncPending ? "Syncing…" : "Sync current champion from history"}
                  </button>
                  {syncState?.error ? <span style={{ color: "var(--color-red)" }}>{syncState.error}</span> : null}
                  {syncState?.success ? <span style={{ color: "var(--color-green)" }}>{syncState.success}</span> : null}
                </form>

                <form action={champAction}>
                  <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Current champion (manual override)</h3>
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
                      { label: "Date won", name: "date_won", value: toDateInputValue(selected.date_won), type: "date" },
                      { label: "Event won", name: "event_name", value: selected.event_name ?? "" },
                    ]}
                  />
                  <div style={footerStyle}>
                    <button className="btn-primary" type="submit" disabled={champPending}>
                      {champPending ? "Saving…" : "Save championship"}
                    </button>
                    {champState?.error ? <span style={{ color: "var(--color-red)" }}>{champState.error}</span> : null}
                    {champState?.success ? <span style={{ color: "var(--color-green)" }}>{champState.success}</span> : null}
                  </div>
                </form>

                <form action={deleteChampAction} style={{ border: "1px solid #fecaca", borderRadius: 6, padding: 12, background: "#fff7f7" }}>
                  <h3 style={{ margin: "0 0 8px", fontSize: 15, color: "#991b1b" }}>Delete championship</h3>
                  <input type="hidden" name="id" value={selected.id} />
                  <p style={{ marginTop: 0, fontSize: 13, color: "var(--color-text-muted)" }}>
                    Blocked while title history rows exist for this championship.
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
                    <label style={{ gridColumn: "1 / span 2" }}>
                      Reason (required)
                      <input name="reason" required style={inputStyle} />
                    </label>
                    <label>
                      Type DELETE
                      <input name="confirm_text" required placeholder="DELETE" style={inputStyle} />
                    </label>
                  </div>
                  <div style={footerStyle}>
                    <button
                      className="btn-secondary"
                      type="submit"
                      disabled={deleteChampPending}
                      style={{ background: "#b91c1c", borderColor: "#991b1b", color: "#fff" }}
                    >
                      {deleteChampPending ? "Deleting…" : "Delete championship"}
                    </button>
                    {deleteChampState?.error ? <span style={{ color: "var(--color-red)" }}>{deleteChampState.error}</span> : null}
                    {deleteChampState?.success ? <span style={{ color: "var(--color-green)" }}>{deleteChampState.success}</span> : null}
                  </div>
                </form>
              </div>
            </details>
          </>
        ) : (
          <p style={{ color: "var(--color-text-muted)" }}>Select a championship from the list.</p>
        )}

        <div style={{ ...cardStyle, borderStyle: "dashed" }}>
          {!showCreateChamp ? (
            <>
              <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--color-text-muted)", maxWidth: 560 }}>
                To update an existing title, use Title History above. Only use this when adding a brand-new championship row
                to the database.
              </p>
              <button type="button" className="btn-secondary" onClick={() => setShowCreateChamp(true)}>
                Add new championship to database…
              </button>
            </>
          ) : (
            <>
              <h2 style={{ ...h2Style, fontSize: 16 }}>Create / add new championship to database</h2>
              <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--color-text-muted)" }}>
                Inserts a new championships row. Does not add title history — use Title History after the title exists.
              </p>
              <form action={createChampAction} key={createChampState?.success ?? "create-champ"}>
            <GridFields
              fields={[
                { label: "Title name", name: "title_name", value: "" },
                { label: "Brand", name: "brand", value: "" },
                { label: "Type", name: "type", value: "" },
                { label: "Current champion", name: "current_champion", value: "" },
                { label: "Current champion slug", name: "current_champion_slug", value: "" },
                { label: "Previous champion", name: "previous_champion", value: "" },
                { label: "Previous champion slug", name: "previous_champion_slug", value: "" },
                { label: "Date won", name: "date_won", value: "", type: "date" },
                { label: "Event won", name: "event_name", value: "" },
              ]}
            />
                <div style={footerStyle}>
                  <button className="btn-primary" type="submit" disabled={createChampPending}>
                    {createChampPending ? "Saving…" : "Save new championship to database"}
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => setShowCreateChamp(false)}>
                    Cancel
                  </button>
                  {createChampState?.error ? <span style={{ color: "var(--color-red)" }}>{createChampState.error}</span> : null}
                  {createChampState?.success ? (
                    <span style={{ color: "var(--color-green)" }}>{createChampState.success}</span>
                  ) : null}
                </div>
              </form>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function ReignFormFields({
  form,
  setForm,
  mode = null,
}: {
  form: ReignForm;
  setForm: React.Dispatch<React.SetStateAction<ReignForm>>;
  mode?: ReignMode | null;
}) {
  const set = (key: keyof ReignForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  const isInterim = mode === "interim";

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
        <label>
          Champion *
          <input name="champion" value={form.champion} onChange={set("champion")} style={inputStyle} required />
        </label>
        <label>
          Defeated{isInterim ? " (optional)" : ""}
          <input
            name="previous_champion"
            value={form.previous_champion}
            onChange={set("previous_champion")}
            style={inputStyle}
            placeholder={isInterim ? "Leave blank, or note multi-way field" : undefined}
          />
        </label>
        <label>
          Date won *
          <input name="date_won" type="date" value={form.date_won} onChange={set("date_won")} style={inputStyle} required />
        </label>
        <label style={{ gridColumn: "1 / -1" }}>
          Event won
          <input
            name="event_name"
            value={form.event_name}
            onChange={set("event_name")}
            style={inputStyle}
            placeholder={isInterim ? "e.g. Raw, SmackDown, SummerSlam" : "e.g. WrestleMania"}
          />
        </label>
        <label>
          Date lost
          <input name="date_lost" type="date" value={form.date_lost} onChange={set("date_lost")} style={inputStyle} />
        </label>
        <label style={{ gridColumn: "1 / -1" }}>
          Event lost
          <input name="event_lost" value={form.event_lost} onChange={set("event_lost")} style={inputStyle} placeholder="e.g. SmackDown" />
        </label>
      </div>
      <details style={{ marginTop: 8 }}>
        <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--color-text-muted)" }}>Slugs (optional)</summary>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginTop: 8 }}>
          <label>
            Champion slug
            <input name="champion_slug" value={form.champion_slug} onChange={set("champion_slug")} style={inputStyle} />
          </label>
          <label>
            Defeated slug
            <input name="previous_champion_slug" value={form.previous_champion_slug} onChange={set("previous_champion_slug")} style={inputStyle} />
          </label>
        </div>
      </details>
    </>
  );
}

function ReignFormActions({
  pending,
  submitLabel,
  onCancel,
}: {
  pending: boolean;
  submitLabel: string;
  onCancel: () => void;
}) {
  return (
    <div style={{ ...footerStyle, marginTop: 12 }}>
      <button className="btn-primary" type="submit" disabled={pending}>
        {submitLabel}
      </button>
      <button type="button" className="btn-secondary" onClick={onCancel} disabled={pending}>
        Cancel
      </button>
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

const sidebarStyle: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  background: "var(--color-bg-card)",
  overflow: "auto",
  maxHeight: 760,
};
const cardStyle: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  padding: 14,
  background: "var(--color-bg-card)",
};
const panelStyle: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: 6,
  padding: 12,
  background: "var(--color-bg-elevated)",
};
const h2Style: CSSProperties = { marginTop: 0, fontSize: 18 };
const thStyle: CSSProperties = { padding: "10px 12px", fontWeight: 600, fontSize: 13 };
const tdStyle: CSSProperties = { padding: "10px 12px", verticalAlign: "top" };
const smallBtn: CSSProperties = { padding: "4px 10px", fontSize: 12 };
const inputStyle: CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 4,
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid var(--color-border)",
};
const footerStyle: CSSProperties = { marginTop: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" };
