import { computeDaysHeld } from "@/lib/boxscoreAdmin/championshipSync";
import { canonicalChampionshipSlugFromId } from "@/lib/championshipTitleHistory";
import {
  compareNxtChampionshipSlugs,
  isNxtChampionshipSlug,
} from "@/lib/championshipDisplayOrder";
import {
  comparePwbsChampionshipSlugs,
  getPwbsChampionshipPage,
  getPwbsReignGroupKey,
} from "@/lib/pwbsChampionshipSlug.js";

function compareChampionshipsForSiteDisplay(slugA: string, slugB: string): number {
  if (isNxtChampionshipSlug(slugA) && isNxtChampionshipSlug(slugB)) {
    return compareNxtChampionshipSlugs(slugA, slugB);
  }
  return comparePwbsChampionshipSlugs(slugA, slugB);
}

/** Slug used for display order — matches /championship index sort. */
export function championshipPublicSortSlug(row: {
  id: string;
  title_name?: string | null;
}): string {
  const fromTitle = getPwbsChampionshipPage(row.title_name ?? "");
  if (fromTitle) return fromTitle.slug;
  const fromId = canonicalChampionshipSlugFromId(row.id);
  if (fromId) return fromId;
  return getPwbsReignGroupKey(row.title_name);
}

/** Same order as the public /championship page (PWBS slug order). */
export function sortChampionshipsForPublicDisplay<T extends { id: string; title_name?: string | null }>(
  rows: T[]
): T[] {
  return [...rows].sort((a, b) =>
    compareChampionshipsForSiteDisplay(championshipPublicSortSlug(a), championshipPublicSortSlug(b))
  );
}

/** Format YYYY-MM-DD for admin tables (local calendar, no UTC shift). */
export function formatChampionshipAdminDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const s = String(dateStr).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function displayHistoryDaysHeld(row: {
  date_won?: string | null;
  date_lost?: string | null;
  days_held?: number | null;
}): string {
  if (row.days_held != null && Number.isFinite(Number(row.days_held))) {
    return String(Math.trunc(Number(row.days_held)));
  }
  const lost = row.date_lost?.trim();
  if (!lost) return "—";
  const days = computeDaysHeld(String(row.date_won ?? "").slice(0, 10), lost.slice(0, 10));
  return days != null ? String(days) : "—";
}
