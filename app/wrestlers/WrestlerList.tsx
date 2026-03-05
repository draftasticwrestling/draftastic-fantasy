"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";

export type WrestlerRow = {
  id: string;
  name: string | null;
  gender: string | null;
  brand: string | null;
  image_url?: string | null;
  dob?: string | null;
  /** 2K26 rating if available, else 2K25 (from Pro Wrestling Boxscore). */
  rating_2k26?: number | null;
  rating_2k25?: number | null;
  rsPoints?: number;
  plePoints?: number;
  beltPoints?: number;
  totalPoints?: number;
  /** Points for 2025 only (when points period filter is used). */
  rsPoints2025?: number;
  plePoints2025?: number;
  beltPoints2025?: number;
  totalPoints2025?: number;
  /** Points for 2026 only (when points period filter is used). */
  rsPoints2026?: number;
  plePoints2026?: number;
  beltPoints2026?: number;
  totalPoints2026?: number;
  /** Points across all completed events (when points period filter is used). */
  rsPointsAllTime?: number;
  plePointsAllTime?: number;
  beltPointsAllTime?: number;
  totalPointsAllTime?: number;
  /** Match stats (period-specific when period filter used). */
  mw?: number;
  win?: number;
  loss?: number;
  nc?: number;
  dqw?: number;
  dql?: number;
  mw2025?: number;
  win2025?: number;
  loss2025?: number;
  nc2025?: number;
  dqw2025?: number;
  dql2025?: number;
  mw2026?: number;
  win2026?: number;
  loss2026?: number;
  nc2026?: number;
  dqw2026?: number;
  dql2026?: number;
  mwAllTime?: number;
  winAllTime?: number;
  lossAllTime?: number;
  ncAllTime?: number;
  dqwAllTime?: number;
  dqlAllTime?: number;
  /** Alter-ego persona text, e.g. "Also: El Grande Americano (from Jun 2025)" */
  personaDisplay?: string | null;
  /** Status from API (e.g. Injured, INJ). Used to show injury badge. */
  status?: string | null;
  /** Current championship(s) held, e.g. "WWE Championship" or "Raw Tag Team, US Championship". Shown under name. */
  currentChampionship?: string | null;
};

/** True when status indicates injured (Injured, INJ, etc.). */
function isInjured(status: string | null | undefined): boolean {
  if (status == null || status === "") return false;
  const s = String(status).trim().toLowerCase();
  return s === "injured" || s === "inj";
}

export type PointsPeriod = "sinceStart" | "2025" | "2026" | "allTime";

/** Roster categories used for filter checkboxes. Order matches display. */
const ROSTER_CATEGORIES = [
  { value: "Raw", label: "Raw" },
  { value: "SmackDown", label: "SmackDown" },
  { value: "NXT", label: "NXT" },
  { value: "Front Office", label: "Front Office" },
  { value: "Celebrity Guests", label: "Celebrity Guests" },
  { value: "Alumni", label: "Alumni" },
  { value: "Unassigned", label: "Unassigned" },
  { value: "Other", label: "Other" },
] as const;

const ROSTER_ORDER = [
  "Raw",
  "SmackDown",
  "NXT",
  "Front Office",
  "Celebrity Guests",
  "Alumni",
  "Unassigned",
  "Other",
] as const;

const BRAND_STYLES: Record<string, { bg: string; showBg: string; label: string }> = {
  Raw: { bg: "#8B1538", showBg: "#6B0F2A", label: "RAW" },
  SmackDown: { bg: "#0A2463", showBg: "#071A4A", label: "SD" },
  NXT: { bg: "#2C2C2C", showBg: "#1a1a1a", label: "NXT" },
  "Front Office": { bg: "#4a4a4a", showBg: "#3a3a3a", label: "FRONT OFFICE" },
  "Celebrity Guests": { bg: "#3d3d3d", showBg: "#2d2d2d", label: "CELEBRITY" },
  Alumni: { bg: "#3d3d3d", showBg: "#2d2d2d", label: "ALUMNI" },
  Unassigned: { bg: "#5c5c5c", showBg: "#4c4c4c", label: "UNASSIGNED" },
  Other: { bg: "#3d3d3d", showBg: "#2d2d2d", label: "OTHER" },
};

/** Map raw brand string to a filter category. */
function normalizeRoster(brand: string | null): string {
  if (!brand || !brand.trim()) return "Unassigned";
  const lower = brand.trim().toLowerCase();
  if (lower === "raw") return "Raw";
  if (lower === "smackdown" || lower === "smack down") return "SmackDown";
  if (lower === "nxt" || lower.includes("nxt")) return "NXT";
  if (lower === "celebrity guests" || lower === "celebrity" || lower === "celebrity guest") return "Celebrity Guests";
  if (lower === "alumni") return "Alumni";
  if (lower === "managers" || lower === "manager") return "Front Office";
  if (lower === "gm" || lower === "gms") return "Front Office";
  if (lower === "head of creative") return "Front Office";
  if (lower === "announcers" || lower === "announcer") return "Front Office";
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

/** Get effective point values for display/sort based on selected period. */
function getPointsForPeriod(w: WrestlerRow, period: PointsPeriod) {
  if (period === "2025") {
    return {
      rsPoints: w.rsPoints2025 ?? 0,
      plePoints: w.plePoints2025 ?? 0,
      beltPoints: w.beltPoints2025 ?? 0,
      totalPoints: w.totalPoints2025 ?? 0,
    };
  }
  if (period === "2026") {
    return {
      rsPoints: w.rsPoints2026 ?? 0,
      plePoints: w.plePoints2026 ?? 0,
      beltPoints: w.beltPoints2026 ?? 0,
      totalPoints: w.totalPoints2026 ?? 0,
    };
  }
  if (period === "allTime") {
    return {
      rsPoints: w.rsPointsAllTime ?? 0,
      plePoints: w.plePointsAllTime ?? 0,
      beltPoints: w.beltPointsAllTime ?? 0,
      totalPoints: w.totalPointsAllTime ?? 0,
    };
  }
  return {
    rsPoints: w.rsPoints ?? 0,
    plePoints: w.plePoints ?? 0,
    beltPoints: w.beltPoints ?? 0,
    totalPoints: w.totalPoints ?? 0,
  };
}

/** Get effective match stats for display/sort based on selected period. */
function getMatchStatsForPeriod(w: WrestlerRow, period: PointsPeriod) {
  if (period === "2025") {
    return { mw: w.mw2025 ?? 0, win: w.win2025 ?? 0, loss: w.loss2025 ?? 0, nc: w.nc2025 ?? 0, dqw: w.dqw2025 ?? 0, dql: w.dql2025 ?? 0 };
  }
  if (period === "2026") {
    return { mw: w.mw2026 ?? 0, win: w.win2026 ?? 0, loss: w.loss2026 ?? 0, nc: w.nc2026 ?? 0, dqw: w.dqw2026 ?? 0, dql: w.dql2026 ?? 0 };
  }
  if (period === "allTime") {
    return { mw: w.mwAllTime ?? 0, win: w.winAllTime ?? 0, loss: w.lossAllTime ?? 0, nc: w.ncAllTime ?? 0, dqw: w.dqwAllTime ?? 0, dql: w.dqlAllTime ?? 0 };
  }
  return { mw: w.mw ?? 0, win: w.win ?? 0, loss: w.loss ?? 0, nc: w.nc ?? 0, dqw: w.dqw ?? 0, dql: w.dql ?? 0 };
}

export type SortColumn =
  | "roster"
  | "rank"
  | "name"
  | "gender"
  | "age"
  | "rating2k"
  | "rsPoints"
  | "plePoints"
  | "beltPoints"
  | "totalPoints"
  | "ppm"
  | "mw"
  | "win"
  | "winPct"
  | "loss"
  | "lossPct"
  | "nc"
  | "dqw"
  | "dql"
  | "dqPct";
type SortDir = "asc" | "desc";

function compare(a: WrestlerRow, b: WrestlerRow, col: SortColumn, dir: SortDir, period: PointsPeriod = "sinceStart"): number {
  const pa = getPointsForPeriod(a, period);
  const pb = getPointsForPeriod(b, period);
  const ma = getMatchStatsForPeriod(a, period);
  const mb = getMatchStatsForPeriod(b, period);
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
    case "rank":
      out = pa.totalPoints - pb.totalPoints;
      break;
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
    case "rating2k": {
      const ra = a.rating_2k26 ?? a.rating_2k25 ?? -1;
      const rb = b.rating_2k26 ?? b.rating_2k25 ?? -1;
      out = ra - rb;
      break;
    }
    case "rsPoints":
      out = pa.rsPoints - pb.rsPoints;
      break;
    case "plePoints":
      out = pa.plePoints - pb.plePoints;
      break;
    case "beltPoints":
      out = pa.beltPoints - pb.beltPoints;
      break;
    case "totalPoints":
      out = pa.totalPoints - pb.totalPoints;
      break;
    case "ppm": {
      const ppmA = ma.mw > 0 ? (pa.rsPoints + pa.plePoints) / ma.mw : 0;
      const ppmB = mb.mw > 0 ? (pb.rsPoints + pb.plePoints) / mb.mw : 0;
      out = ppmA - ppmB;
      break;
    }
    case "mw":
      out = ma.mw - mb.mw;
      break;
    case "win":
      out = ma.win - mb.win;
      break;
    case "winPct": {
      const wa = ma.mw > 0 ? (ma.win / ma.mw) * 100 : 0;
      const wb = mb.mw > 0 ? (mb.win / mb.mw) * 100 : 0;
      out = wa - wb;
      break;
    }
    case "loss":
      out = ma.loss - mb.loss;
      break;
    case "lossPct": {
      const la = ma.mw > 0 ? (ma.loss / ma.mw) * 100 : 0;
      const lb = mb.mw > 0 ? (mb.loss / mb.mw) * 100 : 0;
      out = la - lb;
      break;
    }
    case "nc":
      out = ma.nc - mb.nc;
      break;
    case "dqw":
      out = ma.dqw - mb.dqw;
      break;
    case "dql":
      out = ma.dql - mb.dql;
      break;
    case "dqPct": {
      const dqa = ma.mw > 0 ? ((ma.dqw + ma.dql) / ma.mw) * 100 : 0;
      const dqb = mb.mw > 0 ? ((mb.dqw + mb.dql) / mb.mw) * 100 : 0;
      out = dqa - dqb;
      break;
    }
  }
  return dir === "asc" ? out : -out;
}

const HEADER_CONFIG: { key: SortColumn | null; label: string; minW: number; align: "left" | "center"; section?: string }[] = [
  { key: "roster", label: "Roster", minW: 52, align: "center", section: "PLAYER" },
  { key: "rank", label: "Rank", minW: 48, align: "center", section: "PLAYER" },
  { key: null, label: "", minW: 76, align: "center", section: "PLAYER" },
  { key: "name", label: "Name", minW: 160, align: "left", section: "PLAYER" },
  { key: null, label: "STATUS", minW: 96, align: "center", section: "STATUS" },
  { key: "gender", label: "Gender", minW: 68, align: "center", section: "INFO" },
  { key: "age", label: "Age", minW: 52, align: "center", section: "INFO" },
  { key: "rating2k", label: "2K", minW: 48, align: "center", section: "INFO" },
  { key: "rsPoints", label: "R/S", minW: 72, align: "center", section: "POINTS" },
  { key: "plePoints", label: "PLE", minW: 72, align: "center", section: "POINTS" },
  { key: "beltPoints", label: "Belt", minW: 72, align: "center", section: "POINTS" },
  { key: "totalPoints", label: "TOT", minW: 80, align: "center", section: "POINTS" },
  { key: "ppm", label: "PPM", minW: 56, align: "center", section: "POINTS" },
  { key: "mw", label: "MW", minW: 56, align: "center", section: "MATCHES" },
  { key: "win", label: "Win", minW: 56, align: "center", section: "MATCHES" },
  { key: "winPct", label: "W%", minW: 52, align: "center", section: "MATCHES" },
  { key: "loss", label: "Loss", minW: 56, align: "center", section: "MATCHES" },
  { key: "lossPct", label: "L%", minW: 52, align: "center", section: "MATCHES" },
  { key: "nc", label: "NC", minW: 56, align: "center", section: "MATCHES" },
  { key: "dqw", label: "DQW", minW: 56, align: "center", section: "MATCHES" },
  { key: "dql", label: "DQL", minW: 56, align: "center", section: "MATCHES" },
  { key: "dqPct", label: "DQ%", minW: 52, align: "center", section: "MATCHES" },
];

const STICKY_COLUMN_COUNT = 5; // Roster, Rank, Image, Name, Status
const STICKY_WIDTHS = [52, 48, 76, 160, 96] as const; // fixed widths so columns don't resize on scroll
const stickyLefts = [0, 52, 100, 176, 336]; // cumulative

const ROW_BG_ALT = "#f8f9fa";
const ROW_BG_MAIN = "#ffffff";

/** Medical plus (injury badge) — equal horizontal and vertical bars, not a Latin cross. */
function InjuryBadge({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <span
      className={className}
      role="img"
      aria-label="Injured"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "50%",
        background: "#fff",
        flexShrink: 0,
      }}
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 12 12" fill="none" stroke="#c00" strokeWidth="1.8" strokeLinecap="butt" aria-hidden>
        <path d="M6 2v8M2 6h8" />
      </svg>
    </span>
  );
}

/** Yellow caution triangle with exclamation — matches needing review. */
function CautionBadge({ size = 18, title = "Matches needing review" }: { size?: number; title?: string }) {
  return (
    <span
      role="img"
      aria-label={title}
      title={title}
      style={{ display: "inline-flex", flexShrink: 0, verticalAlign: "middle", lineHeight: 1 }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 2L2 22h20L12 2z"
          fill="#facc15"
          stroke="#1c1917"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M12 9v5M12 17v1.5" stroke="#1c1917" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </span>
  );
}
const BORDER_TABLE = "#e0e0e0";
const HEADER_BG = "#f0f2f5";
/** Bolder border around Points and Matches sections. */
const SECTION_BORDER = "2px solid #999";

const thBase = {
  padding: "10px 12px",
  borderBottom: "2px solid " + BORDER_TABLE,
  borderRight: "1px solid " + BORDER_TABLE,
  color: "#1a1a1a",
  background: HEADER_BG,
  fontWeight: 600,
  fontSize: "13px",
} as const;

const ALL_ROSTER_VALUES = ROSTER_CATEGORIES.map((c) => c.value);

const POINTS_PERIOD_OPTIONS: { value: PointsPeriod; label: string }[] = [
  { value: "sinceStart", label: "Since League Start" },
  { value: "2025", label: "2025" },
  { value: "2026", label: "2026" },
  { value: "allTime", label: "All-time" },
];

/** When provided, Status column shows owner name + propose-trade for rostered wrestlers. */
export type RosterOwnerInfo = { ownerName: string; ownerUserId: string };

type WrestlerListProps = {
  wrestlers: WrestlerRow[];
  /** Default sort column (e.g. "totalPoints" for League Leaders view). */
  defaultSortColumn?: SortColumn;
  /** Default sort direction. */
  defaultSortDir?: SortDir;
  /** Default points period when the period filter is shown (e.g. "allTime" for League Leaders / Free Agents). */
  defaultPointsPeriod?: PointsPeriod;
  /** League slug for "propose trade" links (e.g. League Leaders in a league context). */
  leagueSlug?: string | null;
  /** When set with leagueSlug, profile links include from= so back nav returns here (e.g. "league-leaders", "free-agents"). */
  wrestlerProfileFrom?: "league-leaders" | "free-agents" | null;
  /** Wrestler id -> owner info. When set, Status shows owner name + propose trade for rostered; else FA + add/flag. */
  rosterByWrestler?: Record<string, RosterOwnerInfo> | null;
};

function wrestlerProfileHref(wrestlerId: string, leagueSlug?: string | null, from?: "league-leaders" | "free-agents" | null): string {
  const base = `/wrestlers/${encodeURIComponent(wrestlerId)}`;
  if (!leagueSlug) return base;
  const params = new URLSearchParams({ league: leagueSlug });
  if (from) params.set("from", from);
  return `${base}?${params.toString()}`;
}

export default function WrestlerList({
  wrestlers,
  defaultSortColumn = "roster",
  defaultSortDir = "asc",
  defaultPointsPeriod,
  leagueSlug,
  wrestlerProfileFrom,
  rosterByWrestler,
  wrestlerSlugsWithUnparsed,
}: WrestlerListProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>(defaultSortColumn);
  const [sortDir, setSortDir] = useState<SortDir>(defaultSortDir);
  const [search, setSearch] = useState("");
  const [includedRosters, setIncludedRosters] = useState<Set<string>>(
    () => new Set(["Raw", "SmackDown"])
  );
  const [pointsPeriod, setPointsPeriod] = useState<PointsPeriod>(
    defaultPointsPeriod ?? "sinceStart"
  );
  const hasPointsPeriodFilter =
    wrestlers.length > 0 &&
    ("totalPoints2025" in wrestlers[0] || "totalPointsAllTime" in wrestlers[0]);

  const handleSort = (col: SortColumn) => {
    if (col === sortColumn) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortColumn(col);
      setSortDir("asc");
    }
  };

  const toggleRoster = (value: string) => {
    setIncludedRosters((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const selectAllRosters = () => setIncludedRosters(new Set(ALL_ROSTER_VALUES));
  const clearAllRosters = () => setIncludedRosters(new Set());

  const filteredAndSorted = useMemo(() => {
    let list = wrestlers.filter((w) => includedRosters.has(normalizeRoster(w.brand)));
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (w) =>
          (w.name ?? "").toLowerCase().includes(q) ||
          (w.id ?? "").toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const cmp = compare(a, b, sortColumn, sortDir, pointsPeriod);
      return cmp !== 0 ? cmp : byName(a, b);
    });
    return list;
  }, [wrestlers, sortColumn, sortDir, search, includedRosters, pointsPeriod]);

  /** Rank by total points (selected period) among filtered wrestlers; 1 = highest. */
  const rankByWrestlerId = useMemo(() => {
    let list = wrestlers.filter((w) => includedRosters.has(normalizeRoster(w.brand)));
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (w) =>
          (w.name ?? "").toLowerCase().includes(q) ||
          (w.id ?? "").toLowerCase().includes(q)
      );
    }
    const sorted = [...list].sort(
      (a, b) => compare(a, b, "totalPoints", "desc", pointsPeriod) || byName(a, b)
    );
    const map = new Map<string, number>();
    sorted.forEach((w, i) => map.set(w.id, i + 1));
    return map;
  }, [wrestlers, includedRosters, search, pointsPeriod]);

  const flatList = filteredAndSorted;
  const totalCount = wrestlers.length;

  const tableMinWidth = HEADER_CONFIG.reduce((sum, h) => sum + h.minW, 0);

  return (
    <>
      {/* Toolbar: Roster checkboxes, Search, Reset */}
      <div className="wrestler-list-toolbar">
        <div className="wrestler-list-roster-filters">
          <span className="wrestler-list-roster-label">Include:</span>
          <div className="wrestler-list-roster-checkboxes" role="group" aria-label="Filter by roster">
            {ROSTER_CATEGORIES.map(({ value, label }) => (
              <label key={value} className="wrestler-list-roster-check">
                <input
                  type="checkbox"
                  checked={includedRosters.has(value)}
                  onChange={() => toggleRoster(value)}
                  aria-label={`Include ${label}`}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <div className="wrestler-list-roster-actions">
            <button type="button" className="wrestler-list-reset" onClick={selectAllRosters}>
              All
            </button>
            <button type="button" className="wrestler-list-reset" onClick={clearAllRosters}>
              None
            </button>
          </div>
        </div>
        {hasPointsPeriodFilter && (
          <div className="wrestler-list-filter-row">
            <label htmlFor="wrestler-points-period">Period</label>
            <select
              id="wrestler-points-period"
              value={pointsPeriod}
              onChange={(e) => setPointsPeriod(e.target.value as PointsPeriod)}
              aria-label="Points period"
            >
              {POINTS_PERIOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="wrestler-list-filter-row">
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
            selectAllRosters();
          }}
        >
          Reset filters
        </button>
      </div>

      {/* Mobile: card list (no truncated headers or rotated text) */}
      <div className="wrestler-list-cards">
        {flatList.length === 0 ? null : flatList.map((w) => {
          const roster = normalizeRoster(w.brand);
          const style = BRAND_STYLES[roster] ?? BRAND_STYLES.Other;
          const age = calculateAge(w.dob);
          const pts = getPointsForPeriod(w, pointsPeriod);
          return (
            <Link
              key={w.id}
              href={wrestlerProfileHref(w.id, leagueSlug, wrestlerProfileFrom ?? undefined)}
              className="wrestler-card"
            >
              <span
                className="wrestler-card-roster"
                style={{ background: style.showBg, color: "#fff" }}
              >
                {style.label}
              </span>
              <div className="wrestler-card-img-wrap">
                {w.image_url ? (
                  <img
                    src={w.image_url}
                    alt=""
                    className="wrestler-card-img"
                  />
                ) : (
                  <div className="wrestler-card-img wrestler-card-img-placeholder" aria-hidden>—</div>
                )}
                {isInjured(w.status) && (
                  <span className="wrestler-card-injury-badge" title="Injured">
                    <InjuryBadge size={22} />
                  </span>
                )}
              </div>
              <div className="wrestler-card-body">
                <span className="wrestler-card-name" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {w.name || w.id}
                  {wrestlerSlugsWithUnparsed?.length && (wrestlerSlugsWithUnparsed.includes(normalizeWrestlerName(w.id)) || wrestlerSlugsWithUnparsed.includes(w.id)) && (
                    <CautionBadge size={16} />
                  )}
                  {isInjured(w.status) && (
                    <span className="wrestler-card-inj" aria-label="Injured"> INJ</span>
                  )}
                </span>
                {w.currentChampionship && (
                  <span className="wrestler-card-meta" style={{ display: "block", marginTop: 2, fontWeight: 500, color: "#b8860b" }}>
                    {w.currentChampionship}
                  </span>
                )}
                <span className="wrestler-card-meta">
                  {rankByWrestlerId.get(w.id) != null && (
                    <>Rank {rankByWrestlerId.get(w.id)} · </>
                  )}
                  {normalizeGender(w.gender)} · {age != null ? age : "—"} yrs
                  {(w.rating_2k26 != null || w.rating_2k25 != null) && (
                    <> · 2K {(w.rating_2k26 ?? w.rating_2k25) ?? ""}</>
                  )}
                  {pts.totalPoints > 0 && (
                    <> · {pts.totalPoints} pts</>
                  )}
                </span>
                <span className="wrestler-card-pts">
                  R/S {pts.rsPoints} · PLE {pts.plePoints} · Belt {pts.beltPoints}
                  {pts.totalPoints > 0 && (
                    <> → {pts.totalPoints}</>
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
              {HEADER_CONFIG.slice(0, 8).map((h, i) => {
                const fixedW = i < STICKY_COLUMN_COUNT ? STICKY_WIDTHS[i] : undefined;
                return (
                  <th
                    key={`gh-${i}`}
                    style={{
                      ...thBase,
                      minWidth: h.minW,
                      ...(fixedW != null ? { width: fixedW, maxWidth: fixedW, boxSizing: "border-box" } : {}),
                      borderBottom: "1px solid " + BORDER_TABLE,
                    }}
                  />
                );
              })}
              <th
                colSpan={5}
                style={{
                  ...thBase,
                  minWidth: 72 * 3 + 80 + 56,
                  textAlign: "center",
                  borderBottom: "1px solid " + BORDER_TABLE,
                  borderLeft: SECTION_BORDER,
                  borderRight: SECTION_BORDER,
                }}
              >
                Points
              </th>
              <th
                colSpan={9}
                style={{
                  ...thBase,
                  minWidth: 56 * 6 + 52 * 3,
                  textAlign: "center",
                  borderLeft: SECTION_BORDER,
                  borderRight: SECTION_BORDER,
                  borderBottom: "1px solid " + BORDER_TABLE,
                }}
              >
                Matches
              </th>
            </tr>
            <tr>
              {HEADER_CONFIG.map((h, i) => {
                const isSortable = h.key != null;
                const isActive = sortColumn === h.key;
                const isSticky = i < STICKY_COLUMN_COUNT;
                const fixedW = isSticky ? STICKY_WIDTHS[i] : undefined;
                const style: React.CSSProperties = {
                  ...thBase,
                  minWidth: h.minW,
                  ...(fixedW != null ? { width: fixedW, maxWidth: fixedW, boxSizing: "border-box" } : {}),
                  textAlign: h.align,
                  ...(i === HEADER_CONFIG.length - 1 && !isSticky ? { borderRight: "none" } : {}),
                  ...(isSticky
                    ? {
                        position: "sticky" as const,
                        left: stickyLefts[i],
                        zIndex: 2,
                        background: HEADER_BG,
                        ...(i === STICKY_COLUMN_COUNT - 1 ? { borderRight: "1px solid " + HEADER_BG } : {}),
                        boxShadow: i === STICKY_COLUMN_COUNT - 1 ? "4px 0 8px rgba(0,0,0,0.08)" : undefined,
                      }
                    : {}),
                  ...(h.section === "POINTS" && i === 8 ? { borderLeft: SECTION_BORDER } : {}),
                  ...(h.section === "POINTS" && i === 12 ? { borderRight: SECTION_BORDER } : {}),
                  ...(h.section === "MATCHES" && i === 13 ? { borderLeft: SECTION_BORDER } : {}),
                  ...(h.section === "MATCHES" && i === 21 ? { borderRight: SECTION_BORDER } : {}),
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
              const pts = getPointsForPeriod(w, pointsPeriod);
              const ms = getMatchStatsForPeriod(w, pointsPeriod);
              const rowBg = rowIndex % 2 === 0 ? ROW_BG_MAIN : ROW_BG_ALT;
              const cellBorder = "1px solid " + BORDER_TABLE;
              const cellStyle = { borderBottom: cellBorder, borderRight: cellBorder, color: "#1a1a1a", background: rowBg };
              return (
                <tr key={w.id}>
                  <td
                    style={{
                      width: 52,
                      minWidth: 52,
                      maxWidth: 52,
                      padding: 0,
                      verticalAlign: "middle",
                      textAlign: "center",
                      borderBottom: cellBorder,
                      borderRight: "1px solid " + style.showBg,
                      background: style.showBg,
                      position: "sticky",
                      left: 0,
                      zIndex: 1,
                      boxShadow: "4px 0 8px rgba(0,0,0,0.06)",
                      boxSizing: "border-box",
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
                      width: 48,
                      minWidth: 48,
                      maxWidth: 48,
                      padding: "10px 6px",
                      textAlign: "center",
                      fontWeight: 600,
                      ...cellStyle,
                      borderRight: "1px solid " + rowBg,
                      position: "sticky",
                      left: 52,
                      zIndex: 1,
                      boxShadow: "4px 0 8px rgba(0,0,0,0.06)",
                      boxSizing: "border-box",
                    }}
                  >
                    {rankByWrestlerId.get(w.id) ?? "—"}
                  </td>
                  <td
                    style={{
                      width: 76,
                      minWidth: 76,
                      maxWidth: 76,
                      padding: 6,
                      ...cellStyle,
                      borderRight: "1px solid " + rowBg,
                      position: "sticky",
                      left: 100,
                      zIndex: 1,
                      boxShadow: "4px 0 8px rgba(0,0,0,0.06)",
                      boxSizing: "border-box",
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
                      width: 160,
                      minWidth: 160,
                      maxWidth: 160,
                      padding: "10px 12px",
                      fontWeight: 600,
                      position: "sticky",
                      left: 176,
                      zIndex: 1,
                      boxShadow: "4px 0 8px rgba(0,0,0,0.06)",
                      ...cellStyle,
                      borderRight: "1px solid " + rowBg,
                      boxSizing: "border-box",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <Link
                        href={wrestlerProfileHref(w.id, leagueSlug, wrestlerProfileFrom ?? undefined)}
                        style={{ color: "var(--color-blue)", textDecoration: "none" }}
                      >
                        {w.name || w.id}
                      </Link>
                      {wrestlerSlugsWithUnparsed?.length && (wrestlerSlugsWithUnparsed.includes(normalizeWrestlerName(w.id)) || wrestlerSlugsWithUnparsed.includes(w.id)) && (
                        <CautionBadge size={18} />
                      )}
                      {isInjured(w.status) && (
                        <>
                          <InjuryBadge size={18} />
                          <span style={{ color: "#c00", fontWeight: 600, fontSize: 11 }}>INJ</span>
                        </>
                      )}
                    </span>
                    {w.currentChampionship && (
                      <div style={{ fontSize: 11, fontWeight: 500, color: "#b8860b", marginTop: 2 }}>
                        {w.currentChampionship}
                      </div>
                    )}
                    {w.personaDisplay && (
                      <div style={{ fontSize: 11, fontWeight: 400, color: "var(--color-text-muted)", fontStyle: "italic", marginTop: 2 }}>
                        {w.personaDisplay}
                      </div>
                    )}
                  </td>
                  <td
                    style={{
                      width: 96,
                      minWidth: 96,
                      maxWidth: 96,
                      padding: "8px",
                      textAlign: "center",
                      ...cellStyle,
                      borderRight: "1px solid " + rowBg,
                      position: "sticky",
                      left: 336,
                      zIndex: 1,
                      boxShadow: "4px 0 8px rgba(0,0,0,0.06)",
                      boxSizing: "border-box",
                    }}
                  >
                    {rosterByWrestler?.[w.id] ? (
                      <>
                        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: "var(--color-text-muted)" }}>
                          {rosterByWrestler[w.id].ownerName}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          {leagueSlug && (
                            <Link
                              href={`/leagues/${encodeURIComponent(leagueSlug)}/team?proposeTradeTo=${encodeURIComponent(rosterByWrestler[w.id].ownerUserId)}`}
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: "50%",
                                background: "#e5e5e5",
                                border: "none",
                                color: "#000",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                textDecoration: "none",
                              }}
                              title="Propose trade"
                              aria-label={`Propose trade with ${rosterByWrestler[w.id].ownerName}`}
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M13 5H4M4 5L6 3M4 5l2 2" />
                                <path d="M3 11h9M12 11l-2-2M12 11l-2 2" />
                              </svg>
                            </Link>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: "var(--color-text-muted)" }}>FA</div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          <Link
                            href={
                              leagueSlug
                                ? `/leagues/${encodeURIComponent(leagueSlug)}/team?addFa=${encodeURIComponent(w.id)}`
                                : `/wrestlers/${encodeURIComponent(w.id)}`
                            }
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
                            title={leagueSlug ? "Sign free agent (go to My Team)" : "View wrestler"}
                            aria-label={leagueSlug ? `Sign ${w.name || w.id} as free agent` : `View ${w.name || w.id}`}
                          >
                            +
                          </Link>
                          <Link
                            href={
                              leagueSlug
                                ? `/leagues/${encodeURIComponent(leagueSlug)}/watchlist?add=${encodeURIComponent(w.id)}`
                                : `/wrestlers/watch?add=${encodeURIComponent(w.id)}`
                            }
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: "50%",
                              background: "transparent",
                              border: "1px solid " + BORDER_TABLE,
                              color: "var(--color-text)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              textDecoration: "none",
                              fontSize: 14,
                            }}
                            title="Watchlist"
                            aria-label="Add to watch list"
                          >
                            ⚑
                          </Link>
                        </div>
                      </>
                    )}
                  </td>
                  <td style={{ minWidth: 68, padding: "10px 8px", textAlign: "center", ...cellStyle }}>
                    {normalizeGender(w.gender)}
                  </td>
                  <td style={{ minWidth: 52, padding: "10px 8px", textAlign: "center", ...cellStyle }}>
                    {age != null ? age : "—"}
                  </td>
                  <td style={{ minWidth: 48, padding: "10px 8px", textAlign: "center", fontVariantNumeric: "tabular-nums", ...cellStyle }}>
                    {w.rating_2k26 != null ? w.rating_2k26 : w.rating_2k25 != null ? w.rating_2k25 : "—"}
                  </td>
                  <td style={{ minWidth: 72, padding: "10px 8px", textAlign: "center", fontWeight: 600, ...cellStyle, borderLeft: SECTION_BORDER }}>
                    {pts.rsPoints}
                  </td>
                  <td style={{ minWidth: 72, padding: "10px 8px", textAlign: "center", fontWeight: 600, ...cellStyle }}>
                    {pts.plePoints}
                  </td>
                  <td style={{ minWidth: 72, padding: "10px 8px", textAlign: "center", fontWeight: 600, ...cellStyle }}>
                    {pts.beltPoints}
                  </td>
                  <td style={{ minWidth: 80, padding: "10px 8px", textAlign: "center", fontWeight: 700, ...cellStyle }}>
                    {pts.totalPoints}
                  </td>
                  <td style={{ minWidth: 56, padding: "10px 8px", textAlign: "center", fontVariantNumeric: "tabular-nums", ...cellStyle, borderRight: SECTION_BORDER }}>
                    {ms.mw > 0 ? ((pts.rsPoints + pts.plePoints) / ms.mw).toFixed(1) : "—"}
                  </td>
                  <td style={{ minWidth: 56, padding: "10px 8px", textAlign: "center", fontVariantNumeric: "tabular-nums", ...cellStyle, borderLeft: SECTION_BORDER }}>
                    {ms.mw}
                  </td>
                  <td style={{ minWidth: 56, padding: "10px 8px", textAlign: "center", fontVariantNumeric: "tabular-nums", ...cellStyle }}>
                    {ms.win}
                  </td>
                  <td style={{ minWidth: 52, padding: "10px 8px", textAlign: "center", fontVariantNumeric: "tabular-nums", ...cellStyle }}>
                    {ms.mw > 0 ? ((ms.win / ms.mw) * 100).toFixed(1) : "—"}
                  </td>
                  <td style={{ minWidth: 56, padding: "10px 8px", textAlign: "center", fontVariantNumeric: "tabular-nums", ...cellStyle }}>
                    {ms.loss}
                  </td>
                  <td style={{ minWidth: 52, padding: "10px 8px", textAlign: "center", fontVariantNumeric: "tabular-nums", ...cellStyle }}>
                    {ms.mw > 0 ? ((ms.loss / ms.mw) * 100).toFixed(1) : "—"}
                  </td>
                  <td style={{ minWidth: 56, padding: "10px 8px", textAlign: "center", fontVariantNumeric: "tabular-nums", ...cellStyle }}>
                    {ms.nc}
                  </td>
                  <td style={{ minWidth: 56, padding: "10px 8px", textAlign: "center", fontVariantNumeric: "tabular-nums", ...cellStyle }}>
                    {ms.dqw}
                  </td>
                  <td style={{ minWidth: 56, padding: "10px 8px", textAlign: "center", fontVariantNumeric: "tabular-nums", ...cellStyle }}>
                    {ms.dql}
                  </td>
                  <td style={{ minWidth: 52, padding: "10px 8px", textAlign: "center", fontVariantNumeric: "tabular-nums", ...cellStyle, borderRight: SECTION_BORDER }}>
                    {ms.mw > 0 ? (((ms.dqw + ms.dql) / ms.mw) * 100).toFixed(1) : "—"}
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
        {search || includedRosters.size < ALL_ROSTER_VALUES.length ? (
          <>Showing {flatList.length} of {totalCount} wrestlers.</>
        ) : (
          <>Total: {totalCount} wrestlers.</>
        )}{" "}
        Use this pool when building your draft. Images from Pro Wrestling Boxscore (Supabase).
      </p>
    </>
  );
}
