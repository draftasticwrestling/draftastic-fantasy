import { getPwbsDisplayTitleForSlug } from "@/lib/pwbsChampionshipSlug.js";
import type { ChampionshipReignRow } from "@/lib/championshipTitleHistory";

function sliceYmd(v: unknown): string {
  if (v == null || v === "") return "";
  return String(v).slice(0, 10);
}

/**
 * True when this row is from Pro Wrestling Boxscore's championship_history shape
 * (championship_id + date_won), not the older fantasy-only column names.
 */
export function isBoxscoreChampionshipHistoryRow(raw: Record<string, unknown>): boolean {
  const cid = raw.championship_id;
  return typeof cid === "string" ? cid.trim() !== "" : cid != null && String(cid).trim() !== "";
}

/**
 * Map Boxscore `championship_history` columns to the shape used by scoring + title pages.
 * - date_won / date_lost → won_date / lost_date (and start/end aliases)
 * - championship_id → synthetic title string for PWBS slug grouping when title is absent
 */
export function normalizeChampionshipHistoryRow(raw: Record<string, unknown>): ChampionshipReignRow {
  const cid =
    raw.championship_id != null && String(raw.championship_id).trim() !== ""
      ? String(raw.championship_id).trim()
      : "";

  const won = sliceYmd(raw.date_won ?? raw.won_date ?? raw.start_date);
  const lostRaw = raw.date_lost ?? raw.lost_date ?? raw.end_date;
  const lostStr =
    lostRaw != null && String(lostRaw).trim() !== "" ? sliceYmd(lostRaw) : "";
  const lostFinal = lostStr || null;

  const syntheticTitle = cid ? (getPwbsDisplayTitleForSlug(cid) ?? "") : "";
  const existingTitle = raw.title != null ? String(raw.title).trim() : "";
  const existingTitleName = raw.title_name != null ? String(raw.title_name).trim() : "";
  const title = existingTitle || existingTitleName || syntheticTitle || undefined;

  const dh = raw.days_held;
  const daysHeld =
    dh != null && dh !== "" && Number.isFinite(Number(dh)) ? Math.trunc(Number(dh)) : undefined;

  return {
    ...raw,
    champion_slug: raw.champion_slug != null ? String(raw.champion_slug) : null,
    champion_id:
      raw.champion_id != null
        ? String(raw.champion_id)
        : raw.champion_slug != null
          ? String(raw.champion_slug)
          : null,
    champion: raw.champion != null ? String(raw.champion) : null,
    champion_name:
      raw.champion_name != null
        ? String(raw.champion_name)
        : raw.champion != null
          ? String(raw.champion)
          : null,
    title: title ?? null,
    title_name: (existingTitleName || title) ?? null,
    won_date: won || null,
    start_date: won || sliceYmd(raw.start_date) || null,
    lost_date: lostFinal,
    end_date: lostFinal,
    championship_id: cid || null,
    days_held: daysHeld ?? null,
  } as ChampionshipReignRow;
}
