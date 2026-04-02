import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";
import { getPwbsChampionshipPage, getPwbsDisplayTitleForSlug } from "@/lib/pwbsChampionshipSlug.js";
import { titleToChampionshipSlug } from "@/lib/championshipPathSlug";

/** Championship history row shape (Pro Wrestling Boxscore / Supabase). */
export type ChampionshipReignRow = {
  champion_slug?: string | null;
  champion_id?: string | null;
  champion?: string | null;
  champion_name?: string | null;
  title?: string | null;
  title_name?: string | null;
  won_date?: string | null;
  start_date?: string | null;
  lost_date?: string | null;
  end_date?: string | null;
  /** Pro Wrestling Boxscore: stable id matching /championship/{id} (e.g. wwe-championship). */
  championship_id?: string | null;
  /** Boxscore-computed reign length when present. */
  days_held?: number | null;
};

export type TitleHistoryItem = {
  champion: string;
  championSlug: string;
  wonDate: string;
  lostDate: string | null;
  imageUrl: string | null;
  /** Who lost the title to this champion (from DB or previous reign). */
  defeated: string | null;
  defeatedSlug: string | null;
  eventWon: string | null;
  eventLost: string | null;
  /** From Boxscore `days_held` when set (preferred for display vs computed). */
  daysHeldDb: number | null;
};

function readOptionalString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

/**
 * Reads optional Boxscore/PWBS columns from a championship_history row (snake_case aliases).
 */
export function reignDetailsFromRow(row: Record<string, unknown>): {
  defeated: string | null;
  defeatedSlug: string | null;
  eventWon: string | null;
  eventLost: string | null;
} {
  return {
    defeated: readOptionalString(row, [
      "previous_champion",
      "previous_champion_name",
      "defeated",
      "defeated_name",
      "beaten_wrestler",
      "beat",
    ]),
    defeatedSlug: readOptionalString(row, [
      "previous_champion_slug",
      "defeated_slug",
      "beaten_wrestler_slug",
    ]),
    eventWon: readOptionalString(row, [
      "event_name",
      "event_won",
      "won_event",
      "won_event_name",
      "event_name_won",
      "won_at_event",
    ]),
    eventLost: readOptionalString(row, [
      "event_lost",
      "lost_event",
      "lost_event_name",
      "event_name_lost",
      "lost_at_event",
    ]),
  };
}

/**
 * Fill defeated (previous champion) and event lost (next reign's event won) when not in DB.
 */
export function enrichTitleHistoryItems(items: TitleHistoryItem[]): TitleHistoryItem[] {
  if (items.length === 0) return items;
  const asc = [...items].sort((a, b) => a.wonDate.localeCompare(b.wonDate));
  return asc.map((item, i) => {
    const prev = i > 0 ? asc[i - 1] : null;
    const next = i < asc.length - 1 ? asc[i + 1] : null;
    return {
      ...item,
      defeated: item.defeated ?? (prev ? prev.champion : null),
      defeatedSlug: item.defeatedSlug ?? (prev ? prev.championSlug : null),
      eventLost: item.eventLost ?? (next?.eventWon ?? null),
    };
  });
}

/** One championship route (PWBS slug) with display title and reign rows. */
export type TitleHistoryBucket = {
  displayTitle: string;
  items: TitleHistoryItem[];
};

type WrestlerMini = {
  id: string;
  name: string | null;
  image_url: string | null;
  gender: string | null;
};

/**
 * One history row per reign; same title may appear many times (sorted by caller).
 */
export function buildTitleHistoryByTitle(
  reigns: ChampionshipReignRow[],
  wrestlerBySlug: Map<string, WrestlerMini>,
  wrestlerByNameKey: Map<string, WrestlerMini>
): Map<string, TitleHistoryItem[]> {
  const titleHistoryByTitle = new Map<string, TitleHistoryItem[]>();

  for (const r of reigns) {
    const title = (r.title ?? r.title_name ?? "").trim();
    if (!title) continue;
    const wonDate = (r.won_date ?? r.start_date ?? "").slice(0, 10);
    if (!wonDate) continue;
    const lostDate = (r.lost_date ?? r.end_date ?? null)?.slice(0, 10) ?? null;
    const rawSlug = (r.champion_slug ?? r.champion_id ?? "").trim();
    const championSlug = normalizeWrestlerName(rawSlug || (r.champion ?? r.champion_name ?? ""));
    const fromSlug = championSlug ? wrestlerBySlug.get(championSlug) : null;
    const fromName = !fromSlug && r.champion ? wrestlerByNameKey.get(normalizeWrestlerName(r.champion)) : null;
    const championName = (
      fromSlug?.name ??
      fromName?.name ??
      r.champion ??
      r.champion_name ??
      championSlug
    ).toString();
    const imageUrl = fromSlug?.image_url ?? fromName?.image_url ?? null;
    const d = reignDetailsFromRow(r as Record<string, unknown>);
    const list = titleHistoryByTitle.get(title) ?? [];
    list.push({
      champion: championName,
      championSlug,
      wonDate,
      lostDate,
      imageUrl,
      defeated: d.defeated,
      defeatedSlug: d.defeatedSlug,
      eventWon: d.eventWon,
      eventLost: d.eventLost,
      daysHeldDb:
        r.days_held != null && Number.isFinite(Number(r.days_held))
          ? Math.trunc(Number(r.days_held))
          : null,
    });
    titleHistoryByTitle.set(title, list);
  }

  return titleHistoryByTitle;
}

/**
 * Bucket reigns by Pro Wrestling Boxscore championship slug (e.g. mens-ic-championship) so
 * DB title variants (e.g. "Undisputed WWE Championship") merge into one page.
 */
export function buildTitleHistoryByChampionshipSlug(
  reigns: ChampionshipReignRow[],
  wrestlerBySlug: Map<string, WrestlerMini>,
  wrestlerByNameKey: Map<string, WrestlerMini>
): Map<string, TitleHistoryBucket> {
  const bySlug = new Map<string, TitleHistoryBucket>();

  for (const r of reigns) {
    const cid = (r.championship_id ?? "").trim();
    const rawTitle = (r.title ?? r.title_name ?? "").trim();
    if (!cid && !rawTitle) continue;

    let slug: string;
    let displayTitle: string;
    let page: ReturnType<typeof getPwbsChampionshipPage> = null;
    if (cid) {
      slug = cid;
      displayTitle = getPwbsDisplayTitleForSlug(cid) ?? (rawTitle || cid);
    } else {
      page = getPwbsChampionshipPage(rawTitle);
      slug = page?.slug ?? titleToChampionshipSlug(rawTitle);
      displayTitle = page?.displayTitle ?? rawTitle;
    }
    const wonDate = (r.won_date ?? r.start_date ?? "").slice(0, 10);
    if (!wonDate) continue;
    const lostDate = (r.lost_date ?? r.end_date ?? null)?.slice(0, 10) ?? null;
    const rawSlug = (r.champion_slug ?? r.champion_id ?? "").trim();
    const championSlug = normalizeWrestlerName(rawSlug || (r.champion ?? r.champion_name ?? ""));
    const fromSlug = championSlug ? wrestlerBySlug.get(championSlug) : null;
    const fromName = !fromSlug && r.champion ? wrestlerByNameKey.get(normalizeWrestlerName(r.champion)) : null;
    const championName = (
      fromSlug?.name ??
      fromName?.name ??
      r.champion ??
      r.champion_name ??
      championSlug
    ).toString();
    const imageUrl = fromSlug?.image_url ?? fromName?.image_url ?? null;
    const d = reignDetailsFromRow(r as Record<string, unknown>);

    let bucket = bySlug.get(slug);
    if (!bucket) {
      bucket = { displayTitle, items: [] };
      bySlug.set(slug, bucket);
    } else if (cid) {
      bucket.displayTitle = getPwbsDisplayTitleForSlug(cid) ?? bucket.displayTitle;
    } else if (page) {
      bucket.displayTitle = page.displayTitle;
    }

    const daysHeldDb =
      r.days_held != null && Number.isFinite(Number(r.days_held))
        ? Math.trunc(Number(r.days_held))
        : null;

    bucket.items.push({
      champion: championName,
      championSlug,
      wonDate,
      lostDate,
      imageUrl,
      defeated: d.defeated,
      defeatedSlug: d.defeatedSlug,
      eventWon: d.eventWon,
      eventLost: d.eventLost,
      daysHeldDb,
    });
  }

  return bySlug;
}

export function displayChampionshipDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const s = String(iso).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const [y, m, d] = s.split("-");
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Calendar days inclusive of start, exclusive of end (ongoing = through today). */
export function reignLengthDays(wonYmd: string, lostYmd: string | null): number | null {
  const a = Date.parse(`${wonYmd.slice(0, 10)}T12:00:00`);
  const end = lostYmd ? Date.parse(`${lostYmd.slice(0, 10)}T12:00:00`) : Date.now();
  if (!Number.isFinite(a) || !Number.isFinite(end)) return null;
  const ms = end - a;
  if (ms < 0) return null;
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}
