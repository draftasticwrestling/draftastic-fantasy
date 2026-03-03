"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { getRosterRulesForLeague } from "@/lib/leagueStructure";
import { isBlocklistedSlug } from "@/lib/draftBlocklist";

export type WrestlerDraftRow = {
  id: string;
  name: string | null;
  gender: string | null;
  brand: string | null;
  dob: string | null;
  image_url: string | null;
  rating_2k26: number | null;
  rating_2k25: number | null;
  /** Status from API (e.g. Injured, INJ). Used to show injury badge. */
  status?: string | null;
  /** Current championship(s) held, e.g. "WWE Championship". Shown under name. */
  currentChampionship?: string | null;
};

export type PointsBySlug = Record<string, { rsPoints: number; plePoints: number; beltPoints: number }>;

const PICK_CLOCK_SECONDS = 5;

/** Overall rank formula: composite = total points + (2K26 rating × 1.5). Higher = better. */
const RATING_WEIGHT = 1.5;

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

function normalizeBrand(brand: string | null | undefined): string {
  if (!brand?.trim()) return "Unassigned";
  const lower = brand.trim().toLowerCase();
  if (lower === "raw") return "Raw";
  if (lower === "smackdown" || lower === "smack down") return "SmackDown";
  if (lower === "nxt" || lower.includes("nxt")) return "NXT";
  return "Unassigned";
}

/** Map brand to roster category for filters (match WrestlerList). */
function rosterCategory(brand: string | null | undefined): string {
  if (!brand?.trim()) return "Unassigned";
  const lower = brand.trim().toLowerCase();
  if (lower === "raw") return "Raw";
  if (lower === "smackdown" || lower === "smack down") return "SmackDown";
  if (lower === "nxt" || lower.includes("nxt")) return "NXT";
  if (lower === "celebrity guests" || lower === "celebrity" || lower === "celebrity guest") return "Celebrity Guests";
  if (lower === "alumni") return "Alumni";
  if (lower === "managers" || lower === "manager" || lower === "gm" || lower === "gms" || lower === "head of creative" || lower === "announcers" || lower === "announcer") return "Front Office";
  return "Other";
}

/** Roster filter options (match WrestlerList order). */
const ROSTER_FILTER_OPTIONS = [
  { value: "Raw", label: "Raw" },
  { value: "SmackDown", label: "SmackDown" },
  { value: "NXT", label: "NXT" },
  { value: "Front Office", label: "Front Office" },
  { value: "Celebrity Guests", label: "Celebrity Guests" },
  { value: "Alumni", label: "Alumni" },
  { value: "Unassigned", label: "Unassigned" },
  { value: "Other", label: "Other" },
] as const;

/** Match WrestlerList: Roster/Brand as first column with colored cell. */
const BRAND_STYLES: Record<string, { showBg: string; label: string }> = {
  Raw: { showBg: "#6B0F2A", label: "RAW" },
  SmackDown: { showBg: "#071A4A", label: "SD" },
  NXT: { showBg: "#1a1a1a", label: "NXT" },
  "Front Office": { showBg: "#3a3a3a", label: "FRONT OFFICE" },
  "Celebrity Guests": { showBg: "#2d2d2d", label: "CELEBRITY" },
  Alumni: { showBg: "#2d2d2d", label: "ALUMNI" },
  Unassigned: { showBg: "#4c4c4c", label: "UNASSIGNED" },
  Other: { showBg: "#2d2d2d", label: "OTHER" },
};

function normalizeGender(g: string | null | undefined): string {
  if (!g) return "—";
  const lower = String(g).toLowerCase();
  if (lower === "male" || lower === "m") return "M";
  if (lower === "female" || lower === "f") return "F";
  return "—";
}

/** Treat Injured, INJ, or any status containing "injured" (e.g. Injured Reserve) as injured. */
function isInjured(status: string | null | undefined): boolean {
  if (status == null || status === "") return false;
  const s = String(status).trim().toLowerCase();
  return s === "injured" || s === "inj" || s.includes("injured");
}

function getWrestlerStatus(w: WrestlerDraftRow): string | null {
  const raw = w as Record<string, unknown>;
  const v = raw.status ?? raw.Status ?? (raw as Record<string, unknown>).STATUS;
  return v != null && v !== "" ? String(v) : null;
}

/** Medical plus (injury badge) — matches WrestlerList. */
function InjuryBadge({ size = 16 }: { size?: number }) {
  return (
    <span
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

function shuffle<T>(array: T[]): T[] {
  const out = [...array];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Build draft order: order[i] = team index (0-based) for overall pick i+1. */
function buildDraftOrder(
  style: "snake" | "linear",
  teamCount: number,
  rosterSize: number
): number[] {
  const round1Order = shuffle(Array.from({ length: teamCount }, (_, i) => i));
  const order: number[] = [];
  for (let round = 1; round <= rosterSize; round++) {
    const roundOrder =
      style === "snake" && round % 2 === 0 ? [...round1Order].reverse() : round1Order;
    roundOrder.forEach((teamIndex) => order.push(teamIndex));
  }
  return order;
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const TEAM_COUNTS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/** Auto-draft options: focus (which points period), point strategy, wrestler strategy. */
export type AutoDraftFocus = "2026" | "2025" | "all";
export type AutoDraftPointStrategy = "total" | "rs" | "ple" | "belt";
export type AutoDraftWrestlerStrategy =
  | "best_available"
  | "balanced_gender"
  | "balanced_brands"
  | "high_males"
  | "high_females";

const FOCUS_OPTIONS: { value: AutoDraftFocus; label: string }[] = [
  { value: "all", label: "All-time points" },
  { value: "2026", label: "2026 points" },
  { value: "2025", label: "2025 points" },
];
const POINT_STRATEGY_OPTIONS: { value: AutoDraftPointStrategy; label: string }[] = [
  { value: "total", label: "Total Points" },
  { value: "rs", label: "R/S points" },
  { value: "ple", label: "PLE Points" },
  { value: "belt", label: "Belt Points" },
];
const WRESTLER_STRATEGY_OPTIONS: { value: AutoDraftWrestlerStrategy; label: string }[] = [
  { value: "best_available", label: "Best available" },
  { value: "balanced_gender", label: "Balanced male/female" },
  { value: "balanced_brands", label: "Balanced Raw/SmackDown" },
  { value: "high_males", label: "High ranking males" },
  { value: "high_females", label: "High ranking females" },
];

const DEFAULT_AUTO_PREFS = {
  focus: "all" as AutoDraftFocus,
  pointStrategy: "total" as AutoDraftPointStrategy,
  wrestlerStrategy: "best_available" as AutoDraftWrestlerStrategy,
};

type Phase = "setup" | "drafting" | "complete";

type PointsPeriod = "2026" | "2025" | "all";

type DraftTableSortColumn = "rank" | "name" | "gender" | "age" | "2k" | "rs" | "ple" | "belt" | "total" | "brand";
type SortDir = "asc" | "desc";

type Props = {
  wrestlers: WrestlerDraftRow[];
  pointsByPeriod: { "2026": PointsBySlug; "2025": PointsBySlug; all: PointsBySlug };
};

export function TestDraft({ wrestlers: wrestlersProp, pointsByPeriod }: Props) {
  const wrestlers = wrestlersProp ?? [];
  const [teamCount, setTeamCount] = useState<number>(4);
  const [draftStyle, setDraftStyle] = useState<"snake" | "linear">("snake");
  const [phase, setPhase] = useState<Phase>("setup");
  const [pointsPeriod, setPointsPeriod] = useState<PointsPeriod>("all");
  const [draftOrder, setDraftOrder] = useState<number[]>([]);
  const [picksByTeam, setPicksByTeam] = useState<Record<number, string[]>>({});
  const [currentPick, setCurrentPick] = useState(1);
  const [clockSeconds, setClockSeconds] = useState(PICK_CLOCK_SECONDS);
  const [searchQuery, setSearchQuery] = useState("");
  const [tableSortColumn, setTableSortColumn] = useState<DraftTableSortColumn>("rank");
  const [tableSortDir, setTableSortDir] = useState<SortDir>("asc");
  const [includedRosters, setIncludedRosters] = useState<Set<string>>(() => new Set(["Raw", "SmackDown"]));
  /** Per-team auto-draft preferences. Used when clock hits 0. */
  const [teamPreferences, setTeamPreferences] = useState<
    Record<number, { focus: AutoDraftFocus; pointStrategy: AutoDraftPointStrategy; wrestlerStrategy: AutoDraftWrestlerStrategy }>
  >({});
  /** Which team's preferences we're editing in setup (0-based). */
  const [editingTeamPrefsFor, setEditingTeamPrefsFor] = useState<number>(0);
  const autoPickTriggeredForPickRef = useRef<number>(0);

  const rules = getRosterRulesForLeague(teamCount);
  const totalPicks = rules ? teamCount * rules.rosterSize : 0;
  const currentTeamIndex = draftOrder[currentPick - 1] ?? null;

  const draftedIds = new Set<string>();
  Object.values(picksByTeam).forEach((ids) => ids.forEach((id) => draftedIds.add(id)));
  const available = wrestlers.filter((w) => !draftedIds.has(w.id));

  const pointsForPeriod = pointsByPeriod[pointsPeriod];

  /** Available wrestlers with stats; default order by composite rank. */
  const availableWithStats = useMemo(() => {
    const withStats = available.map((w) => {
      const pts = pointsForPeriod[w.id] ?? { rsPoints: 0, plePoints: 0, beltPoints: 0 };
      const total = pts.rsPoints + pts.plePoints + pts.beltPoints;
      const rating = w.rating_2k26 ?? 0;
      const composite = total + rating * RATING_WEIGHT;
      return { wrestler: w, rs: pts.rsPoints, ple: pts.plePoints, belt: pts.beltPoints, total, composite };
    });
    withStats.sort((a, b) => b.composite - a.composite || (b.wrestler.rating_2k26 ?? 0) - (a.wrestler.rating_2k26 ?? 0) || (a.wrestler.name ?? a.wrestler.id ?? "").localeCompare(b.wrestler.name ?? b.wrestler.id ?? ""));
    return withStats.map((row, i) => ({ ...row, rank: i + 1 }));
  }, [available, pointsForPeriod]);

  /** Prefer Raw/SmackDown over NXT/Unassigned/Other within the top tier when auto-picking. */
  function preferMainRoster<T extends { wrestler: WrestlerDraftRow; total: number }>(sorted: T[]): string | null {
    if (sorted.length === 0) return null;
    const tierSize = Math.max(1, Math.min(15, Math.ceil(sorted.length * 0.3)));
    const topTier = sorted.slice(0, tierSize);
    const main = topTier.find((r) => {
      const b = normalizeBrand(r.wrestler.brand);
      return b === "Raw" || b === "SmackDown";
    });
    return (main ?? sorted[0])?.wrestler.id ?? null;
  }

  /** Pick best available wrestler for a team using their preferences (for auto-pick when clock hits 0). */
  const getAutoPickWrestlerId = useCallback(
    (teamIndex: number): string | null => {
      const prefs = teamPreferences[teamIndex] ?? DEFAULT_AUTO_PREFS;
      const focus = prefs.focus ?? "2026";
      const pointStrategy = prefs.pointStrategy ?? "total";
      const wrestlerStrategy = prefs.wrestlerStrategy ?? "best_available";
      const pts = pointsByPeriod[focus];
      const draftableAvailable = available.filter(
        (w) => !isBlocklistedSlug(w.id) && !isInjured(getWrestlerStatus(w))
      );
      if (!pts) return draftableAvailable[0]?.id ?? null;
      const list = draftableAvailable.map((w) => {
        const p = pts[w.id] ?? { rsPoints: 0, plePoints: 0, beltPoints: 0 };
        const total = p.rsPoints + p.plePoints + p.beltPoints;
        return { wrestler: w, rs: p.rsPoints, ple: p.plePoints, belt: p.beltPoints, total };
      });
      if (list.length === 0) return null;
      // Prefer wrestlers with at least 1 point in the chosen metric so we don't pick 0-point talent when others have points
      const hasPoints =
        pointStrategy === "total"
          ? (r: { total: number }) => r.total > 0
          : pointStrategy === "rs"
            ? (r: { rs: number }) => r.rs > 0
            : pointStrategy === "ple"
              ? (r: { ple: number }) => r.ple > 0
              : (r: { belt: number }) => r.belt > 0;
      const withPoints = list.filter(hasPoints);
      const withPointsSorted =
        pointStrategy === "total"
          ? [...withPoints].sort((a, b) => b.total - a.total)
          : pointStrategy === "rs"
            ? [...withPoints].sort((a, b) => b.rs - a.rs)
            : pointStrategy === "ple"
              ? [...withPoints].sort((a, b) => b.ple - a.ple)
              : [...withPoints].sort((a, b) => b.belt - a.belt);
      const significantCount = Math.max(1, Math.ceil(withPointsSorted.length * 0.5));
      const significantPoints = withPointsSorted.slice(0, significantCount);
      const baseList = significantPoints.length > 0 ? significantPoints : withPoints.length > 0 ? withPoints : list;
      const rosterIds = picksByTeam[teamIndex] ?? [];
      const rosterGenderCounts: Record<string, number> = { F: 0, M: 0 };
      const rosterBrandCounts: Record<string, number> = { Raw: 0, SmackDown: 0, Unassigned: 0 };
      for (const id of rosterIds) {
        const w = wrestlers.find((x) => x.id === id);
        const g = normalizeGender(w?.gender);
        if (g) rosterGenderCounts[g] = (rosterGenderCounts[g] ?? 0) + 1;
        const b = normalizeBrand(w?.brand);
        rosterBrandCounts[b] = (rosterBrandCounts[b] ?? 0) + 1;
      }
      const currentFemale = rosterGenderCounts.F ?? 0;
      const currentMale = rosterGenderCounts.M ?? 0;
      const remainingPicks = rules ? rules.rosterSize - rosterIds.length : 0;
      const needFemale = rules ? Math.max(0, rules.minFemale - currentFemale) : 0;
      const needMale = rules ? Math.max(0, rules.minMale - currentMale) : 0;
      const requiredGender: "F" | "M" | null =
        rules && remainingPicks > 0
          ? needFemale > 0 && remainingPicks - 1 < needFemale
            ? "F"
            : needMale > 0 && remainingPicks - 1 < needMale
              ? "M"
              : null
          : null;
      let pool = baseList;
      if (requiredGender) {
        const byGender = baseList.filter((r) => normalizeGender(r.wrestler.gender) === requiredGender);
        if (byGender.length > 0) pool = byGender;
      }
      let sorted = [...pool];
      if (pointStrategy === "total") sorted.sort((a, b) => b.total - a.total);
      else if (pointStrategy === "rs") sorted.sort((a, b) => b.rs - a.rs);
      else if (pointStrategy === "ple") sorted.sort((a, b) => b.ple - a.ple);
      else if (pointStrategy === "belt") sorted.sort((a, b) => b.belt - a.belt);
      if (wrestlerStrategy === "best_available") return preferMainRoster(sorted);
      if (wrestlerStrategy === "balanced_gender") {
        sorted.sort((a, b) => {
          const gA = normalizeGender(a.wrestler.gender);
          const gB = normalizeGender(b.wrestler.gender);
          const cA = gA ? rosterGenderCounts[gA] ?? 0 : 0;
          const cB = gB ? rosterGenderCounts[gB] ?? 0 : 0;
          if (cA !== cB) return cA - cB;
          return b.total - a.total;
        });
        return preferMainRoster(sorted);
      }
      if (wrestlerStrategy === "balanced_brands") {
        sorted.sort((a, b) => {
          const brandA = normalizeBrand(a.wrestler.brand);
          const brandB = normalizeBrand(b.wrestler.brand);
          const countA = rosterBrandCounts[brandA] ?? 0;
          const countB = rosterBrandCounts[brandB] ?? 0;
          if (countA !== countB) return countA - countB;
          return b.total - a.total;
        });
        return preferMainRoster(sorted);
      }
      if (wrestlerStrategy === "high_males") {
        const male = sorted.filter((r) => normalizeGender(r.wrestler.gender) === "M");
        const pool = male.length > 0 ? male : sorted;
        pool.sort((a, b) => b.total * 1.2 - a.total * 1.2);
        return preferMainRoster(pool);
      }
      if (wrestlerStrategy === "high_females") {
        const female = sorted.filter((r) => normalizeGender(r.wrestler.gender) === "F");
        const pool = female.length > 0 ? female : sorted;
        pool.sort((a, b) => b.total * 1.2 - a.total * 1.2);
        return preferMainRoster(pool);
      }
      return preferMainRoster(sorted);
    },
    [teamPreferences, available, pointsByPeriod, picksByTeam, wrestlers, rules]
  );

  /** Filter by roster (Include checkboxes), then search, then sort by selected column. */
  const rankedAvailable = useMemo(() => {
    let list =
      includedRosters.size === 0
        ? []
        : availableWithStats.filter((row) => includedRosters.has(rosterCategory(row.wrestler.brand)));
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((row) => {
        const name = (row.wrestler.name ?? row.wrestler.id).toLowerCase();
        return name.startsWith(q) || name.includes(q);
      });
    }

    const dir = tableSortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      let out = 0;
      const wA = a.wrestler;
      const wB = b.wrestler;
      switch (tableSortColumn) {
        case "rank":
          out = a.rank - b.rank;
          break;
        case "name":
          out = (wA.name ?? wA.id).localeCompare(wB.name ?? wB.id);
          break;
        case "gender":
          out = normalizeGender(wA.gender).localeCompare(normalizeGender(wB.gender));
          break;
        case "age": {
          const ageA = calculateAge(wA.dob) ?? -1;
          const ageB = calculateAge(wB.dob) ?? -1;
          out = ageA - ageB;
          break;
        }
        case "2k": {
          const rA = wA.rating_2k26 ?? wA.rating_2k25 ?? -1;
          const rB = wB.rating_2k26 ?? wB.rating_2k25 ?? -1;
          out = rA - rB;
          break;
        }
        case "rs":
          out = a.rs - b.rs;
          break;
        case "ple":
          out = a.ple - b.ple;
          break;
        case "belt":
          out = a.belt - b.belt;
          break;
        case "total":
          out = a.total - b.total;
          break;
        case "brand":
          out = rosterCategory(wA.brand).localeCompare(rosterCategory(wB.brand));
          break;
        default:
          out = a.rank - b.rank;
      }
      return out * dir;
    });
    return list;
  }, [availableWithStats, includedRosters, searchQuery, tableSortColumn, tableSortDir]);

  const handleSort = useCallback(
    (col: DraftTableSortColumn) => {
      if (tableSortColumn === col) {
        setTableSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setTableSortColumn(col);
        setTableSortDir("desc");
      }
    },
    [tableSortColumn]
  );

  useEffect(() => {
    if (phase !== "drafting") return;
    setClockSeconds(PICK_CLOCK_SECONDS);
    const interval = setInterval(() => {
      setClockSeconds((prev) => {
        if (prev <= 0) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, currentPick]);

  const startDraft = useCallback(() => {
    if (!rules) return;
    autoPickTriggeredForPickRef.current = 0;
    const order = buildDraftOrder(draftStyle, teamCount, rules.rosterSize);
    setDraftOrder(order);
    setPicksByTeam({});
    setCurrentPick(1);
    setPhase("drafting");
  }, [teamCount, draftStyle, rules]);

  const makePick = useCallback(
    (wrestlerId: string) => {
      if (phase !== "drafting" || currentTeamIndex == null) return;
      setPicksByTeam((prev) => ({
        ...prev,
        [currentTeamIndex]: [...(prev[currentTeamIndex] ?? []), wrestlerId],
      }));
      if (currentPick >= totalPicks) {
        setPhase("complete");
      } else {
        setCurrentPick((p) => p + 1);
      }
    },
    [phase, currentPick, totalPicks, currentTeamIndex]
  );

  /** When clock hits 0 during drafting, auto-pick for current team. Clock resets when currentPick changes (interval effect). */
  useEffect(() => {
    if (phase !== "drafting" || clockSeconds !== 0 || currentTeamIndex == null) return;
    if (autoPickTriggeredForPickRef.current === currentPick) return;
    autoPickTriggeredForPickRef.current = currentPick;
    const bestId = getAutoPickWrestlerId(currentTeamIndex);
    if (bestId) makePick(bestId);
  }, [phase, clockSeconds, currentPick, currentTeamIndex, getAutoPickWrestlerId, makePick]);

  const reset = useCallback(() => {
    setPhase("setup");
    setDraftOrder([]);
    setPicksByTeam({});
    setCurrentPick(1);
    setClockSeconds(PICK_CLOCK_SECONDS);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {phase === "setup" && (
        <section
          style={{
            padding: 24,
            background: "var(--color-bg-elevated)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
          }}
        >
          <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 12 }}>
            Start a test draft
          </h2>
          <p style={{ color: "var(--color-text-muted)", marginBottom: 16 }}>
            Choose number of teams and draft style. You’ll make every pick for every team. Set auto-draft priorities below for each team, then start the draft. A <strong>5-second</strong> clock runs per pick; when time runs out, the current team is auto-picked using their priorities.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 20 }}>
            <div>
              <label htmlFor="test-draft-teams" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
                Number of teams
              </label>
              <select
                id="test-draft-teams"
                value={teamCount}
                onChange={(e) => setTeamCount(Number(e.target.value))}
                style={{
                  padding: "10px 12px",
                  fontSize: 16,
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius)",
                  minWidth: 80,
                }}
              >
                {TEAM_COUNTS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="test-draft-style" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
                Draft style
              </label>
              <select
                id="test-draft-style"
                value={draftStyle}
                onChange={(e) => setDraftStyle(e.target.value as "snake" | "linear")}
                style={{
                  padding: "10px 12px",
                  fontSize: 16,
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius)",
                  minWidth: 140,
                }}
              >
                <option value="snake">Snake</option>
                <option value="linear">Standard (linear)</option>
              </select>
            </div>
            {rules && (
              <span style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
                {rules.rosterSize} picks per team · {totalPicks} total
              </span>
            )}
            <button
              type="button"
              onClick={startDraft}
              disabled={!rules}
              style={{
                padding: "10px 20px",
                background: "var(--color-blue)",
                color: "var(--color-text-inverse)",
                border: "none",
                borderRadius: "var(--radius)",
                fontSize: 16,
                fontWeight: 600,
                cursor: rules ? "pointer" : "not-allowed",
                opacity: rules ? 1 : 0.6,
              }}
            >
              Start test draft
            </button>
          </div>

          <section style={{ marginTop: 24, padding: 20, background: "var(--color-bg-surface)", borderRadius: "var(--radius)", border: "1px solid var(--color-border)" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 8 }}>Auto-draft priorities (all teams)</h3>
            <p style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 16 }}>
              When the 5s clock runs out, each team is auto-picked using their focus, point strategy, and wrestler strategy below.
            </p>
            <div style={{ marginBottom: 12 }}>
              <label htmlFor="prefs-team" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Edit preferences for</label>
              <select
                id="prefs-team"
                value={editingTeamPrefsFor}
                onChange={(e) => setEditingTeamPrefsFor(Number(e.target.value))}
                style={{ padding: "8px 12px", fontSize: 14, border: "1px solid var(--color-border)", borderRadius: "var(--radius)", minWidth: 120 }}
              >
                {Array.from({ length: teamCount }, (_, i) => (
                  <option key={i} value={i}>Team {i + 1}</option>
                ))}
              </select>
            </div>
            {(() => {
              const prefs = teamPreferences[editingTeamPrefsFor] ?? DEFAULT_AUTO_PREFS;
              const setPrefs = (next: { focus: AutoDraftFocus; pointStrategy: AutoDraftPointStrategy; wrestlerStrategy: AutoDraftWrestlerStrategy }) =>
                setTeamPreferences((prev) => ({ ...prev, [editingTeamPrefsFor]: next }));
              return (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <span style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Choose a focus</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {FOCUS_OPTIONS.map((opt) => (
                        <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
                          <input
                            type="radio"
                            name={`focus-${editingTeamPrefsFor}`}
                            checked={prefs.focus === opt.value}
                            onChange={() => setPrefs({ ...prefs, focus: opt.value })}
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <span style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Choose a point strategy</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {POINT_STRATEGY_OPTIONS.map((opt) => (
                        <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
                          <input
                            type="radio"
                            name={`point-${editingTeamPrefsFor}`}
                            checked={prefs.pointStrategy === opt.value}
                            onChange={() => setPrefs({ ...prefs, pointStrategy: opt.value })}
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 2 }}>Choose a wrestler strategy</span>
                    <span style={{ display: "block", fontSize: 11, color: "var(--color-text-muted)", marginBottom: 6 }}>Balanced Raw/SmackDown is by brand. High ranking males/females use total × 1.2.</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {WRESTLER_STRATEGY_OPTIONS.map((opt) => (
                        <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
                          <input
                            type="radio"
                            name={`wrestler-${editingTeamPrefsFor}`}
                            checked={prefs.wrestlerStrategy === opt.value}
                            onChange={() => setPrefs({ ...prefs, wrestlerStrategy: opt.value })}
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              );
            })()}
          </section>
        </section>
      )}

      {phase === "drafting" && (
        <>
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
              Pick {currentPick} of {totalPicks} — <strong>Team {currentTeamIndex! + 1}</strong> is on the clock
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  color: clockSeconds <= 10 ? "var(--color-red)" : "var(--color-text)",
                }}
                aria-live="polite"
              >
                {formatClock(clockSeconds)}
              </div>
              <button
                type="button"
                onClick={() => setPhase("complete")}
                style={{
                  padding: "8px 16px",
                  background: "var(--color-text-muted)",
                  color: "var(--color-text-inverse)",
                  border: "none",
                  borderRadius: "var(--radius)",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                End draft
              </button>
            </div>
          </section>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <h3 style={{ fontSize: "1rem", margin: 0 }}>Available wrestlers</h3>
                <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Points:</span>
                <select
                  aria-label="Points period"
                  value={pointsPeriod}
                  onChange={(e) => setPointsPeriod(e.target.value as PointsPeriod)}
                  style={{
                    padding: "6px 10px",
                    fontSize: 14,
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius)",
                    background: "var(--color-bg-input)",
                  }}
                >
                  <option value="2026">2026 YTD</option>
                  <option value="2025">2025</option>
                  <option value="all">All-time</option>
                </select>
                <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Rank = Total + (2K26 × 1.5)</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 14, color: "var(--color-text)" }}>Include:</span>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }} role="group" aria-label="Filter by roster">
                  {ROSTER_FILTER_OPTIONS.map(({ value, label }) => (
                    <label key={value} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={includedRosters.has(value)}
                        onChange={() => {
                          setIncludedRosters((prev) => {
                            const next = new Set(prev);
                            if (next.has(value)) next.delete(value);
                            else next.add(value);
                            return next;
                          });
                        }}
                        aria-label={`Include ${label}`}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setIncludedRosters(new Set(ROSTER_FILTER_OPTIONS.map((o) => o.value)))}
                  style={{
                    padding: "4px 8px",
                    fontSize: 12,
                    color: "var(--color-primary)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setIncludedRosters(new Set())}
                  style={{
                    padding: "4px 8px",
                    fontSize: 12,
                    color: "var(--color-text)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                  }}
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
              <div
                style={{
                  maxHeight: 420,
                  overflow: "auto",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius)",
                }}
              >
                {rankedAvailable.length === 0 ? (
                  <p style={{ color: "var(--color-text-muted)", margin: 16 }}>None left</p>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead style={{ position: "sticky", top: 0, background: "var(--color-bg-elevated)", zIndex: 1 }}>
                      <tr>
                        {([
                          { key: "brand" as const, label: "Roster", align: "center" as const },
                          { key: "rank" as const, label: "Rank", align: "left" as const },
                          { key: "name" as const, label: "Name", align: "left" as const },
                          { key: "gender" as const, label: "Gender", align: "center" as const },
                          { key: "age" as const, label: "Age", align: "center" as const },
                          { key: "2k" as const, label: "2K Rating", align: "center" as const, title: "2K26 if available, else 2K25" },
                          { key: "rs" as const, label: "R/S", align: "right" as const, title: "Raw/SmackDown" },
                          { key: "ple" as const, label: "PLE", align: "right" as const },
                          { key: "belt" as const, label: "Belt", align: "right" as const },
                          { key: "total" as const, label: "Total", align: "right" as const },
                        ] as { key: DraftTableSortColumn; label: string; align: "left" | "center" | "right"; title?: string }[]).map(({ key, label, align, title }) => (
                          <th key={key} style={{ padding: "8px 6px", textAlign: align, borderBottom: "1px solid var(--color-border)" }}>
                            <button
                              type="button"
                              onClick={() => handleSort(key)}
                              title={title ?? `Sort by ${label}`}
                              style={{
                                background: "none",
                                border: "none",
                                padding: 0,
                                font: "inherit",
                                fontWeight: 600,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              {label}
                              {tableSortColumn === key && (
                                <span style={{ fontSize: 10 }} aria-hidden>
                                  {tableSortDir === "asc" ? "↑" : "↓"}
                                </span>
                              )}
                            </button>
                          </th>
                        ))}
                        <th style={{ padding: "8px 6px", borderBottom: "1px solid var(--color-border)" }} />
                      </tr>
                    </thead>
                    <tbody>
                      {rankedAvailable.map(({ wrestler: w, rank, rs, ple, belt, total }) => {
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
                            <td
                              style={{ padding: "6px", whiteSpace: "nowrap" }}
                              aria-label={isInjured(getWrestlerStatus(w)) ? `${w.name ?? w.id}, Injured` : undefined}
                            >
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                {w.image_url ? (
                                  <img
                                    src={w.image_url}
                                    alt=""
                                    style={{
                                      width: 32,
                                      height: 32,
                                      objectFit: "cover",
                                      borderRadius: "50%",
                                      background: "var(--color-bg-input)",
                                    }}
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
                                {isInjured(getWrestlerStatus(w)) && (
                                  <>
                                    <InjuryBadge size={16} />
                                    <span style={{ color: "#c00", fontWeight: 600, fontSize: 11 }}>INJ</span>
                                  </>
                                )}
                              </span>
                              {w.currentChampionship && (
                                <div style={{ fontSize: 11, fontWeight: 500, color: "#b8860b", marginTop: 2 }}>
                                  {w.currentChampionship}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: "6px", textAlign: "center" }}>{normalizeGender(w.gender)}</td>
                            <td style={{ padding: "6px", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{calculateAge(w.dob) ?? "—"}</td>
                            <td style={{ padding: "6px", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{display2k != null ? display2k : "—"}</td>
                            <td style={{ padding: "6px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{rs}</td>
                            <td style={{ padding: "6px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{ple}</td>
                            <td style={{ padding: "6px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{belt}</td>
                            <td style={{ padding: "6px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{total}</td>
                            <td style={{ padding: "6px" }}>
                              <button
                                type="button"
                                onClick={() => makePick(w.id)}
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
                {Array.from({ length: teamCount }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      padding: 12,
                      background: currentTeamIndex === i ? "var(--color-success-bg)" : "var(--color-bg-elevated)",
                      borderRadius: "var(--radius)",
                      border: `1px solid ${currentTeamIndex === i ? "var(--color-success-muted)" : "var(--color-border)"}`,
                    }}
                  >
                    <strong style={{ fontSize: 14 }}>Team {i + 1}</strong>
                    <ul style={{ margin: "8px 0 0", paddingLeft: 0, listStyle: "none", fontSize: 14, color: "var(--color-text-muted)" }}>
                      {(picksByTeam[i] ?? []).map((id) => {
                        const w = wrestlers.find((x) => x.id === id);
                        return (
                          <li key={id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            {w?.image_url ? (
                              <img
                                src={w.image_url}
                                alt=""
                                style={{
                                  width: 28,
                                  height: 28,
                                  objectFit: "cover",
                                  borderRadius: "50%",
                                  background: "var(--color-bg-input)",
                                }}
                              />
                            ) : (
                              <span
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: "50%",
                                  background: "var(--color-bg-input)",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 11,
                                  color: "var(--color-text-muted)",
                                }}
                                aria-hidden
                              >
                                —
                              </span>
                            )}
                            <span>{w?.name ?? id}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {phase === "complete" && (
        <section
          style={{
            padding: 24,
            background: "var(--color-bg-elevated)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
          }}
        >
          <p style={{ fontWeight: 600, color: "var(--color-success-muted)", marginBottom: 16 }}>
            Draft complete.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {Array.from({ length: teamCount }, (_, i) => (
              <div key={i} style={{ padding: 12, background: "var(--color-bg-input)", borderRadius: "var(--radius)" }}>
                <strong>Team {i + 1}</strong>
                <ul style={{ margin: "8px 0 0", paddingLeft: 0, listStyle: "none", fontSize: 14 }}>
                  {(picksByTeam[i] ?? []).map((id) => {
                    const w = wrestlers.find((x) => x.id === id);
                    return (
                      <li key={id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        {w?.image_url ? (
                          <img
                            src={w.image_url}
                            alt=""
                            style={{
                              width: 28,
                              height: 28,
                              objectFit: "cover",
                              borderRadius: "50%",
                              background: "var(--color-bg-input)",
                            }}
                          />
                        ) : (
                          <span
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: "50%",
                              background: "var(--color-border)",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 11,
                              color: "var(--color-text-muted)",
                            }}
                            aria-hidden
                          >
                            —
                          </span>
                        )}
                        <span>{w?.name ?? id}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 16,
              padding: "10px 20px",
              background: "var(--color-text-muted)",
              color: "var(--color-text-inverse)",
              border: "none",
              borderRadius: "var(--radius)",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Run another test draft
          </button>
        </section>
      )}
    </div>
  );
}
