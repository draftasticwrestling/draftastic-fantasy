"use client";

import { useActionState, useMemo, useState, type CSSProperties } from "react";
import type { WrestlerActionState } from "./actions";
import { createWrestlerAction, updateWrestlerAction, deleteWrestlerAction } from "./actions";

type WrestlerRow = {
  id: string;
  name: string;
  nickname?: string | null;
  brand?: string | null;
  classification?: string | null;
  person_type?: string | null;
  status?: string | null;
  Status?: string | null;
  dob?: string | null;
  nationality?: string | null;
  billed_from?: string | null;
  height?: string | null;
  weight?: string | null;
  image_url?: string | null;
  full_body_image_url?: string | null;
  accomplishments?: string | null;
  tag_team_name?: string | null;
  tag_team_partner_slug?: string | null;
  stable?: string | null;
  is_stable_leader?: boolean | null;
};

type Props = { wrestlers: WrestlerRow[] };

const defaultState: WrestlerActionState = null;

const CLASSIFICATIONS = ["Active", "Part-timer", "Celebrity Guests", "Alumni", "Non-wrestlers", "Inactive"];
const PERSON_TYPES = ["Wrestler", "Head of Creative", "GM", "Manager", "Announcer"];
const BRANDS = ["RAW", "SmackDown", "NXT", "AAA", "Unassigned", "N/A"];
const STATUSES = ["", "Injured", "On Hiatus", "Inactive", "Non-wrestler"];

function rowStatus(w: WrestlerRow): string {
  return String(w.status ?? w.Status ?? "");
}

export function WrestlersManager({ wrestlers }: Props) {
  const [selectedId, setSelectedId] = useState<string>(wrestlers[0]?.id ?? "");
  const [mode, setMode] = useState<"edit" | "create">(wrestlers.length > 0 ? "edit" : "create");
  const [search, setSearch] = useState("");
  const [createState, createFormAction, createPending] = useActionState(createWrestlerAction, defaultState);
  const [updateState, updateFormAction, updatePending] = useActionState(updateWrestlerAction, defaultState);

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

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 320px) minmax(0, 1fr)", gap: 16 }}>
      <aside style={{ border: "1px solid var(--color-border)", borderRadius: 8, background: "var(--color-bg-card)", overflow: "hidden" }}>
        <div style={{ padding: 12, borderBottom: "1px solid var(--color-border)" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button
              type="button"
              className={mode === "edit" ? "btn-primary" : "btn-secondary"}
              onClick={() => setMode("edit")}
              disabled={!selected}
            >
              Edit selected
            </button>
            <button type="button" className={mode === "create" ? "btn-primary" : "btn-secondary"} onClick={() => setMode("create")}>
              Add wrestler
            </button>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search wrestlers..."
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
        {mode === "create" ? (
          <form action={createFormAction} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 14, background: "var(--color-bg-card)" }}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Add wrestler</h2>
            <WrestlerFields />
            <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
              <button type="submit" disabled={createPending} className="btn-primary">
                {createPending ? "Creating..." : "Create wrestler"}
              </button>
              {createState?.error ? <span style={{ color: "var(--color-red)" }}>{createState.error}</span> : null}
              {createState?.success ? <span style={{ color: "var(--color-green)" }}>{createState.success}</span> : null}
            </div>
          </form>
        ) : null}

        {mode === "edit" && selected ? (
          <div style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 14, background: "var(--color-bg-card)" }}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Edit wrestler: {selected.name}</h2>
            <form key={selected.id} action={updateFormAction}>
              <WrestlerFields wrestler={selected} />
              <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
                <button type="submit" disabled={updatePending} className="btn-primary">
                  {updatePending ? "Saving..." : "Save wrestler"}
                </button>
                {updateState?.error ? <span style={{ color: "var(--color-red)" }}>{updateState.error}</span> : null}
                {updateState?.success ? <span style={{ color: "var(--color-green)" }}>{updateState.success}</span> : null}
              </div>
            </form>
            <div style={{ marginTop: 8 }}>
              <form action={deleteWrestlerAction} style={{ margin: 0 }}>
                <input type="hidden" name="id" value={selected.id} />
                <button
                  type="submit"
                  className="btn-secondary"
                  onClick={(e) => {
                    if (!confirm(`Delete ${selected.name}?`)) e.preventDefault();
                  }}
                >
                  Delete
                </button>
              </form>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function WrestlerFields({ wrestler }: { wrestler?: WrestlerRow }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
      <label>
        Slug
        <input name="id" defaultValue={wrestler?.id ?? ""} required style={inputStyle} />
      </label>
      <label>
        Name
        <input name="name" defaultValue={wrestler?.name ?? ""} required style={inputStyle} />
      </label>
      <label>
        Nickname
        <input name="nickname" defaultValue={wrestler?.nickname ?? ""} style={inputStyle} />
      </label>
      <label>
        Classification
        <select name="classification" defaultValue={wrestler?.classification ?? "Active"} style={inputStyle}>
          {CLASSIFICATIONS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label>
        Person Type
        <select name="person_type" defaultValue={wrestler?.person_type ?? "Wrestler"} style={inputStyle}>
          {PERSON_TYPES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label>
        Brand
        <select name="brand" defaultValue={wrestler?.brand ?? ""} style={inputStyle}>
          <option value="">None</option>
          {BRANDS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label>
        Status
        <select name="status" defaultValue={rowStatus(wrestler ?? { id: "", name: "" })} style={inputStyle}>
          {STATUSES.map((v) => (
            <option key={v || "none"} value={v}>
              {v || "Active"}
            </option>
          ))}
        </select>
      </label>
      <label>
        DOB
        <input name="dob" type="date" defaultValue={wrestler?.dob ?? ""} style={inputStyle} />
      </label>
      <label>
        Nationality
        <input name="nationality" defaultValue={wrestler?.nationality ?? ""} style={inputStyle} />
      </label>
      <label>
        Billed From
        <input name="billed_from" defaultValue={wrestler?.billed_from ?? ""} style={inputStyle} />
      </label>
      <label>
        Height
        <input name="height" defaultValue={wrestler?.height ?? ""} style={inputStyle} />
      </label>
      <label>
        Weight
        <input name="weight" defaultValue={wrestler?.weight ?? ""} style={inputStyle} />
      </label>
      <label>
        Tag Team Name
        <input name="tag_team_name" defaultValue={wrestler?.tag_team_name ?? ""} style={inputStyle} />
      </label>
      <label>
        Tag Team Partner Slug
        <input name="tag_team_partner_slug" defaultValue={wrestler?.tag_team_partner_slug ?? ""} style={inputStyle} />
      </label>
      <label>
        Stable
        <input name="stable" defaultValue={wrestler?.stable ?? ""} style={inputStyle} />
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 20 }}>
        <input name="is_stable_leader" type="checkbox" defaultChecked={Boolean(wrestler?.is_stable_leader)} />
        Stable leader
      </label>
      <label style={{ gridColumn: "1 / span 3" }}>
        Image URL
        <input name="image_url" defaultValue={wrestler?.image_url ?? ""} style={inputStyle} />
      </label>
      <label style={{ gridColumn: "1 / span 3" }}>
        Full-body Image URL
        <input name="full_body_image_url" defaultValue={wrestler?.full_body_image_url ?? ""} style={inputStyle} />
      </label>
      <label style={{ gridColumn: "1 / span 3" }}>
        Accomplishments
        <textarea name="accomplishments" defaultValue={wrestler?.accomplishments ?? ""} style={{ ...inputStyle, minHeight: 80 }} />
      </label>
    </div>
  );
}

const inputStyle: CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 4,
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid var(--color-border)",
};

