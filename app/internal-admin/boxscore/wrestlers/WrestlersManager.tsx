"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { WrestlerActionState } from "./actions";
import { createWrestlerAction, updateWrestlerAction, deleteWrestlerAction } from "./actions";
import { WrestlerForm, WrestlerQuickEditHeader, type WrestlerFormRow } from "./WrestlerForm";

type Props = {
  wrestlers: WrestlerFormRow[];
  tagTeamNames: string[];
  stableNames: string[];
};

const defaultState: WrestlerActionState = null;

export function WrestlersManager({ wrestlers, tagTeamNames, stableNames }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string>(wrestlers[0]?.id ?? "");
  const [mode, setMode] = useState<"edit" | "create">(wrestlers.length > 0 ? "edit" : "create");
  const [search, setSearch] = useState("");
  const [editFormKey, setEditFormKey] = useState(0);
  const [createState, createFormAction, createPending] = useActionState(createWrestlerAction, defaultState);
  const [updateState, updateFormAction, updatePending] = useActionState(updateWrestlerAction, defaultState);
  const [deleteState, deleteFormAction, deletePending] = useActionState(deleteWrestlerAction, defaultState);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return wrestlers;
    return wrestlers.filter((w) => {
      const name = String(w.name ?? "").toLowerCase();
      const id = String(w.id ?? "").toLowerCase();
      const nickname = String(w.nickname ?? "").toLowerCase();
      const stable = String(w.stable ?? "").toLowerCase();
      return name.includes(q) || id.includes(q) || nickname.includes(q) || stable.includes(q);
    });
  }, [wrestlers, search]);

  const selected = wrestlers.find((w) => w.id === selectedId) ?? null;
  const allWrestlers = useMemo(() => wrestlers.map((w) => ({ id: w.id, name: w.name })), [wrestlers]);

  useEffect(() => {
    if (createState?.newId) {
      setSelectedId(createState.newId);
      setMode("edit");
      router.refresh();
    }
  }, [createState?.newId, router]);

  useEffect(() => {
    if (updateState?.newId) {
      setSelectedId(updateState.newId);
    }
  }, [updateState?.newId]);

  useEffect(() => {
    if (createState?.success || updateState?.success) {
      router.refresh();
    }
  }, [createState?.success, updateState?.success, router]);

  useEffect(() => {
    setEditFormKey(0);
  }, [selectedId]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 320px) minmax(0, 1fr)", gap: 16 }}>
      <aside style={sidebarStyle}>
        <div style={{ padding: 12, borderBottom: "1px solid var(--color-border)" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className={mode === "edit" ? "btn-primary" : "btn-secondary"}
              onClick={() => setMode("edit")}
              disabled={!selected}
            >
              Edit selected
            </button>
            <button type="button" className={mode === "create" ? "btn-primary" : "btn-secondary"} onClick={() => setMode("create")}>
              + Add wrestler
            </button>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search wrestlers…"
            style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--color-border)" }}
          />
        </div>
        <div style={{ maxHeight: 620, overflow: "auto" }}>
          {filtered.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => {
                setSelectedId(w.id);
                setMode("edit");
              }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 12px",
                border: "none",
                borderBottom: "1px solid var(--color-border)",
                cursor: "pointer",
                background: selectedId === w.id ? "var(--color-bg-elevated)" : "transparent",
              }}
            >
              <div style={{ fontWeight: 600 }}>{w.name}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                {w.id} · {w.classification ?? "Active"} · {w.brand ?? "Unassigned"}
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section style={{ display: "grid", gap: 16 }}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)", maxWidth: 720 }}>
          PWBS workflow: classification controls brand/status; gender required for wrestlers; tag partner syncs both
          wrestlers and tag_team_members. Headshots upload to the wrestler-images bucket (.png / .webp).
        </p>

        {mode === "create" ? (
          <form action={createFormAction} encType="multipart/form-data" style={cardStyle}>
            <h2 style={h2Style}>Add wrestler</h2>
            <WrestlerForm mode="create" allWrestlers={allWrestlers} tagTeamNames={tagTeamNames} stableNames={stableNames} />
            <div style={footerStyle}>
              <button type="submit" disabled={createPending} className="btn-primary">
                {createPending ? "Creating…" : "Create wrestler"}
              </button>
              {createState?.error ? <span style={{ color: "var(--color-red)" }}>{createState.error}</span> : null}
              {createState?.success ? <span style={{ color: "var(--color-green)" }}>{createState.success}</span> : null}
            </div>
          </form>
        ) : null}

        {mode === "edit" && selected ? (
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
              <Link href={`/wrestler/${encodeURIComponent(selected.id)}`} className="app-link" target="_blank">
                View public profile →
              </Link>
            </div>
            <WrestlerQuickEditHeader wrestler={selected} />
            <form key={`${selected.id}-${editFormKey}`} action={updateFormAction} encType="multipart/form-data">
              <WrestlerForm
                mode="edit"
                wrestler={selected}
                allWrestlers={allWrestlers}
                tagTeamNames={tagTeamNames}
                stableNames={stableNames}
              />
              <div style={{ ...footerStyle, justifyContent: "flex-end" }}>
                <button type="button" className="btn-secondary" onClick={() => setEditFormKey((k) => k + 1)}>
                  Cancel
                </button>
                <button type="submit" disabled={updatePending} className="btn-primary">
                  {updatePending ? "Saving…" : "Save Changes"}
                </button>
                {updateState?.error ? <span style={{ color: "var(--color-red)" }}>{updateState.error}</span> : null}
                {updateState?.success ? <span style={{ color: "var(--color-green)" }}>{updateState.success}</span> : null}
              </div>
            </form>
            <form
              key={`delete-${selected.id}`}
              action={deleteFormAction}
              style={{
                marginTop: 16,
                border: "1px solid #fecaca",
                borderRadius: 6,
                padding: 12,
                background: "#fff7f7",
              }}
            >
                  <h3 style={{ margin: "0 0 8px", fontSize: 15, color: "#991b1b" }}>Delete wrestler</h3>
                  <input type="hidden" name="id" value={selected.id} />
              <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--color-text-muted)" }}>
                Permanently removes <strong>{selected.name}</strong> ({selected.id}). Requires a reason and typing{" "}
                <strong>DELETE</strong> below. Blocked if they appear in title history, tag teams, championships, or
                league rosters.
              </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
                    <label style={{ gridColumn: "1 / span 2" }}>
                      Reason (required)
                      <input name="reason" required style={dangerInputStyle} placeholder="Why is this wrestler being removed?" />
                    </label>
                    <label>
                      Type DELETE to confirm
                      <input name="confirm_text" required placeholder="DELETE" style={dangerInputStyle} autoComplete="off" />
                    </label>
                  </div>
                  <div style={{ ...footerStyle, marginTop: 10 }}>
                    <button
                      type="submit"
                      className="btn-secondary"
                      disabled={deletePending}
                      style={{ background: "#b91c1c", borderColor: "#991b1b", color: "#fff" }}
                    >
                      {deletePending ? "Deleting…" : "Permanently delete wrestler"}
                    </button>
                    {deleteState?.error ? <span style={{ color: "var(--color-red)" }}>{deleteState.error}</span> : null}
                    {deleteState?.success ? (
                      <span style={{ color: "var(--color-green)" }}>{deleteState.success}</span>
                    ) : null}
                  </div>
            </form>
          </div>
        ) : mode === "edit" ? (
          <p style={{ color: "var(--color-text-muted)" }}>Select a wrestler from the list.</p>
        ) : null}
      </section>
    </div>
  );
}

const sidebarStyle: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  background: "var(--color-bg-card)",
  overflow: "hidden",
};
const cardStyle: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  padding: 14,
  background: "var(--color-bg-card)",
};
const h2Style: CSSProperties = { marginTop: 0, fontSize: 18 };
const footerStyle: CSSProperties = { marginTop: 14, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" };
const dangerInputStyle: CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 4,
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid #fecaca",
};
