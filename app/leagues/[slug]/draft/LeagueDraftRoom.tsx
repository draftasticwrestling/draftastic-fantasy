"use client";

import { useState, useMemo } from "react";
import { useFormState } from "react-dom";
import { makeDraftPickWithStateAction } from "./actions";
import { DraftTimer } from "./DraftTimer";

const RATING_WEIGHT = 1.5;
const BRAND_STYLES: Record<string, { showBg: string; label: string }> = {
  Raw: { showBg: "#6B0F2A", label: "RAW" },
  SmackDown: { showBg: "#071A4A", label: "SD" },
  NXT: { showBg: "#1a1a1a", label: "NXT" },
  Unassigned: { showBg: "#4c4c4c", label: "UNASSIGNED" },
  Other: { showBg: "#2d2d2d", label: "OTHER" },
};

function rosterCategory(brand: string | null | undefined): string {
  if (!brand?.trim()) return "Unassigned";
  const lower = brand.trim().toLowerCase();
  if (lower === "raw") return "Raw";
  if (lower === "smackdown" || lower === "smack down") return "SmackDown";
  if (lower === "nxt" || lower.includes("nxt")) return "NXT";
  return "Unassigned";
}

function normalizeGender(g: string | null | undefined): string {
  if (!g) return "—";
  const lower = String(g).toLowerCase();
  if (lower === "male" || lower === "m") return "M";
  if (lower === "female" || lower === "f") return "F";
  return "—";
}

function calculateAge(dob: string | null | undefined): number | null {
  if (!dob?.trim()) return null;
  const date = new Date(dob);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const m = today.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < date.getDate())) age--;
  return age >= 0 ? age : null;
}

export type DraftRoomWrestler = {
  id: string;
  name: string | null;
  gender: string | null;
  brand: string | null;
  dob?: string | null;
  image_url?: string | null;
  rating_2k26?: number | null;
  rating_2k25?: number | null;
};

type PointsBySlug = Record<string, { rsPoints: number; plePoints: number; beltPoints: number }>;

export type WrestlerPoolDiagnostic = {
  source: "user" | "admin" | "none";
  userRawCount: number;
  userError: string | null;
  adminUsed: boolean;
  adminRawCount: number | null;
  adminError: string | null;
  filteredCount: number;
  hasServiceRole: boolean;
} | null;

type Props = {
  order: { overall_pick: number; user_id: string }[];
  picksHistory: { overall_pick: number; user_id: string; wrestler_id: string; wrestler_name: string | null }[];
  members: { user_id: string; display_name?: string | null; team_name?: string | null }[];
  wrestlers: DraftRoomWrestler[];
  wrestlerPoolDiagnostic?: WrestlerPoolDiagnostic;
  pointsBySlug: PointsBySlug;
  draftedIds: string[];
  currentPickSlot: number | null;
  totalPicks: number;
  draftStatus: string;
  currentPickerUserId: string | null;
  isCurrentPicker: boolean;
  leagueSlug: string;
  draftCurrentPickStartedAt: string | null;
};

export function LeagueDraftRoom({
  order,
  picksHistory,
  members,
  wrestlers,
  wrestlerPoolDiagnostic = null,
  pointsBySlug,
  draftedIds,
  currentPickSlot,
  totalPicks,
  draftStatus,
  currentPickerUserId,
  isCurrentPicker,
  leagueSlug,
  draftCurrentPickStartedAt,
}: Props) {
  const [state, formAction] = useFormState(makeDraftPickWithStateAction, { error: undefined });
  const [tableSort, setTableSort] = useState<"rank" | "name" | "total">("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const memberByUserId = useMemo(
    () => Object.fromEntries(members.map((m) => [m.user_id, m])),
    [members]
  );
  const currentManagerName =
    currentPickerUserId != null
      ? (memberByUserId[currentPickerUserId]?.team_name?.trim() ||
          memberByUserId[currentPickerUserId]?.display_name?.trim() ||
          "Unknown")
      : null;

  const available = useMemo(
    () => wrestlers.filter((w) => !draftedIds.includes(w.id)),
    [wrestlers, draftedIds]
  );

  const availableWithStats = useMemo(() => {
    return available
      .map((w) => {
        const pts = pointsBySlug[w.id] ?? { rsPoints: 0, plePoints: 0, beltPoints: 0 };
        const total = pts.rsPoints + pts.plePoints + pts.beltPoints;
        const rating = w.rating_2k26 ?? w.rating_2k25 ?? 0;
        const composite = total + rating * RATING_WEIGHT;
        return {
          wrestler: w,
          rs: pts.rsPoints,
          ple: pts.plePoints,
          belt: pts.beltPoints,
          total,
          composite,
        };
      })
      .sort((a, b) => b.composite - a.composite || (a.wrestler.name ?? "").localeCompare(b.wrestler.name ?? ""))
      .map((row, i) => ({ ...row, rank: i + 1 }));
  }, [available, pointsBySlug]);

  const sortedAvailable = useMemo(() => {
    const list = [...availableWithStats];
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      let out = 0;
      if (tableSort === "rank") out = a.rank - b.rank;
      else if (tableSort === "name")
        out = (a.wrestler.name ?? a.wrestler.id).localeCompare(b.wrestler.name ?? b.wrestler.id);
      else out = a.total - b.total;
      return out * dir;
    });
    return list;
  }, [availableWithStats, tableSort, sortDir]);

  const handleSort = (col: "rank" | "name" | "total") => {
    if (tableSort === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setTableSort(col);
      setSortDir(col === "name" ? "asc" : "desc");
    }
  };

  const rosterByUserId = useMemo(() => {
    const byUser: Record<string, { wrestler_id: string; wrestler_name: string | null; overall_pick: number }[]> = {};
    for (const p of picksHistory) {
      if (!byUser[p.user_id]) byUser[p.user_id] = [];
      byUser[p.user_id].push({
        wrestler_id: p.wrestler_id,
        wrestler_name: p.wrestler_name,
        overall_pick: p.overall_pick,
      });
    }
    for (const u of Object.keys(byUser)) {
      byUser[u].sort((a, b) => a.overall_pick - b.overall_pick);
    }
    return byUser;
  }, [picksHistory]);

  const uniqueOrderUserIds = useMemo(() => {
    const seen = new Set<string>();
    return order.filter((o) => {
      if (seen.has(o.user_id)) return false;
      seen.add(o.user_id);
      return true;
    }).map((o) => o.user_id);
  }, [order]);

  const isComplete = draftStatus === "completed";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {!isComplete && currentPickSlot != null && (
        <section
          style={{
            padding: 16,
            background: "var(--color-success-bg)",
            borderRadius: "var(--radius)",
            border: "1px solid var(--color-success-muted)",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <p style={{ margin: 0, fontWeight: 600, color: "var(--color-text)" }}>
            Pick {currentPickSlot} of {totalPicks} — <strong>{currentManagerName ?? "Unknown"}</strong> is on the clock
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {draftCurrentPickStartedAt && isCurrentPicker && (
              <DraftTimer startedAt={draftCurrentPickStartedAt} leagueSlug={leagueSlug} />
            )}
          </div>
        </section>
      )}

      {isComplete && (
        <p style={{ fontWeight: 600, color: "var(--color-success-muted)", marginBottom: 0 }}>
          Draft complete.
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div>
          <h3 style={{ fontSize: "1rem", marginBottom: 8 }}>Available wrestlers</h3>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 10 }}>
            Rank = Total + (2K × 1.5). Click column headers to sort.
          </p>
          {state?.error && (
            <p style={{ marginBottom: 8, fontSize: 14, color: "#b91c1c" }}>{state.error}</p>
          )}
          <div
            style={{
              maxHeight: 420,
              overflow: "auto",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius)",
            }}
          >
            {sortedAvailable.length === 0 ? (
              <div style={{ padding: 16, color: "var(--color-text-muted)", fontSize: 14 }}>
                {wrestlers.length === 0 ? (
                  <>
                    <p style={{ margin: "0 0 12px", fontWeight: 600 }}>Wrestler pool could not be loaded.</p>
                    {wrestlerPoolDiagnostic ? (
                      <div style={{ marginTop: 8, padding: 12, background: "var(--color-bg-elevated)", borderRadius: "var(--radius)", border: "1px solid var(--color-border)", fontFamily: "monospace", fontSize: 12 }}>
                        <p style={{ margin: "0 0 8px" }}><strong>Diagnostic</strong></p>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          <li>Service role available: {wrestlerPoolDiagnostic.hasServiceRole ? "yes" : "no"}</li>
                          <li>Data source: {wrestlerPoolDiagnostic.source}</li>
                          {wrestlerPoolDiagnostic.adminUsed && (
                            <li>Admin query: {wrestlerPoolDiagnostic.adminRawCount ?? 0} rows{wrestlerPoolDiagnostic.adminError ? ` — error: ${wrestlerPoolDiagnostic.adminError}` : ""}</li>
                          )}
                          <li>User (session) query: {wrestlerPoolDiagnostic.userRawCount} rows{wrestlerPoolDiagnostic.userError ? ` — error: ${wrestlerPoolDiagnostic.userError}` : ""}</li>
                          <li>After draftable filter: {wrestlerPoolDiagnostic.filteredCount} wrestlers</li>
                        </ul>
                        {!wrestlerPoolDiagnostic.hasServiceRole && (
                          <p style={{ margin: "8px 0 0", color: "var(--color-red)" }}>Set SUPABASE_SERVICE_ROLE_KEY in Netlify (and redeploy) so the draft can load the wrestler pool.</p>
                        )}
                        {wrestlerPoolDiagnostic.filteredCount === 0 && wrestlerPoolDiagnostic.userRawCount > 0 && (
                          <p style={{ margin: "8px 0 0" }}>Rows returned but none passed the draftable filter (status/classification/brand).</p>
                        )}
                      </div>
                    ) : (
                      <p>Try refreshing the page.</p>
                    )}
                  </>
                ) : (
                  "None left"
                )}
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead style={{ position: "sticky", top: 0, background: "var(--color-bg-elevated)", zIndex: 1 }}>
                  <tr>
                    <th style={{ padding: "8px 6px", textAlign: "center", borderBottom: "1px solid var(--color-border)", width: 36 }}>Roster</th>
                    <th style={{ padding: "8px 6px", textAlign: "left", borderBottom: "1px solid var(--color-border)" }}>
                      <button type="button" onClick={() => handleSort("rank")} style={{ background: "none", border: "none", padding: 0, font: "inherit", fontWeight: 600, cursor: "pointer" }}>
                        Rank {tableSort === "rank" && (sortDir === "asc" ? "↑" : "↓")}
                      </button>
                    </th>
                    <th style={{ padding: "8px 6px", textAlign: "left", borderBottom: "1px solid var(--color-border)" }}>
                      <button type="button" onClick={() => handleSort("name")} style={{ background: "none", border: "none", padding: 0, font: "inherit", fontWeight: 600, cursor: "pointer" }}>
                        Name {tableSort === "name" && (sortDir === "asc" ? "↑" : "↓")}
                      </button>
                    </th>
                    <th style={{ padding: "8px 6px", textAlign: "center", borderBottom: "1px solid var(--color-border)" }}>Gender</th>
                    <th style={{ padding: "8px 6px", textAlign: "center", borderBottom: "1px solid var(--color-border)" }}>Age</th>
                    <th style={{ padding: "8px 6px", textAlign: "center", borderBottom: "1px solid var(--color-border)" }}>2K</th>
                    <th style={{ padding: "8px 6px", textAlign: "right", borderBottom: "1px solid var(--color-border)" }}>R/S</th>
                    <th style={{ padding: "8px 6px", textAlign: "right", borderBottom: "1px solid var(--color-border)" }}>PLE</th>
                    <th style={{ padding: "8px 6px", textAlign: "right", borderBottom: "1px solid var(--color-border)" }}>Belt</th>
                    <th style={{ padding: "8px 6px", textAlign: "right", borderBottom: "1px solid var(--color-border)" }}>
                      <button type="button" onClick={() => handleSort("total")} style={{ background: "none", border: "none", padding: 0, font: "inherit", fontWeight: 600, cursor: "pointer" }}>
                        Total {tableSort === "total" && (sortDir === "asc" ? "↑" : "↓")}
                      </button>
                    </th>
                    <th style={{ padding: "8px 6px", borderBottom: "1px solid var(--color-border)" }} />
                  </tr>
                </thead>
                <tbody>
                  {sortedAvailable.map(({ wrestler: w, rank, rs, ple, belt, total }) => {
                    const display2k = w.rating_2k26 ?? w.rating_2k25 ?? null;
                    const roster = rosterCategory(w.brand);
                    const brandStyle = BRAND_STYLES[roster] ?? BRAND_STYLES.Unassigned;
                    return (
                      <tr key={w.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                        <td
                          style={{
                            padding: 0,
                            verticalAlign: "middle",
                            textAlign: "center",
                            background: brandStyle.showBg,
                            width: 36,
                            minWidth: 36,
                          }}
                        >
                          <div
                            style={{
                              writingMode: "vertical-rl",
                              textOrientation: "mixed",
                              transform: "rotate(-180deg)",
                              height: 72,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 10,
                              fontWeight: 700,
                              letterSpacing: 0.5,
                              color: "#fff",
                            }}
                          >
                            {brandStyle.label}
                          </div>
                        </td>
                        <td style={{ padding: "6px", fontWeight: 600 }}>{rank}</td>
                        <td style={{ padding: "6px", whiteSpace: "nowrap" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            {w.image_url ? (
                              <img
                                src={w.image_url}
                                alt=""
                                style={{ width: 32, height: 32, objectFit: "cover", borderRadius: "50%", background: "var(--color-bg-input)" }}
                              />
                            ) : (
                              <span
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: "50%",
                                  background: "var(--color-bg-input)",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 12,
                                  color: "var(--color-text-muted)",
                                }}
                                aria-hidden
                              >
                                —
                              </span>
                            )}
                            <span>{w.name ?? w.id}</span>
                          </span>
                        </td>
                        <td style={{ padding: "6px", textAlign: "center" }}>{normalizeGender(w.gender)}</td>
                        <td style={{ padding: "6px", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{calculateAge(w.dob) ?? "—"}</td>
                        <td style={{ padding: "6px", textAlign: "center", fontVariantNumeric: "tabular-nums", color: "#c00", fontWeight: 700 }}>{display2k != null ? display2k : "—"}</td>
                        <td style={{ padding: "6px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{rs}</td>
                        <td style={{ padding: "6px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{ple}</td>
                        <td style={{ padding: "6px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{belt}</td>
                        <td style={{ padding: "6px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{total}</td>
                        <td style={{ padding: "6px" }}>
                          {isCurrentPicker && !isComplete ? (
                            <form action={formAction} style={{ display: "inline" }}>
                              <input type="hidden" name="league_slug" value={leagueSlug} />
                              <input type="hidden" name="wrestler_id" value={w.id} />
                              <button
                                type="submit"
                                style={{
                                  padding: "4px 10px",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  background: "var(--color-blue)",
                                  color: "var(--color-text-inverse)",
                                  border: "none",
                                  borderRadius: "var(--radius)",
                                  cursor: "pointer",
                                }}
                              >
                                Pick
                              </button>
                            </form>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: "1rem", marginBottom: 12 }}>Rosters</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {uniqueOrderUserIds.map((userId) => {
              const member = memberByUserId[userId];
              const name = (member?.team_name?.trim() || member?.display_name?.trim() || "Unknown").trim() || "Unknown";
              const picks = rosterByUserId[userId] ?? [];
              const isCurrent = currentPickerUserId === userId && !isComplete;
              return (
                <div
                  key={userId}
                  style={{
                    padding: 12,
                    background: isCurrent ? "var(--color-success-bg)" : "var(--color-bg-elevated)",
                    borderRadius: "var(--radius)",
                    border: `1px solid ${isCurrent ? "var(--color-success-muted)" : "var(--color-border)"}`,
                  }}
                >
                  <strong style={{ fontSize: 14 }}>{name}</strong>
                  <ul style={{ margin: "8px 0 0", paddingLeft: 0, listStyle: "none", fontSize: 14, color: "var(--color-text-muted)" }}>
                    {picks.map(({ wrestler_id, wrestler_name }) => (
                      <li key={`${userId}-${wrestler_id}`} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span>{wrestler_name ?? wrestler_id}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
