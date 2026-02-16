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
  SmackDown: { bg: "#0A2463", showBg: "#071A4A", label: "SMACKDOWN" },
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

const HEADER_CONFIG: { key: SortColumn | null; label: string; width?: string | number; align: "left" | "center" }[] = [
  { key: "roster", label: "Roster", width: 44, align: "center" },
  { key: null, label: "", width: 72, align: "center" },
  { key: "name", label: "Name", align: "left" },
  { key: "gender", label: "Gender", width: 56, align: "center" },
  { key: "age", label: "Age", width: 56, align: "center" },
  { key: "rsPoints", label: "R/S Points", width: 72, align: "center" },
  { key: "plePoints", label: "PLE Points", width: 72, align: "center" },
  { key: "beltPoints", label: "Belt Points", width: 72, align: "center" },
  { key: "totalPoints", label: "Total Points", width: 80, align: "center" },
  { key: null, label: "Rating", width: 64, align: "center" },
];

const thBase = {
  padding: "10px 8px",
  borderBottom: "2px solid #444",
  borderRight: "1px solid #333",
  color: "#fff",
} as const;

export default function WrestlerList({ wrestlers }: { wrestlers: WrestlerRow[] }) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("roster");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (col: SortColumn) => {
    if (col === sortColumn) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortColumn(col);
      setSortDir("asc");
    }
  };

  const flatList = useMemo(() => {
    const list = [...wrestlers];
    list.sort((a, b) => {
      const cmp = compare(a, b, sortColumn, sortDir);
      return cmp !== 0 ? cmp : byName(a, b);
    });
    return list;
  }, [wrestlers, sortColumn, sortDir]);

  return (
    <>
      <div
        style={{
          border: "1px solid #333",
          borderRadius: 8,
          overflow: "hidden",
          background: "#111",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <thead>
            <tr style={{ background: "#1a1a1a", color: "#fff" }}>
              {HEADER_CONFIG.map((h, i) => {
                const isSortable = h.key != null;
                const isActive = sortColumn === h.key;
                const style = {
                  ...thBase,
                  width: h.width ?? undefined,
                  minWidth: h.width ?? undefined,
                  textAlign: h.align,
                  ...(h.align === "left" ? { paddingLeft: 12, paddingRight: 12 } : {}),
                  ...(i === HEADER_CONFIG.length - 1 ? { borderRight: "none" } : {}),
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
                        color: "inherit",
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
            {flatList.map((w) => {
              const roster = normalizeRoster(w.brand);
              const style = BRAND_STYLES[roster] ?? BRAND_STYLES.Other;
              const age = calculateAge(w.dob);
              return (
                <tr key={w.id} style={{ background: style.bg }}>
                  <td
                    style={{
                      width: 44,
                      padding: 0,
                      verticalAlign: "middle",
                      borderBottom: "1px solid rgba(255,255,255,0.15)",
                      borderRight: "1px solid rgba(255,255,255,0.15)",
                      background: style.showBg,
                    }}
                  >
                    <div
                      style={{
                        writingMode: "vertical-rl",
                        textOrientation: "mixed",
                        transform: "rotate(-180deg)",
                        height: 72,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: 1,
                        color: "#fff",
                      }}
                    >
                      {style.label}
                    </div>
                  </td>
                  <td
                    style={{
                      width: 72,
                      padding: 6,
                      borderBottom: "1px solid rgba(255,255,255,0.15)",
                      borderRight: "1px solid rgba(255,255,255,0.15)",
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
                          background: "#333",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 60,
                          height: 60,
                          borderRadius: "50%",
                          background: "rgba(255,255,255,0.15)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "rgba(255,255,255,0.6)",
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
                      padding: "10px 12px",
                      borderBottom: "1px solid rgba(255,255,255,0.15)",
                      borderRight: "1px solid rgba(255,255,255,0.15)",
                      color: "#fff",
                      fontWeight: 600,
                    }}
                  >
                    <Link
                      href={`/wrestlers/${encodeURIComponent(w.id)}`}
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      {w.name || w.id}
                    </Link>
                    {w.personaDisplay && (
                      <div style={{ fontSize: 11, fontWeight: 400, color: "rgba(255,255,255,0.8)", fontStyle: "italic", marginTop: 2 }}>
                        {w.personaDisplay}
                      </div>
                    )}
                  </td>
                  <td
                    style={{
                      width: 56,
                      padding: "10px 8px",
                      textAlign: "center",
                      borderBottom: "1px solid rgba(255,255,255,0.15)",
                      borderRight: "1px solid rgba(255,255,255,0.15)",
                      color: "#fff",
                    }}
                  >
                    {normalizeGender(w.gender)}
                  </td>
                  <td
                    style={{
                      width: 56,
                      padding: "10px 8px",
                      textAlign: "center",
                      borderBottom: "1px solid rgba(255,255,255,0.15)",
                      borderRight: "1px solid rgba(255,255,255,0.15)",
                      color: "#fff",
                    }}
                  >
                    {age != null ? age : "—"}
                  </td>
                  <td
                    style={{
                      width: 72,
                      padding: "10px 8px",
                      textAlign: "center",
                      borderBottom: "1px solid rgba(255,255,255,0.15)",
                      borderRight: "1px solid rgba(255,255,255,0.15)",
                      color: "#fff",
                      fontWeight: 600,
                    }}
                  >
                    {typeof w.rsPoints === "number" ? w.rsPoints : "—"}
                  </td>
                  <td
                    style={{
                      width: 72,
                      padding: "10px 8px",
                      textAlign: "center",
                      borderBottom: "1px solid rgba(255,255,255,0.15)",
                      borderRight: "1px solid rgba(255,255,255,0.15)",
                      color: "#fff",
                      fontWeight: 600,
                    }}
                  >
                    {typeof w.plePoints === "number" ? w.plePoints : "—"}
                  </td>
                  <td
                    style={{
                      width: 72,
                      padding: "10px 8px",
                      textAlign: "center",
                      borderBottom: "1px solid rgba(255,255,255,0.15)",
                      borderRight: "1px solid rgba(255,255,255,0.15)",
                      color: "#fff",
                      fontWeight: 600,
                    }}
                  >
                    {typeof w.beltPoints === "number" ? w.beltPoints : "—"}
                  </td>
                  <td
                    style={{
                      width: 80,
                      padding: "10px 8px",
                      textAlign: "center",
                      borderBottom: "1px solid rgba(255,255,255,0.15)",
                      borderRight: "1px solid rgba(255,255,255,0.15)",
                      color: "#fff",
                      fontWeight: 700,
                    }}
                  >
                    {typeof w.totalPoints === "number" ? w.totalPoints : "—"}
                  </td>
                  <td
                    style={{
                      width: 64,
                      padding: "10px 8px",
                      textAlign: "center",
                      borderBottom: "1px solid rgba(255,255,255,0.15)",
                      color: "#fff",
                      fontSize: 18,
                      fontWeight: 700,
                    }}
                  >
                    —
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 24, color: "#666" }}>
        Total: {wrestlers.length} wrestlers. Use this pool when building your draft. Images from Pro Wrestling Boxscore (Supabase).
      </p>
    </>
  );
}
