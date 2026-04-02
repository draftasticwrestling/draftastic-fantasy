import { titleToChampionshipSlug } from "@/lib/championshipPathSlug";
import type { ChampionshipReignRow } from "@/lib/championshipTitleHistory";
import { displayChampionshipDate, reignDetailsFromRow } from "@/lib/championshipTitleHistory";
import { getPwbsDisplayTitleForSlug, getPwbsReignGroupKey } from "@/lib/pwbsChampionshipSlug.js";
import { getFantasyBeltMonthEndsForReign } from "@/lib/scoring/endOfMonthBeltPoints.js";

export type WrestlerProfileReignLine = {
  displayTitle: string;
  /** Route slug for /championship/[slug] */
  routeSlug: string;
  wonYmd: string;
  lostYmd: string | null;
  eventWon: string | null;
  eventLost: string | null;
  /** Stable key for list rendering (Supabase row id or synthetic). */
  rowKey: string;
  /** Month labels (e.g. "January 2025") when this reign earns fantasy end-of-month belt hold credit. */
  beltMonthEndsFormatted: string[];
};

/** "January 2025" from a month-end YYYY-MM-DD (last day of month). */
export function formatMonthEndLabel(monthEndYmd: string): string {
  const [y, m] = monthEndYmd.split("-");
  if (!y || !m) return monthEndYmd;
  const month = new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-US", { month: "long" });
  return `${month} ${y}`;
}

export type BuildWrestlerProfileReignLinesBeltOpts = {
  firstMonthEnd: string;
  wrestlerId: string;
  urlSlug: string;
};

/** Same parsing as Pro Wrestling Boxscore `WrestlerProfile.jsx` (wrestlers.accomplishments column). */
export function parseWrestlerAccomplishmentsColumn(raw: string | null | undefined): string[] {
  const text = (raw ?? "").trim();
  if (!text) return [];
  return text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function reignRowDedupeKey(r: ChampionshipReignRow): string {
  const o = r as Record<string, unknown>;
  if (o.id != null && String(o.id).trim() !== "") return `id:${o.id}`;
  const won = (r.won_date ?? r.start_date ?? "").slice(0, 10);
  const cid = (r.championship_id ?? "").trim();
  const cs = (r.champion_slug ?? "").trim();
  return `syn:${cid}|${won}|${cs}|${(r.champion ?? "").slice(0, 80)}`;
}

/**
 * Match championship_history rows to a profile the same way PWBS WrestlerProfile does:
 * champion_slug = url slug, tag-team reigns via tag_team_members, then name exact / contains.
 */
export function collectWrestlerChampionshipHistoryForProfile(
  allRows: ChampionshipReignRow[],
  opts: {
    urlSlug: string;
    wrestlerId: string;
    wrestlerName: string | null | undefined;
    tagTeamIds: readonly string[];
  }
): ChampionshipReignRow[] {
  const slugLower = opts.urlSlug.trim().toLowerCase();
  const idLower = opts.wrestlerId.trim().toLowerCase();
  const nameTrimmed = (opts.wrestlerName ?? "").trim();
  const nameLower = nameTrimmed.toLowerCase();
  const teamSet = new Set(opts.tagTeamIds.map((t) => t.trim().toLowerCase()).filter(Boolean));

  const seen = new Set<string>();
  const out: ChampionshipReignRow[] = [];

  const push = (r: ChampionshipReignRow) => {
    const k = reignRowDedupeKey(r);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(r);
  };

  for (const r of allRows) {
    const cs = (r.champion_slug ?? "").trim();
    const csLower = cs.toLowerCase();

    if (cs && (csLower === slugLower || csLower === idLower)) {
      push(r);
      continue;
    }

    if (cs && teamSet.has(csLower)) {
      push(r);
      continue;
    }

    if (nameTrimmed) {
      const ch = (r.champion ?? "").trim();
      const chLower = ch.toLowerCase();
      if (chLower === nameLower) {
        const slugEmpty = cs === "";
        const slugMatches = csLower === slugLower;
        if (slugEmpty || slugMatches) push(r);
      }
    }
  }

  if (nameTrimmed) {
    const nameLowerInner = nameLower;
    for (const r of allRows) {
      const chLower = (r.champion ?? "").toLowerCase();
      if (chLower.includes(nameLowerInner)) push(r);
    }
  }

  out.sort((a, b) => {
    const ax = (a.won_date ?? a.start_date ?? "").slice(0, 10);
    const bx = (b.won_date ?? b.start_date ?? "").slice(0, 10);
    return bx.localeCompare(ax);
  });

  return out;
}

function routeSlugForReign(r: ChampionshipReignRow): string {
  const cid = (r.championship_id ?? "").trim();
  if (cid) return cid;
  const rawTitle = (r.title ?? r.title_name ?? "").trim();
  const g = getPwbsReignGroupKey(rawTitle);
  if (g) return g;
  return titleToChampionshipSlug(rawTitle);
}

function displayTitleForReign(r: ChampionshipReignRow): string {
  const cid = (r.championship_id ?? "").trim();
  const rawTitle = (r.title ?? r.title_name ?? "").trim();
  if (cid) return (getPwbsDisplayTitleForSlug(cid) ?? rawTitle) || cid;
  const g = getPwbsReignGroupKey(rawTitle);
  if (g) return (getPwbsDisplayTitleForSlug(g) ?? rawTitle) || g;
  return rawTitle || "Championship";
}

/**
 * One line per championship_history reign for this wrestler (newest first).
 * When `beltOpts` is set, each line includes fantasy end-of-month belt months (same rules as monthly belt scoring).
 */
export function buildWrestlerProfileReignLines(
  reigns: ChampionshipReignRow[],
  beltOpts?: BuildWrestlerProfileReignLinesBeltOpts
): WrestlerProfileReignLine[] {
  const lines: WrestlerProfileReignLine[] = [];
  for (const r of reigns) {
    const won = (r.won_date ?? r.start_date ?? "").slice(0, 10);
    if (!won) continue;
    const lostRaw = r.lost_date ?? r.end_date ?? null;
    const lostYmd = lostRaw != null && String(lostRaw).trim() !== "" ? String(lostRaw).slice(0, 10) : null;
    const d = reignDetailsFromRow(r as Record<string, unknown>);
    const o = r as Record<string, unknown>;
    const rowKey =
      o.id != null && String(o.id).trim() !== ""
        ? String(o.id)
        : `${routeSlugForReign(r)}-${won}-${lostYmd ?? "present"}`;
    const rawBeltEnds =
      beltOpts != null
        ? getFantasyBeltMonthEndsForReign(r, beltOpts.firstMonthEnd, beltOpts.wrestlerId, beltOpts.urlSlug)
        : [];
    const beltMonthEndsFormatted = rawBeltEnds.map(formatMonthEndLabel);
    lines.push({
      displayTitle: displayTitleForReign(r),
      routeSlug: routeSlugForReign(r),
      wonYmd: won,
      lostYmd,
      eventWon: d.eventWon,
      eventLost: d.eventLost,
      rowKey,
      beltMonthEndsFormatted,
    });
  }
  lines.sort((a, b) => b.wonYmd.localeCompare(a.wonYmd));
  return lines;
}

/** PWBS-style middle segment after the title (dates + event). */
export function formatProfileTitleHistoryTail(line: WrestlerProfileReignLine): string {
  const won = displayChampionshipDate(line.wonYmd);
  if (!line.lostYmd) {
    const ev = line.eventWon ? ` (${line.eventWon})` : "";
    return `Won ${won} · Present${ev}`;
  }
  const lost = displayChampionshipDate(line.lostYmd);
  const ev = line.eventLost ? ` (${line.eventLost})` : line.eventWon ? ` (${line.eventWon})` : "";
  return `Won ${won} · ${lost}${ev}`;
}
