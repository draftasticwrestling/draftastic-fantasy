"use client";

import { useActionState, useMemo, useState, type CSSProperties } from "react";
import {
  addTagTeamMemberAction,
  createTagTeamAction,
  deleteTagTeamAction,
  deleteTagTeamMemberAction,
  type TeamActionState,
  updateTagTeamAction,
  updateTagTeamMemberAction,
  updateWrestlerStableAction,
} from "./actions";

type Team = {
  id: string;
  name?: string | null;
  brand?: string | null;
  description?: string | null;
  is_stable?: boolean | null;
  primary_for_stable?: string | null;
  active?: boolean | null;
};
type Member = { tag_team_id: string; wrestler_slug: string; member_order?: number | null; active?: boolean | null };
type Wrestler = { id: string; name: string; stable?: string | null; is_stable_leader?: boolean | null };

const defaultState: TeamActionState = null;

export function TagTeamsStablesManager({
  teams,
  members,
  wrestlers,
}: {
  teams: Team[];
  members: Member[];
  wrestlers: Wrestler[];
}) {
  const [selectedTeamId, setSelectedTeamId] = useState(teams[0]?.id ?? "");
  const [selectedWrestlerId, setSelectedWrestlerId] = useState(wrestlers[0]?.id ?? "");

  const team = teams.find((t) => t.id === selectedTeamId) ?? null;
  const teamMembers = useMemo(
    () => members.filter((m) => m.tag_team_id === selectedTeamId).sort((a, b) => (a.member_order ?? 0) - (b.member_order ?? 0)),
    [members, selectedTeamId]
  );
  const wrestler = wrestlers.find((w) => w.id === selectedWrestlerId) ?? null;

  const [createTeamState, createTeamAction, createTeamPending] = useActionState(createTagTeamAction, defaultState);
  const [updateTeamState, updateTeamAction, updateTeamPending] = useActionState(updateTagTeamAction, defaultState);
  const [addMemberState, addMemberAction, addMemberPending] = useActionState(addTagTeamMemberAction, defaultState);
  const [updateMemberState, updateMemberAction, updateMemberPending] = useActionState(updateTagTeamMemberAction, defaultState);
  const [stableState, stableAction, stablePending] = useActionState(updateWrestlerStableAction, defaultState);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 320px) minmax(0, 1fr)", gap: 16 }}>
      <aside style={sidebarStyle}>
        <div style={{ padding: 10, borderBottom: "1px solid var(--color-border)", fontWeight: 600 }}>Tag teams</div>
        <div style={{ maxHeight: 340, overflow: "auto" }}>
          {teams.map((t) => (
            <button key={t.id} type="button" onClick={() => setSelectedTeamId(t.id)} style={{ ...rowBtnStyle, background: selectedTeamId === t.id ? "var(--color-bg-elevated)" : "transparent" }}>
              <div style={{ fontWeight: 600 }}>{t.name ?? t.id}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{t.id} · {t.brand ?? "Unassigned"} · {t.active === false ? "inactive" : "active"}</div>
            </button>
          ))}
        </div>
        <div style={{ padding: 10, borderTop: "1px solid var(--color-border)", fontWeight: 600 }}>Stables (from wrestlers)</div>
        <div style={{ maxHeight: 250, overflow: "auto", padding: 10 }}>
          {[...new Set(wrestlers.map((w) => w.stable).filter(Boolean) as string[])].sort().map((s) => (
            <div key={s} style={{ fontSize: 13, padding: "3px 0" }}>{s}</div>
          ))}
        </div>
      </aside>

      <section style={{ display: "grid", gap: 16 }}>
        <form action={createTeamAction} style={cardStyle}>
          <h2 style={h2Style}>Create tag team</h2>
          <GridFields
            fields={[
              { label: "Team id", name: "id", value: "" },
              { label: "Name", name: "name", value: "" },
              { label: "Brand", name: "brand", value: "" },
              { label: "Primary for stable", name: "primary_for_stable", value: "" },
              { label: "Description", name: "description", value: "", full: true },
            ]}
          />
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8 }}>
            <input name="is_stable" type="checkbox" /> Mark as stable
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, marginLeft: 12 }}>
            <input name="active" type="checkbox" defaultChecked /> Active
          </label>
          <div style={footerStyle}>
            <button className="btn-primary" type="submit" disabled={createTeamPending}>{createTeamPending ? "Creating..." : "Create team"}</button>
            {createTeamState?.error ? <span style={{ color: "var(--color-red)" }}>{createTeamState.error}</span> : null}
            {createTeamState?.success ? <span style={{ color: "var(--color-green)" }}>{createTeamState.success}</span> : null}
          </div>
        </form>

        {team ? (
          <div style={cardStyle}>
            <h2 style={h2Style}>Edit team: {team.name ?? team.id}</h2>
            <form action={updateTeamAction}>
              <input type="hidden" name="id" value={team.id} />
              <GridFields
                fields={[
                  { label: "Name", name: "name", value: team.name ?? "" },
                  { label: "Brand", name: "brand", value: team.brand ?? "" },
                  { label: "Primary for stable", name: "primary_for_stable", value: team.primary_for_stable ?? "" },
                  { label: "Description", name: "description", value: team.description ?? "", full: true },
                ]}
              />
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8 }}>
                <input name="is_stable" type="checkbox" defaultChecked={Boolean(team.is_stable)} /> Stable
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, marginLeft: 12 }}>
                <input name="active" type="checkbox" defaultChecked={team.active !== false} /> Active
              </label>
              <div style={footerStyle}>
                <button className="btn-primary" type="submit" disabled={updateTeamPending}>{updateTeamPending ? "Saving..." : "Save team"}</button>
                {updateTeamState?.error ? <span style={{ color: "var(--color-red)" }}>{updateTeamState.error}</span> : null}
                {updateTeamState?.success ? <span style={{ color: "var(--color-green)" }}>{updateTeamState.success}</span> : null}
              </div>
            </form>
            <form action={deleteTagTeamAction} style={{ marginTop: 10 }}>
              <input type="hidden" name="id" value={team.id} />
              <button
                type="submit"
                className="btn-secondary"
                onClick={(e) => {
                  if (!confirm(`Delete team ${team.name ?? team.id}?`)) e.preventDefault();
                }}
              >
                Delete team
              </button>
            </form>
          </div>
        ) : null}

        <div style={cardStyle}>
          <h2 style={h2Style}>Team members ({teamMembers.length})</h2>
          <form action={addMemberAction} style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap", marginBottom: 12 }}>
            <input type="hidden" name="tag_team_id" value={selectedTeamId} />
            <label>
              Wrestler
              <select name="wrestler_slug" style={inputStyle} defaultValue="">
                <option value="" disabled>Select wrestler</option>
                {wrestlers.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </label>
            <label>
              Order
              <input name="member_order" defaultValue="0" style={inputStyle} />
            </label>
            <button className="btn-primary" type="submit" disabled={addMemberPending || !selectedTeamId}>{addMemberPending ? "Adding..." : "Add member"}</button>
          </form>
          {addMemberState?.error ? <div style={{ color: "var(--color-red)", marginBottom: 8 }}>{addMemberState.error}</div> : null}
          {addMemberState?.success ? <div style={{ color: "var(--color-green)", marginBottom: 8 }}>{addMemberState.success}</div> : null}
          <div style={{ display: "grid", gap: 8 }}>
            {teamMembers.map((m) => (
              <div key={`${m.tag_team_id}-${m.wrestler_slug}`} style={{ border: "1px solid var(--color-border)", borderRadius: 6, padding: 10 }}>
                <div style={{ fontWeight: 600 }}>{wrestlers.find((w) => w.id === m.wrestler_slug)?.name ?? m.wrestler_slug}</div>
                <form action={updateMemberAction} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
                  <input type="hidden" name="tag_team_id" value={m.tag_team_id} />
                  <input type="hidden" name="wrestler_slug" value={m.wrestler_slug} />
                  <label>
                    Order
                    <input name="member_order" defaultValue={String(m.member_order ?? 0)} style={inputStyle} />
                  </label>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <input name="active" type="checkbox" defaultChecked={m.active !== false} />
                    Active
                  </label>
                  <button className="btn-secondary" type="submit" disabled={updateMemberPending}>{updateMemberPending ? "Saving..." : "Save"}</button>
                </form>
                <form action={deleteTagTeamMemberAction} style={{ marginTop: 6 }}>
                  <input type="hidden" name="tag_team_id" value={m.tag_team_id} />
                  <input type="hidden" name="wrestler_slug" value={m.wrestler_slug} />
                  <button
                    className="btn-secondary"
                    type="submit"
                    onClick={(e) => {
                      if (!confirm("Remove this member?")) e.preventDefault();
                    }}
                  >
                    Remove
                  </button>
                </form>
              </div>
            ))}
          </div>
          {updateMemberState?.error ? <div style={{ color: "var(--color-red)", marginTop: 8 }}>{updateMemberState.error}</div> : null}
          {updateMemberState?.success ? <div style={{ color: "var(--color-green)", marginTop: 8 }}>{updateMemberState.success}</div> : null}
        </div>

        {wrestler ? (
          <form action={stableAction} style={cardStyle}>
            <h2 style={h2Style}>Stable editor (wrestler)</h2>
            <label>
              Wrestler
              <select value={selectedWrestlerId} onChange={(e) => setSelectedWrestlerId(e.target.value)} style={inputStyle}>
                {wrestlers.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </label>
            <input type="hidden" name="wrestler_id" value={wrestler.id} />
            <label style={{ marginTop: 8, display: "block" }}>
              Stable
              <input name="stable" defaultValue={wrestler.stable ?? ""} style={inputStyle} />
            </label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8 }}>
              <input name="is_stable_leader" type="checkbox" defaultChecked={Boolean(wrestler.is_stable_leader)} />
              Stable leader
            </label>
            <div style={footerStyle}>
              <button className="btn-primary" type="submit" disabled={stablePending}>{stablePending ? "Saving..." : "Save stable info"}</button>
              {stableState?.error ? <span style={{ color: "var(--color-red)" }}>{stableState.error}</span> : null}
              {stableState?.success ? <span style={{ color: "var(--color-green)" }}>{stableState.success}</span> : null}
            </div>
          </form>
        ) : null}
      </section>
    </div>
  );
}

type Field = { label: string; name: string; value: string; full?: boolean };
function GridFields({ fields }: { fields: Field[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
      {fields.map((f) => (
        <label key={f.name} style={f.full ? { gridColumn: "1 / span 3" } : undefined}>
          {f.label}
          <input name={f.name} defaultValue={f.value} style={inputStyle} />
        </label>
      ))}
    </div>
  );
}

const sidebarStyle: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  background: "var(--color-bg-card)",
  overflow: "hidden",
};
const rowBtnStyle: CSSProperties = {
  width: "100%",
  textAlign: "left",
  border: "none",
  borderBottom: "1px solid var(--color-border)",
  padding: "10px 12px",
  cursor: "pointer",
};
const cardStyle: CSSProperties = { border: "1px solid var(--color-border)", borderRadius: 8, padding: 14, background: "var(--color-bg-card)" };
const h2Style: CSSProperties = { marginTop: 0, fontSize: 18 };
const inputStyle: CSSProperties = { display: "block", width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: 6, border: "1px solid var(--color-border)" };
const footerStyle: CSSProperties = { marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" };

