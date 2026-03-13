"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";
import { EVENT_LOGO_URLS } from "@/lib/howItWorksImages";

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
  /** Belt image URL for primary current title (shown in Titles column). */
  championBeltImageUrl?: string | null;
  /** Number of matches needing review on this wrestler's profile (all-time). When set, shown next to name on League Leaders. */
  unparsedCount?: number;
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
  { value: "AAA", label: "AAA" },
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
  "AAA",
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
  AAA: { bg: "#222222", showBg: "#151515", label: "AAA" },
  "Front Office": { bg: "#4a4a4a", showBg: "#3a3a3a", label: "FRONT OFFICE" },
  "Celebrity Guests": { bg: "#3d3d3d", showBg: "#2d2d2d", label: "CELEBRITY" },
  Alumni: { bg: "#3d3d3d", showBg: "#2d2d2d", label: "ALUMNI" },
  Unassigned: { bg: "#5c5c5c", showBg: "#4c4c4c", label: "UNASSIGNED" },
  Other: { bg: "#3d3d3d", showBg: "#2d2d2d", label: "OTHER" },
};

/** Brand logo URLs for use in the roster column (League Leaders / Free Agents). */
const BRAND_LOGO_URLS: Record<string, string | undefined> = {
  Raw: EVENT_LOGO_URLS.raw,
  SmackDown: EVENT_LOGO_URLS.smackdown,
  NXT: EVENT_LOGO_URLS.nxt,
  AAA: EVENT_LOGO_URLS.aaa,
};

/** Map raw brand string to a filter category. */
function normalizeRoster(brand: string | null): string {
  if (!brand || !brand.trim()) return "Unassigned";
  const lower = brand.trim().toLowerCase();
  if (lower === "raw") return "Raw";
  if (lower === "smackdown" || lower === "smack down") return "SmackDown";
  if (lower === "nxt" || lower.includes("nxt")) return "NXT";
  if (lower === "aaa") return "AAA";
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
  { key: "roster", label: "Roster", minW: 56, align: "center", section: "PLAYER" },
  { key: "rank", label: "Rank", minW: 48, align: "center", section: "PLAYER" },
  { key: null, label: "", minW: 76, align: "center", section: "PLAYER" },
  { key: "name", label: "Name", minW: 160, align: "left", section: "PLAYER" },
  { key: null, label: "Titles", minW: 64, align: "center", section: "PLAYER" },
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

const STICKY_COLUMN_COUNT = 6; // Roster, Rank, Image, Name, Titles, Status
const STICKY_WIDTHS = [56, 48, 76, 160, 64, 96] as const;
const STICKY_TOTAL_WIDTH = STICKY_WIDTHS.reduce((a, b) => a + b, 0);
const SCROLL_HEADERS = HEADER_CONFIG.slice(STICKY_COLUMN_COUNT);
const SCROLL_TOTAL_WIDTH = SCROLL_HEADERS.reduce((s, h) => s + h.minW, 0);
/** Fixed body row height so left and right table rows match. */
const BODY_ROW_HEIGHT = 80;
/** Fixed header row heights so left and right table headers match and body rows align. */
const HEADER_ROW_HEIGHT = 40;

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

/** When on My Team roster, highlight the TOT column. */
const TOT_HIGHLIGHT_STYLE: React.CSSProperties = { background: "#1a1a1a", color: "#fff", fontWeight: 700 };

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
  wrestlerProfileFrom?: "league-leaders" | "free-agents" | "team" | null;
  /** Wrestler id -> owner info. When set, Status shows owner name + propose trade for rostered; else FA + add/flag. */
  rosterByWrestler?: Record<string, RosterOwnerInfo> | null;
  /** When true, hide the Include (roster/brand) filter row. Used e.g. on My Team roster where the list is already just that roster. */
  hideRosterFilter?: boolean;
};

function wrestlerProfileHref(wrestlerId: string, leagueSlug?: string | null, from?: "league-leaders" | "free-agents" | "team" | null): string {
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
  hideRosterFilter = false,
}: WrestlerListProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>(defaultSortColumn);
  const [sortDir, setSortDir] = useState<SortDir>(defaultSortDir);
  const [search, setSearch] = useState("");
  const [includedRosters, setIncludedRosters] = useState<Set<string>>(
    () => (hideRosterFilter ? new Set(ALL_ROSTER_VALUES) : new Set(["Raw", "SmackDown"]))
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
      {/* Toolbar: Roster checkboxes (optional), Period, Search, Reset */}
      <div className="wrestler-list-toolbar">
        {!hideRosterFilter && (
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
        )}
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
                    loading="lazy"
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
                    <> · 2K <span style={{ color: "#c00", fontWeight: 700 }}>{(w.rating_2k26 ?? w.rating_2k25) ?? ""}</span></>
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

      {/* Desktop: single grid — one row definition for left + right so heights always match */}
      {(() => {
        const gridTemplateRows = "40px 40px " + flatList.map(() => "80px").join(" ");
        const cellBorder = "1px solid " + BORDER_TABLE;
        const scrollCols = SCROLL_HEADERS.map((h) => h.minW + "px").join(" ");
        return (
          <div
            className="wrestler-list-table-wrap"
            style={{
              border: "1px solid " + BORDER_TABLE,
              borderRadius: 8,
              overflow: "hidden",
              background: ROW_BG_MAIN,
              display: "grid",
              gridTemplateColumns: STICKY_TOTAL_WIDTH + "px 1fr",
              gridTemplateRows,
            }}
          >
            {/* Left column: one grid row per table row */}
            <div style={{ gridColumn: 1, gridRow: 1, display: "grid", gridTemplateColumns: "56px 48px 76px 160px 64px 96px", borderBottom: cellBorder }}>
              {HEADER_CONFIG.slice(0, 6).map((_, i) => (
                <div key={i} style={{ ...thBase, borderRight: cellBorder, borderBottom: "none" }} />
              ))}
            </div>
            <div style={{ gridColumn: 1, gridRow: 2, display: "grid", gridTemplateColumns: "56px 48px 76px 160px 64px 96px", borderBottom: cellBorder }}>
              {HEADER_CONFIG.slice(0, 6).map((h, i) => {
                const isSortable = h.key != null;
                const isActive = sortColumn === h.key;
                const style: React.CSSProperties = { ...thBase, textAlign: h.align, borderRight: cellBorder, borderBottom: "none", display: "flex", alignItems: "center" };
                if (!isSortable) return <div key={i} style={style}>{h.label}</div>;
                return (
                  <div key={i} style={style}>
                    <button type="button" onClick={() => handleSort(h.key as SortColumn)} style={{ width: "100%", padding: 0, border: "none", background: "none", color: isActive ? "var(--color-blue)" : "inherit", font: "inherit", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: h.align === "center" ? "center" : "flex-start", gap: 4 }}>
                      <span>{h.label}</span>
                      {isActive && <span style={{ opacity: 0.9 }}>{sortDir === "asc" ? "↑" : "↓"}</span>}
                    </button>
                  </div>
                );
              })}
            </div>
            {flatList.map((w, rowIndex) => {
              const roster = normalizeRoster(w.brand);
              const style = BRAND_STYLES[roster] ?? BRAND_STYLES.Other;
              const brandLogo = BRAND_LOGO_URLS[roster];
              const rowBg = rowIndex % 2 === 0 ? ROW_BG_MAIN : ROW_BG_ALT;
              return (
                <div key={w.id} style={{ gridColumn: 1, gridRow: rowIndex + 3, display: "grid", gridTemplateColumns: "56px 48px 76px 160px 64px 96px", borderBottom: cellBorder }}>
                  <div
                    style={{
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRight: cellBorder,
                      background: style.showBg,
                    }}
                  >
                    {brandLogo ? (
                      <img
                        src={brandLogo}
                        alt={roster}
                        loading="lazy"
                        style={{
                          display: "block",
                          width: "100%",
                          height: "100%",
                          maxWidth: "none",
                          maxHeight: "none",
                          objectFit: "contain",
                          transform: "rotate(-90deg)",
                        }}
                      />
                    ) : (
                      <span
                        style={{
                          writingMode: "vertical-rl",
                          transform: "rotate(-180deg)",
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: 0.5,
                          color: "#fff",
                        }}
                      >
                        {style.label}
                      </span>
                    )}
                  </div>
                  <div style={{ padding: "10px 6px", textAlign: "center", fontWeight: 600, borderRight: cellBorder, background: rowBg, color: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center" }}>{rankByWrestlerId.get(w.id) ?? "—"}</div>
                  <div style={{ padding: 6, borderRight: cellBorder, background: rowBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {w.image_url ? <img src={w.image_url} alt={w.name || w.id} loading="lazy" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: "50%", display: "block", background: BORDER_TABLE }} /> : <div style={{ width: 60, height: 60, borderRadius: "50%", background: ROW_BG_ALT, display: "flex", alignItems: "center", justifyContent: "center", color: "#999", fontSize: 20 }} aria-hidden>—</div>}
                  </div>
                  <div style={{ padding: "10px 12px", fontWeight: 600, borderRight: cellBorder, background: rowBg, color: "#1a1a1a", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <Link href={wrestlerProfileHref(w.id, leagueSlug, wrestlerProfileFrom ?? undefined)} style={{ color: "var(--color-blue)", textDecoration: "none" }}>{w.name || w.id}</Link>
                      {isInjured(w.status) && <><InjuryBadge size={18} /><span style={{ color: "#c00", fontWeight: 600, fontSize: 11 }}>INJ</span></>}
                    </span>
                    {w.currentChampionship && <div style={{ fontSize: 11, fontWeight: 500, color: "#b8860b", marginTop: 2 }}>{w.currentChampionship}</div>}
                    {w.personaDisplay && <div style={{ fontSize: 11, fontWeight: 400, color: "var(--color-text-muted)", fontStyle: "italic", marginTop: 2 }}>{w.personaDisplay}</div>}
                  </div>
                  <div style={{ padding: 6, textAlign: "center", borderRight: cellBorder, background: rowBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {w.championBeltImageUrl ? <img src={w.championBeltImageUrl} alt="" aria-hidden loading="lazy" style={{ width: 56, height: 32, objectFit: "contain", display: "block" }} /> : null}
                  </div>
                  <div style={{ padding: "8px", textAlign: "center", background: rowBg, color: "#1a1a1a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    {rosterByWrestler?.[w.id] ? (
                      <>
                        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: "var(--color-text-muted)" }}>{rosterByWrestler[w.id].ownerName}</div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          {leagueSlug && <Link href={`/leagues/${encodeURIComponent(leagueSlug)}/team?proposeTradeTo=${encodeURIComponent(rosterByWrestler[w.id].ownerUserId)}`} style={{ width: 32, height: 32, borderRadius: "50%", background: "#e5e5e5", border: "none", color: "#000", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }} title="Propose trade" aria-label={`Propose trade with ${rosterByWrestler[w.id].ownerName}`}><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M13 5H4M4 5L6 3M4 5l2 2" /><path d="M3 11h9M12 11l-2-2M12 11l-2 2" /></svg></Link>}
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: "var(--color-text-muted)" }}>FA</div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          <Link href={leagueSlug ? `/leagues/${encodeURIComponent(leagueSlug)}/team?addFa=${encodeURIComponent(w.id)}` : `/wrestlers/${encodeURIComponent(w.id)}`} style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--color-blue)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", fontWeight: 700, fontSize: 18, lineHeight: 1 }} title={leagueSlug ? "Sign free agent (go to My Team)" : "View wrestler"} aria-label={leagueSlug ? `Sign ${w.name || w.id} as free agent` : `View ${w.name || w.id}`}>+</Link>
                          <Link href={leagueSlug ? `/leagues/${encodeURIComponent(leagueSlug)}/watchlist?add=${encodeURIComponent(w.id)}` : `/wrestlers/watch?add=${encodeURIComponent(w.id)}`} style={{ width: 32, height: 32, borderRadius: "50%", background: "transparent", border: "1px solid " + BORDER_TABLE, color: "var(--color-text)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", fontSize: 14 }} title="Watchlist" aria-label="Add to watch list">⚑</Link>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {/* Right column: single cell spanning all rows, inner grid with same row template */}
            <div style={{ gridColumn: 2, gridRow: "1 / -1", minWidth: 0, overflowX: "auto", WebkitOverflowScrolling: "touch", borderLeft: "1px solid " + BORDER_TABLE, background: HEADER_BG }}>
              <div style={{ display: "grid", gridTemplateColumns: scrollCols, gridTemplateRows, width: SCROLL_TOTAL_WIDTH + "px", minWidth: SCROLL_TOTAL_WIDTH + "px" }}>
                <div style={{ gridRow: 1, display: "grid", gridTemplateColumns: scrollCols, borderBottom: cellBorder }}>
                  <div style={{ ...thBase, gridColumn: "1 / 4", borderRight: cellBorder, borderBottom: cellBorder }} />
                  <div style={{ ...thBase, gridColumn: "4 / 9", textAlign: "center", borderLeft: SECTION_BORDER, borderRight: SECTION_BORDER, borderBottom: cellBorder }}>Points</div>
                  <div style={{ ...thBase, gridColumn: "9 / -1", textAlign: "center", borderLeft: SECTION_BORDER, borderRight: cellBorder, borderBottom: cellBorder }}>Matches</div>
                </div>
                <div style={{ gridRow: 2, display: "grid", gridTemplateColumns: scrollCols, borderBottom: cellBorder }}>
                  {SCROLL_HEADERS.map((h, i) => {
                    const isSortable = h.key != null;
                    const isActive = sortColumn === h.key;
                    const idx = i + STICKY_COLUMN_COUNT;
                    const highlightTOT = wrestlerProfileFrom === "team" && h.key === "totalPoints";
                    const style: React.CSSProperties = { ...thBase, minWidth: h.minW, textAlign: h.align, borderRight: idx === HEADER_CONFIG.length - 1 ? cellBorder : cellBorder, borderBottom: cellBorder, display: "flex", alignItems: "center", ...(h.section === "POINTS" && idx === 9 ? { borderLeft: SECTION_BORDER } : {}), ...(h.section === "POINTS" && idx === 13 ? { borderRight: SECTION_BORDER } : {}), ...(h.section === "MATCHES" && idx === 14 ? { borderLeft: SECTION_BORDER } : {}), ...(highlightTOT ? TOT_HIGHLIGHT_STYLE : {}) };
                    if (!isSortable) return <div key={i} style={style}>{h.label}</div>;
                    return (
                      <div key={i} style={style}>
                        <button type="button" onClick={() => handleSort(h.key as SortColumn)} style={{ width: "100%", padding: 0, border: "none", background: "none", color: highlightTOT ? "#fff" : isActive ? "var(--color-blue)" : "inherit", font: "inherit", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: h.align === "center" ? "center" : "flex-start", gap: 4 }}>
                          <span>{h.label}</span>
                          {isActive && <span style={{ opacity: 0.9 }}>{sortDir === "asc" ? "↑" : "↓"}</span>}
                        </button>
                      </div>
                    );
                  })}
                </div>
                {flatList.map((w, rowIndex) => {
                  const age = calculateAge(w.dob);
                  const pts = getPointsForPeriod(w, pointsPeriod);
                  const ms = getMatchStatsForPeriod(w, pointsPeriod);
                  const rowBg = rowIndex % 2 === 0 ? ROW_BG_MAIN : ROW_BG_ALT;
                  const cellStyle: React.CSSProperties = { borderRight: cellBorder, borderBottom: cellBorder, color: "#1a1a1a", background: rowBg, padding: "10px 8px", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center" };
                  return (
                    <div key={w.id} style={{ gridRow: rowIndex + 3, display: "grid", gridTemplateColumns: scrollCols }}>
                      <div style={cellStyle}>{normalizeGender(w.gender)}</div>
                      <div style={cellStyle}>{age != null ? age : "—"}</div>
                      <div style={{ ...cellStyle, fontVariantNumeric: "tabular-nums", fontWeight: 700, color: "#c00" }}>{w.rating_2k26 != null ? w.rating_2k26 : w.rating_2k25 != null ? w.rating_2k25 : "—"}</div>
                      <div style={{ ...cellStyle, fontWeight: 600, borderLeft: SECTION_BORDER }}>{pts.rsPoints}</div>
                      <div style={{ ...cellStyle, fontWeight: 600 }}>{pts.plePoints}</div>
                      <div style={{ ...cellStyle, fontWeight: 600 }}>{pts.beltPoints}</div>
                      <div style={{ ...cellStyle, ...(wrestlerProfileFrom === "team" ? TOT_HIGHLIGHT_STYLE : { fontWeight: 700 }) }}>{pts.totalPoints}</div>
                      <div style={{ ...cellStyle, fontVariantNumeric: "tabular-nums", borderRight: SECTION_BORDER }}>{ms.mw > 0 ? ((pts.rsPoints + pts.plePoints) / ms.mw).toFixed(1) : "—"}</div>
                      <div style={{ ...cellStyle, fontVariantNumeric: "tabular-nums", borderLeft: SECTION_BORDER }}>{ms.mw}</div>
                      <div style={{ ...cellStyle, fontVariantNumeric: "tabular-nums" }}>{ms.win}</div>
                      <div style={{ ...cellStyle, fontVariantNumeric: "tabular-nums" }}>{ms.mw > 0 ? ((ms.win / ms.mw) * 100).toFixed(1) : "—"}</div>
                      <div style={{ ...cellStyle, fontVariantNumeric: "tabular-nums" }}>{ms.loss}</div>
                      <div style={{ ...cellStyle, fontVariantNumeric: "tabular-nums" }}>{ms.mw > 0 ? ((ms.loss / ms.mw) * 100).toFixed(1) : "—"}</div>
                      <div style={{ ...cellStyle, fontVariantNumeric: "tabular-nums" }}>{ms.nc}</div>
                      <div style={{ ...cellStyle, fontVariantNumeric: "tabular-nums" }}>{ms.dqw}</div>
                      <div style={{ ...cellStyle, fontVariantNumeric: "tabular-nums" }}>{ms.dql}</div>
                      <div style={{ ...cellStyle, fontVariantNumeric: "tabular-nums", borderRight: SECTION_BORDER }}>{ms.mw > 0 ? (((ms.dqw + ms.dql) / ms.mw) * 100).toFixed(1) : "—"}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

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
