"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type WrestlerRow = {
  id: string;
  name: string | null;
  gender: string | null;
  brand: string | null;
  image_url?: string | null;
  dob?: string | null;
  rsPoints?: number;
  plePoints?: number;
  beltPoints?: number;
  totalPoints?: number;
  /** Alter-ego persona text, e.g. "Also: El Grande Americano (from Jun 2025)" */
  personaDisplay?: string | null;
};

const ROSTER_ORDER = [
  "Raw",
  "SmackDown",
  "NXT",
  "Celebrity Guests",
  "Managers",
  "Alumni",
  "Other",
] as const;

const BRAND_STYLES: Record<string, { bg: string; showBg: string; label: string }> = {
  Raw: { bg: "#8B1538", showBg: "#6B0F2A", label: "RAW" },
  SmackDown: { bg: "#0A2463", showBg: "#071A4A", label: "SD" },
  NXT: { bg: "#2C2C2C", showBg: "#1a1a1a", label: "NXT" },
  "Celebrity Guests": { bg: "#3d3d3d", showBg: "#2d2d2d", label: "CELEBRITY" },
  Managers: { bg: "#3d3d3d", showBg: "#2d2d2d", label: "MANAGERS" },
  Alumni: { bg: "#3d3d3d", showBg: "#2d2d2d", label: "ALUMNI" },
  Other: { bg: "#3d3d3d", showBg: "#2d2d2d", label: "OTHER" },
};

function normalizeRoster(brand: string | null): string {
  if (!brand || !brand.trim()) return "Other";
  const lower = brand.trim().toLowerCase();
  if (lower === "raw") return "Raw";
  if (lower === "smackdown" || lower === "smack down") return "SmackDown";
  if (lower === "nxt") return "NXT";
  if (lower === "celebrity guests" || lower === "celebrity" || lower === "celebrity guest") return "Celebrity Guests";
  if (lower === "managers" || lower === "manager") return "Managers";
  if (lower === "alumni") return "Alumni";
  return "Other";
}

/** Exclude Head of Creative, GMs, Managers, Announcers & Alumni from the draft/free agent table. */
function isExcludedFromPool(brand: string | null): boolean {
  if (!brand || !brand.trim()) return false;
  const lower = brand.trim().toLowerCase();
  if (lower === "managers" || lower === "manager") return true;
  if (lower === "gm" || lower === "gms") return true;
  if (lower === "head of creative") return true;
  if (lower === "announcers" || lower === "announcer") return true;
  if (lower === "alumni") return true;
  return false;
}

function normalizeGender(g: string | null): string {
  if (!g) return "—";
  const lower = String(g).toLowerCase();
  if (lower === "male" || lower === "m") return "M";
  if (lower === "female" || lower === "f") return "F";
  return "—";
}

function calculateAge(dob: string | null | undefined): number | null {
  if (!dob || !dob.trim()) return null;
  const date = new Date(dob);
  if (isNaN(date.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const m = today.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < date.getDate())) age--;
  return age >= 0 ? age : null;
}

function byName(a: WrestlerRow, b: WrestlerRow) {
  const na = (a.name || a.id).toLowerCase();
  const nb = (b.name || b.id).toLowerCase();
  return na.localeCompare(nb);
}

export type SortColumn =
  | "roster"
  | "name"
  | "gender"
  | "age"
  | "rsPoints"
  | "plePoints"
  | "beltPoints"
  | "totalPoints";
type SortDir = "asc" | "desc";

function compare(a: WrestlerRow, b: WrestlerRow, col: SortColumn, dir: SortDir): number {
  let out = 0;
  switch (col) {
    case "roster": {
      const ra = normalizeRoster(a.brand);
      const rb = normalizeRoster(b.brand);
      const ia = ROSTER_ORDER.indexOf(ra as (typeof ROSTER_ORDER)[number]);
      const ib = ROSTER_ORDER.indexOf(rb as (typeof ROSTER_ORDER)[number]);
      out = ia - ib;
      break;
    }
    case "name":
      out = byName(a, b);
      break;
    case "gender": {
      const ga = normalizeGender(a.gender);
      const gb = normalizeGender(b.gender);
      const order = (g: string) => (g === "M" ? 0 : g === "F" ? 1 : 2);
      out = order(ga) - order(gb);
      break;
    }
    case "age": {
      const ageA = calculateAge(a.dob) ?? -1;
      const ageB = calculateAge(b.dob) ?? -1;
      out = ageA - ageB;
      break;
    }
    case "rsPoints":
      out = (a.rsPoints ?? 0) - (b.rsPoints ?? 0);
      break;
    case "plePoints":
      out = (a.plePoints ?? 0) - (b.plePoints ?? 0);
      break;
    case "beltPoints":
      out = (a.beltPoints ?? 0) - (b.beltPoints ?? 0);
      break;
    case "totalPoints":
      out = (a.totalPoints ?? 0) - (b.totalPoints ?? 0);
      break;
  }
  return dir === "asc" ? out : -out;
}

const HEADER_CONFIG: { key: SortColumn | null; label: string; minW: number; align: "left" | "center"; section?: string }[] = [
  { key: "roster", label: "Roster", minW: 52, align: "center", section: "PLAYER" },
  { key: null, label: "", minW: 76, align: "center", section: "PLAYER" },
  { key: "name", label: "Name", minW: 160, align: "left", section: "PLAYER" },
  { key: null, label: "STATUS", minW: 96, align: "center", section: "STATUS" },
  { key: "gender", label: "Gender", minW: 68, align: "center", section: "INFO" },
  { key: "age", label: "Age", minW: 52, align: "center", section: "INFO" },
  { key: "rsPoints", label: "R/S", minW: 72, align: "center", section: "SEASON PTS" },
  { key: "plePoints", label: "PLE", minW: 72, align: "center", section: "SEASON PTS" },
  { key: "beltPoints", label: "Belt", minW: 72, align: "center", section: "SEASON PTS" },
  { key: "totalPoints", label: "TOT", minW: 80, align: "center", section: "FANTASY PTS" },
  { key: null, label: "—", minW: 52, align: "center", section: "FANTASY PTS" },
];

const STICKY_COLUMN_COUNT = 3;
const stickyLefts = [0, 52, 128]; // cumulative: 0, 52, 52+76

const ROW_BG_ALT = "#f8f9fa";
const ROW_BG_MAIN = "#ffffff";
const BORDER_TABLE = "#e0e0e0";
const HEADER_BG = "#f0f2f5";

const thBase = {
  padding: "10px 12px",
  borderBottom: "2px solid " + BORDER_TABLE,
  borderRight: "1px solid " + BORDER_TABLE,
  color: "#1a1a1a",
  background: HEADER_BG,
  fontWeight: 600,
  fontSize: "13px",
} as const;

const SHOW_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "Raw", label: "RAW" },
  { value: "SmackDown", label: "SmackDown" },
  { value: "NXT", label: "NXT" },
  { value: "Other", label: "Other" },
];

export default function WrestlerList({ wrestlers }: { wrestlers: WrestlerRow[] }) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("roster");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [search, setSearch] = useState("");
  const [showFilter, setShowFilter] = useState("all");

  const handleSort = (col: SortColumn) => {
    if (col === sortColumn) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortColumn(col);
      setSortDir("asc");
    }
  };

  const filteredAndSorted = useMemo(() => {
    let list = wrestlers.filter((w) => !isExcludedFromPool(w.brand));
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (w) =>
          (w.name ?? "").toLowerCase().includes(q) ||
          (w.id ?? "").toLowerCase().includes(q)
      );
    }
    if (showFilter !== "all") {
      list = list.filter((w) => normalizeRoster(w.brand) === showFilter);
    }
    list.sort((a, b) => {
      const cmp = compare(a, b, sortColumn, sortDir);
      return cmp !== 0 ? cmp : byName(a, b);
    });
    return list;
  }, [wrestlers, sortColumn, sortDir, search, showFilter]);

  const flatList = filteredAndSorted;
  const poolCount = wrestlers.filter((w) => !isExcludedFromPool(w.brand)).length;

  const tableMinWidth = HEADER_CONFIG.reduce((sum, h) => sum + h.minW, 0);

  return (
    <>
      {/* Toolbar: Filter, Show, Search, Reset */}
      <div className="wrestler-list-toolbar">
        <div className="wrestler-list-filter-row">
          <label htmlFor="wrestler-show">Show</label>
          <select
            id="wrestler-show"
            value={showFilter}
            onChange={(e) => setShowFilter(e.target.value)}
          >
            {SHOW_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <label htmlFor="wrestler-search">Search</label>
          <div className="wrestler-list-search-wrap">
            <span className="wrestler-list-search-icon" aria-hidden>⌕</span>
            <input
              id="wrestler-search"
              type="search"
              placeholder="Wrestler name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search wrestlers by name"
            />
          </div>
        </div>
        <button
          type="button"
          className="wrestler-list-reset"
          onClick={() => {
            setSearch("");
            setShowFilter("all");
          }}
        >
          Reset All
        </button>
      </div>

      {/* Mobile: card list (no truncated headers or rotated text) */}
      <div className="wrestler-list-cards">
        {flatList.length === 0 ? null : flatList.map((w) => {
          const roster = normalizeRoster(w.brand);
          const style = BRAND_STYLES[roster] ?? BRAND_STYLES.Other;
          const age = calculateAge(w.dob);
          return (
            <Link
              key={w.id}
              href={`/wrestlers/${encodeURIComponent(w.id)}`}
              className="wrestler-card"
            >
              <span
                className="wrestler-card-roster"
                style={{ background: style.showBg, color: "#fff" }}
              >
                {style.label}
              </span>
              {w.image_url ? (
                <img
                  src={w.image_url}
                  alt=""
                  className="wrestler-card-img"
                />
              ) : (
                <div className="wrestler-card-img wrestler-card-img-placeholder" aria-hidden>—</div>
              )}
              <div className="wrestler-card-body">
                <span className="wrestler-card-name">{w.name || w.id}</span>
                <span className="wrestler-card-meta">
                  {normalizeGender(w.gender)} · {age != null ? age : "—"} yrs
                  {(typeof w.totalPoints === "number" && w.totalPoints > 0) && (
                    <> · {w.totalPoints} pts</>
                  )}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Desktop: table (hidden on mobile) */}
      <div
        className="wrestler-list-table-wrap"
        style={{
          border: "1px solid " + BORDER_TABLE,
          borderRadius: 8,
          overflow: "hidden",
          background: ROW_BG_MAIN,
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "auto", minWidth: tableMinWidth }}>
          <thead>
            <tr>
              {HEADER_CONFIG.map((h, i) => {
                const isSortable = h.key != null;
                const isActive = sortColumn === h.key;
                const isSticky = i < STICKY_COLUMN_COUNT;
                const style: React.CSSProperties = {
                  ...thBase,
                  minWidth: h.minW,
                  textAlign: h.align,
                  ...(i === HEADER_CONFIG.length - 1 && !isSticky ? { borderRight: "none" } : {}),
                  ...(isSticky
                    ? {
                        position: "sticky" as const,
                        left: stickyLefts[i],
                        zIndex: 2,
                        background: HEADER_BG,
                        boxShadow: i === STICKY_COLUMN_COUNT - 1 ? "4px 0 8px rgba(0,0,0,0.08)" : undefined,
                      }
                    : {}),
                };
                if (!isSortable) {
                  return <th key={i} style={style}>{h.label}</th>;
                }
                return (
                  <th key={i} style={style}>
                    <button
                      type="button"
                      onClick={() => handleSort(h.key as SortColumn)}
                      style={{
                        width: "100%",
                        padding: 0,
                        border: "none",
                        background: "none",
                        color: isActive ? "var(--color-blue)" : "inherit",
                        font: "inherit",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: h.align === "center" ? "center" : "flex-start",
                        gap: 4,
                      }}
                    >
                      <span>{h.label}</span>
                      {isActive && (
                        <span style={{ opacity: 0.9 }} aria-hidden>
                          {sortDir === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {flatList.map((w, rowIndex) => {
              const roster = normalizeRoster(w.brand);
              const style = BRAND_STYLES[roster] ?? BRAND_STYLES.Other;
              const age = calculateAge(w.dob);
              const rowBg = rowIndex % 2 === 0 ? ROW_BG_MAIN : ROW_BG_ALT;
              const cellBorder = "1px solid " + BORDER_TABLE;
              const cellStyle = { borderBottom: cellBorder, borderRight: cellBorder, color: "#1a1a1a", background: rowBg };
              return (
                <tr key={w.id}>
                  <td
                    style={{
                      minWidth: 52,
                      padding: 0,
                      verticalAlign: "middle",
                      textAlign: "center",
                      borderBottom: cellBorder,
                      borderRight: cellBorder,
                      background: style.showBg,
                      position: "sticky",
                      left: 0,
                      zIndex: 1,
                      boxShadow: "4px 0 8px rgba(0,0,0,0.06)",
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
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: 0.5,
                        color: "#fff",
                      }}
                    >
                      {style.label}
                    </div>
                  </td>
                  <td
                    style={{
                      minWidth: 76,
                      padding: 6,
                      ...cellStyle,
                      position: "sticky",
                      left: 52,
                      zIndex: 1,
                      boxShadow: "4px 0 8px rgba(0,0,0,0.06)",
                    }}
                  >
                    {w.image_url ? (
                      <img
                        src={w.image_url}
                        alt={w.name || w.id}
                        style={{
                          width: 60,
                          height: 60,
                          objectFit: "cover",
                          borderRadius: "50%",
                          display: "block",
                          background: BORDER_TABLE,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 60,
                          height: 60,
                          borderRadius: "50%",
                          background: ROW_BG_ALT,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#999",
                          fontSize: 20,
                        }}
                        aria-hidden
                      >
                        —
                      </div>
                    )}
                  </td>
                  <td
                    style={{
                      minWidth: 160,
                      padding: "10px 12px",
                      fontWeight: 600,
                      position: "sticky",
                      left: 128,
                      zIndex: 1,
                      boxShadow: "4px 0 8px rgba(0,0,0,0.06)",
                      ...cellStyle,
                    }}
                  >
                    <Link
                      href={`/wrestlers/${encodeURIComponent(w.id)}`}
                      style={{ color: "var(--color-blue)", textDecoration: "none" }}
                    >
                      {w.name || w.id}
                    </Link>
                    {w.personaDisplay && (
                      <div style={{ fontSize: 11, fontWeight: 400, color: "var(--color-text-muted)", fontStyle: "italic", marginTop: 2 }}>
                        {w.personaDisplay}
                      </div>
                    )}
                  </td>
                  <td style={{ minWidth: 96, padding: "8px", textAlign: "center", ...cellStyle }}>
                    <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: "var(--color-text-muted)" }}>FA</div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <Link
                        href={`/wrestlers/${encodeURIComponent(w.id)}`}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          background: "var(--color-blue)",
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          textDecoration: "none",
                          fontWeight: 700,
                          fontSize: 18,
                          lineHeight: 1,
                        }}
                        title="View / Add wrestler"
                        aria-label={`View ${w.name || w.id}`}
                      >
                        +
                      </Link>
                      <button
                        type="button"
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          background: "transparent",
                          border: "1px solid " + BORDER_TABLE,
                          color: "var(--color-text)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 14,
                        }}
                        title="Add to watch list"
                        aria-label="Add to watch list"
                      >
                        ⚑
                      </button>
                    </div>
                  </td>
                  <td style={{ minWidth: 68, padding: "10px 8px", textAlign: "center", ...cellStyle }}>
                    {normalizeGender(w.gender)}
                  </td>
                  <td style={{ minWidth: 52, padding: "10px 8px", textAlign: "center", ...cellStyle }}>
                    {age != null ? age : "—"}
                  </td>
                  <td style={{ minWidth: 72, padding: "10px 8px", textAlign: "center", fontWeight: 600, ...cellStyle }}>
                    {typeof w.rsPoints === "number" ? w.rsPoints : "—"}
                  </td>
                  <td style={{ minWidth: 72, padding: "10px 8px", textAlign: "center", fontWeight: 600, ...cellStyle }}>
                    {typeof w.plePoints === "number" ? w.plePoints : "—"}
                  </td>
                  <td style={{ minWidth: 72, padding: "10px 8px", textAlign: "center", fontWeight: 600, ...cellStyle }}>
                    {typeof w.beltPoints === "number" ? w.beltPoints : "—"}
                  </td>
                  <td style={{ minWidth: 80, padding: "10px 8px", textAlign: "center", fontWeight: 700, ...cellStyle }}>
                    {typeof w.totalPoints === "number" ? w.totalPoints : "—"}
                  </td>
                  <td style={{ minWidth: 52, padding: "10px 8px", textAlign: "center", ...cellStyle, borderRight: "none" }}>
                    —
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {flatList.length === 0 && (
        <p style={{ marginTop: 16, color: "var(--color-text-muted)", textAlign: "center" }}>
          No wrestlers match your filters. Try a different search or show filter, or Reset All.
        </p>
      )}

      <p className="wrestler-list-footer" style={{ marginTop: 24, color: "#666" }}>
        {search || showFilter !== "all" ? (
          <>Showing {flatList.length} of {poolCount} wrestlers.</>
        ) : (
          <>Total: {poolCount} wrestlers.</>
        )}{" "}
        Use this pool when building your draft. Images from Pro Wrestling Boxscore (Supabase).
      </p>
    </>
  );
}
