"use client";

import { useState, useMemo } from "react";
import { useFormState } from "react-dom";
import { getPointsForWrestler } from "@/lib/scoring/aggregateWrestlerPoints.js";
import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";
import { makeDraftPickWithStateAction } from "./actions";
import { DraftTimer } from "./DraftTimer";

const RATING_WEIGHT = 1.5;
const BRAND_STYLES: Record<string, { showBg: string; label: string }> = {
  Raw: { showBg: "#6B0F2A", label: "RAW" },
  SmackDown: { showBg: "#071A4A", label: "SD" },
  NXT: { showBg: "#1a1a1a", label: "NXT" },
  AAA: { showBg: "#2d2d2d", label: "AAA" },
  "Front Office": { showBg: "#3a3a3a", label: "FRONT OFFICE" },
  "Celebrity Guests": { showBg: "#2d2d2d", label: "CELEBRITY" },
  Alumni: { showBg: "#2d2d2d", label: "ALUMNI" },
  Unassigned: { showBg: "#4c4c4c", label: "UNASSIGNED" },
  Other: { showBg: "#2d2d2d", label: "OTHER" },
};

function rosterCategory(brand: string | null | undefined): string {
  if (!brand?.trim()) return "Unassigned";
  const lower = brand.trim().toLowerCase();
  if (lower === "raw") return "Raw";
  if (lower === "smackdown" || lower === "smack down") return "SmackDown";
  if (lower === "nxt" || lower.includes("nxt")) return "NXT";
  if (lower === "celebrity guests" || lower === "celebrity" || lower === "celebrity guest") return "Celebrity Guests";
  if (lower === "alumni") return "Alumni";
  if (lower === "managers" || lower === "manager" || lower === "gm" || lower === "gms" || lower === "head of creative" || lower === "announcers" || lower === "announcer") return "Front Office";
  if (lower === "aaa") return "AAA";
  return "Other";
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

/** Points period for ranking/filtering (matches League Leaders). */
export type PointsPeriod = "sinceStart" | "2025" | "2026" | "allTime";

const POINTS_PERIOD_OPTIONS: { value: PointsPeriod; label: string }[] = [
  { value: "allTime", label: "All-time points" },
  { value: "2026", label: "2026 points" },
  { value: "2025", label: "2025 points" },
  { value: "sinceStart", label: "Since league start" },
];

const ROSTER_CATEGORIES = [
  { value: "Raw", label: "Raw" },
  { value: "SmackDown", label: "SmackDown" },
  { value: "NXT", label: "NXT" },
  { value: "AAA", label: "AAA" },
  { value: "Front Office", label: "Front Office" },
  { value: "Celebrity Guests", label: "Celebrity Guests" },
  { value: "Alumni", label: "Alumni" },
  { value: "Unassigned", label: "Unassigned" },
  { value: "Other", label: "Other" },
] as const;

function normalizeRoster(brand: string | null | undefined): string {
  if (!brand?.trim()) return "Unassigned";
  const lower = brand.trim().toLowerCase();
  if (lower === "raw") return "Raw";
  if (lower === "smackdown" || lower === "smack down") return "SmackDown";
  if (lower === "nxt" || lower.includes("nxt")) return "NXT";
  if (lower === "aaa") return "AAA";
  if (lower === "celebrity guests" || lower === "celebrity" || lower === "celebrity guest") return "Celebrity Guests";
  if (lower === "alumni") return "Alumni";
  if (lower === "managers" || lower === "manager" || lower === "gm" || lower === "gms" || lower === "head of creative" || lower === "announcers" || lower === "announcer") return "Front Office";
  return "Other";
}

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
  points2025BySlug: PointsBySlug;
  points2026BySlug: PointsBySlug;
  pointsAllTimeBySlug: PointsBySlug;
  draftedIds: string[];
  /** Roster entries from league_rosters (same source as draftedIds). When set, used to show who picked which wrestler so display stays in sync. */
  rosterEntriesByUser?: Record<string, { wrestler_id: string }[]>;
  currentPickSlot: number | null;
  totalPicks: number;
  draftStatus: string;
  currentPickerUserId: string | null;
  isCurrentPicker: boolean;
  leagueSlug: string;
  draftCurrentPickStartedAt: string | null;
  /** For autopick use 5; for live use league time_per_pick_seconds so timer matches server. */
  timePerPickSeconds?: number;
  /** When true (e.g. autopick), show the countdown timer to everyone, not just the current picker. */
  showTimerForAll?: boolean;
};

export function LeagueDraftRoom({
  order,
  picksHistory,
  members,
  wrestlers,
  wrestlerPoolDiagnostic = null,
  pointsBySlug,
  points2025BySlug,
  points2026BySlug,
  pointsAllTimeBySlug,
  draftedIds,
  rosterEntriesByUser,
  currentPickSlot,
  totalPicks,
  draftStatus,
  currentPickerUserId,
  isCurrentPicker,
  leagueSlug,
  draftCurrentPickStartedAt,
  timePerPickSeconds = 120,
  showTimerForAll = false,
}: Props) {
  const [state, formAction] = useFormState(makeDraftPickWithStateAction, { error: undefined });
  const [tableSort, setTableSort] = useState<"rank" | "name" | "total">("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [pointsPeriod, setPointsPeriod] = useState<PointsPeriod>("allTime");
  const [includedRosters, setIncludedRosters] = useState<Set<string>>(() => new Set(["Raw", "SmackDown"]));
  const [searchQuery, setSearchQuery] = useState("");

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

  const pointsMapForPeriod = useMemo(() => {
    if (pointsPeriod === "2025") return points2025BySlug;
    if (pointsPeriod === "2026") return points2026BySlug;
    if (pointsPeriod === "allTime") return pointsAllTimeBySlug;
    return pointsBySlug;
  }, [pointsPeriod, pointsBySlug, points2025BySlug, points2026BySlug, pointsAllTimeBySlug]);

  const availableWithStats = useMemo(() => {
    const filtered = available.filter((w) => includedRosters.has(normalizeRoster(w.brand)));
    return filtered
      .map((w) => {
        const pts = getPointsForWrestler(
          pointsMapForPeriod,
          w.id ?? "",
          w.name != null ? normalizeWrestlerName(w.name) : ""
        );
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
  }, [available, pointsMapForPeriod, includedRosters]);

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

  const filteredBySearch = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sortedAvailable;
    return sortedAvailable.filter((row) => {
      const name = (row.wrestler.name ?? row.wrestler.id ?? "").toLowerCase();
      return name.startsWith(q) || name.includes(q);
    });
  }, [sortedAvailable, searchQuery]);

  const handleSort = (col: "rank" | "name" | "total") => {
    if (tableSort === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setTableSort(col);
      setSortDir(col === "name" ? "asc" : "desc");
    }
  };

  const wrestlerIdToName = useMemo(
    () => Object.fromEntries(wrestlers.map((w) => [w.id, w.name ?? w.id])),
    [wrestlers]
  );
  const wrestlerIdToImage = useMemo(
    () => Object.fromEntries(wrestlers.map((w) => [w.id, w.image_url ?? null])),
    [wrestlers]
  );

  const rosterByUserId = useMemo(() => {
    // Prefer picksHistory for the roster panel so all teams show their drafted wrestlers
    // (league_rosters via rosterEntriesByUser may be RLS-limited to current user only).
    if (picksHistory.length > 0) {
      const byUser: Record<string, { wrestler_id: string; wrestler_name: string | null; overall_pick?: number }[]> = {};
      for (const p of picksHistory) {
        if (!byUser[p.user_id]) byUser[p.user_id] = [];
        byUser[p.user_id].push({
          wrestler_id: p.wrestler_id,
          wrestler_name: p.wrestler_name ?? wrestlerIdToName[p.wrestler_id] ?? p.wrestler_id,
          overall_pick: p.overall_pick,
        });
      }
      for (const u of Object.keys(byUser)) {
        byUser[u].sort((a, b) => (a.overall_pick ?? 0) - (b.overall_pick ?? 0));
      }
      return byUser;
    }
    if (rosterEntriesByUser && Object.keys(rosterEntriesByUser).length > 0) {
      const byUser: Record<string, { wrestler_id: string; wrestler_name: string | null }[]> = {};
      for (const [uid, entries] of Object.entries(rosterEntriesByUser)) {
        byUser[uid] = entries.map((e) => ({
          wrestler_id: e.wrestler_id,
          wrestler_name: wrestlerIdToName[e.wrestler_id] ?? e.wrestler_id,
        }));
      }
      return byUser;
    }
    return {};
  }, [picksHistory, rosterEntriesByUser, wrestlerIdToName]);

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
            {draftCurrentPickStartedAt && (isCurrentPicker || showTimerForAll) && (
              <DraftTimer
                startedAt={draftCurrentPickStartedAt}
                leagueSlug={leagueSlug}
                secondsPerPick={timePerPickSeconds}
              />
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
          <div style={{ marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label htmlFor="draft-points-period" style={{ fontSize: 13, fontWeight: 600 }}>Points:</label>
              <select
                id="draft-points-period"
                value={pointsPeriod}
                onChange={(e) => setPointsPeriod(e.target.value as PointsPeriod)}
                style={{ fontSize: 13, padding: "4px 8px", borderRadius: "var(--radius)", border: "1px solid var(--color-border)" }}
                aria-label="Points period"
              >
                {POINTS_PERIOD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Include:</span>
              {ROSTER_CATEGORIES.map(({ value, label }) => (
                <label key={value} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={includedRosters.has(value)}
                    onChange={() => setIncludedRosters((prev) => {
                      const next = new Set(prev);
                      if (next.has(value)) next.delete(value);
                      else next.add(value);
                      return next;
                    })}
                    aria-label={`Include ${label}`}
                  />
                  <span>{label}</span>
                </label>
              ))}
              <button
                type="button"
                onClick={() => setIncludedRosters(new Set(ROSTER_CATEGORIES.map((c) => c.value)))}
                style={{ fontSize: 11, padding: "2px 6px", background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", borderRadius: "var(--radius)", cursor: "pointer" }}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setIncludedRosters(new Set())}
                style={{ fontSize: 11, padding: "2px 6px", background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", borderRadius: "var(--radius)", cursor: "pointer" }}
              >
                None
              </button>
            </div>
            <div style={{ marginBottom: 10 }}>
              <input
                type="search"
                placeholder="Search wrestler name…"
                aria-label="Search wrestler name"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  maxWidth: 280,
                  padding: "8px 12px",
                  fontSize: 14,
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius)",
                  background: "var(--color-bg-input)",
                }}
              />
            </div>
          </div>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 10 }}>
            Rank = Total + (2K × 1.5). Click column headers to sort. Only available (undrafted) wrestlers shown.
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
            {filteredBySearch.length === 0 ? (
              <div style={{ padding: 16, color: "var(--color-text-muted)", fontSize: 14 }}>
                {available.length > 0 && includedRosters.size === 0 ? (
                  <p style={{ margin: 0 }}>No rosters selected. Use the Include checkboxes above to show Raw, SmackDown, NXT, etc.</p>
                ) : wrestlers.length === 0 ? (
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
                  {filteredBySearch.map(({ wrestler: w, rank, rs, ple, belt, total }) => {
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
                    {picks.map(({ wrestler_id, wrestler_name }) => {
                      const displayName = wrestler_name ?? wrestlerIdToName[wrestler_id] ?? wrestler_id;
                      const imageUrl = wrestlerIdToImage[wrestler_id];
                      return (
                        <li key={`${userId}-${wrestler_id}`} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt=""
                              style={{
                                width: 24,
                                height: 24,
                                objectFit: "cover",
                                borderRadius: "50%",
                                background: "var(--color-bg-input)",
                              }}
                            />
                          ) : (
                            <span
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: "50%",
                                background: "var(--color-bg-input)",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 10,
                                color: "var(--color-text-muted)",
                              }}
                              aria-hidden
                            >
                              —
                            </span>
                          )}
                          <span>{displayName}</span>
                        </li>
                      );
                    })}
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
