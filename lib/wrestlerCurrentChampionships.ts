import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrentChampionFromChanges } from "@/lib/championshipCurrentFromChanges";
import { getCurrentChampionsFromChanges } from "@/lib/championshipCurrentFromChanges";
import { getCurrentChampionsFromChampionshipsTable } from "@/lib/championshipCurrentFromTable";
import { getBeltImageUrlForTitle } from "@/lib/championshipBeltOverlay";
import { getChampionshipHistoryDataset } from "@/lib/championshipData";
import { compareChampionshipTitleNames } from "@/lib/championshipDisplayOrder";
import { getPwbsChampionshipPage } from "@/lib/pwbsChampionshipSlug.js";
import { getCurrentChampionsBySlug } from "@/lib/scoring/endOfMonthBeltPoints.js";
import {
  mergeCurrentChampionTitleStrings,
  mergeGetCurrentChampionFromMap,
} from "@/lib/scoring/draftAliasListMerge";
import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";

export type WrestlerCurrentChampionshipInfo = {
  titles: string[];
  displayLine: string | null;
  primaryTitle: string | null;
  beltImageUrl: string | null;
};

export type WrestlerCurrentChampionshipContext = {
  resolve: (w: { id: string; name: string; gender?: string | null }) => WrestlerCurrentChampionshipInfo;
};

function dedupeChampionshipTitlesForDisplay(titles: string[]): string[] {
  const bySlug = new Map<string, string>();
  for (const raw of titles) {
    const t = raw?.trim();
    if (!t) continue;
    const page = getPwbsChampionshipPage(t);
    const key = page?.slug ?? `literal:${t.toLowerCase()}`;
    const label = page?.displayTitle ?? t;
    if (!bySlug.has(key)) bySlug.set(key, label);
  }
  return [...bySlug.values()].sort((a, b) => compareChampionshipTitleNames(a, b));
}

function titleKeyForChampionshipName(title: string): string {
  const page = getPwbsChampionshipPage(title);
  return page?.slug ?? `literal:${title.toLowerCase()}`;
}

/** Invert slug→titles so we can tell when reign history already names a current holder per belt. */
function currentHolderSlugsByTitleKey(
  currentChampionsBySlug: Record<string, string[]>
): Map<string, Set<string>> {
  const byTitle = new Map<string, Set<string>>();
  for (const [wrestlerSlug, titles] of Object.entries(currentChampionsBySlug)) {
    for (const rawTitle of titles) {
      const t = rawTitle?.trim();
      if (!t) continue;
      const key = titleKeyForChampionshipName(t);
      if (!byTitle.has(key)) byTitle.set(key, new Set());
      byTitle.get(key)!.add(wrestlerSlug);
    }
  }
  return byTitle;
}

function snapshotSupplementalTitles(
  w: { id: string; name: string },
  currentFromTable: Record<string, CurrentChampionFromChanges>,
  currentFromChanges: Record<string, CurrentChampionFromChanges>,
  holderSlugsByTitle: Map<string, Set<string>>
): string[] {
  const slugKey = w.id;
  const nameKey = w.name ? normalizeWrestlerName(w.name) : "";
  const idKey = normalizeWrestlerName(String(w.id));

  const snap =
    currentFromTable[idKey] ??
    mergeGetCurrentChampionFromMap(currentFromTable, slugKey, nameKey) ??
    currentFromChanges[idKey] ??
    mergeGetCurrentChampionFromMap(currentFromChanges, slugKey, nameKey);
  if (!snap?.title) return [];

  const titleKey = titleKeyForChampionshipName(snap.title);
  const holders = holderSlugsByTitle.get(titleKey);
  // Reign history is authoritative when it names a current holder; ignore stale table/change rows.
  if (holders && holders.size > 0) return [];

  return [snap.title];
}

/** Same championship resolution as free agents / league leaders (exported for league pages). */
export function resolveWrestlerChampionshipTitles(
  w: { id: string; name: string },
  currentChampionsBySlug: Record<string, string[]>,
  currentFromTable: Record<string, CurrentChampionFromChanges>,
  currentFromChanges: Record<string, CurrentChampionFromChanges>
): string[] {
  const slugKey = w.id;
  const nameKey = w.name ? normalizeWrestlerName(w.name) : "";
  const idKey = normalizeWrestlerName(String(w.id));
  const canonicalKey = nameKey || (slugKey ? normalizeWrestlerName(String(slugKey)) : "") || slugKey;

  const directChampTitles =
    currentChampionsBySlug[canonicalKey] ?? currentChampionsBySlug[idKey] ?? null;
  const aliasChampTitles = mergeCurrentChampionTitleStrings(currentChampionsBySlug, slugKey, nameKey);

  const titlesFromHistory: string[] = [];
  const seen = new Set<string>();
  for (const list of [directChampTitles, aliasChampTitles]) {
    if (!list) continue;
    for (const t of list) {
      if (t && !seen.has(t)) {
        seen.add(t);
        titlesFromHistory.push(t);
      }
    }
  }

  const holderSlugsByTitle = currentHolderSlugsByTitleKey(currentChampionsBySlug);
  const supplemental = snapshotSupplementalTitles(w, currentFromTable, currentFromChanges, holderSlugsByTitle);
  return dedupeChampionshipTitlesForDisplay([...titlesFromHistory, ...supplemental]);
}

function resolveTitlesForWrestler(
  w: { id: string; name: string },
  currentChampionsBySlug: Record<string, string[]>,
  currentFromTable: Record<string, CurrentChampionFromChanges>,
  currentFromChanges: Record<string, CurrentChampionFromChanges>
): string[] {
  return resolveWrestlerChampionshipTitles(w, currentChampionsBySlug, currentFromTable, currentFromChanges);
}

/** Same championship resolution as free agents / league leaders. */
export async function loadWrestlerCurrentChampionshipContext(
  supabase: SupabaseClient
): Promise<WrestlerCurrentChampionshipContext> {
  const [{ reigns }, currentFromTable, currentFromChanges] = await Promise.all([
    getChampionshipHistoryDataset(),
    getCurrentChampionsFromChampionshipsTable(supabase).catch(
      (): Record<string, CurrentChampionFromChanges> => ({})
    ),
    getCurrentChampionsFromChanges(supabase).catch((): Record<string, CurrentChampionFromChanges> => ({})),
  ]);

  const currentChampionsBySlug = getCurrentChampionsBySlug(reigns);

  return {
    resolve(w) {
      const titles = resolveTitlesForWrestler(
        { id: w.id, name: w.name },
        currentChampionsBySlug,
        currentFromTable,
        currentFromChanges
      );
      const primaryTitle = titles[0] ?? null;
      return {
        titles,
        displayLine: titles.length > 0 ? titles.join(", ") : null,
        primaryTitle,
        beltImageUrl: primaryTitle ? getBeltImageUrlForTitle(primaryTitle, w.gender ?? null) : null,
      };
    },
  };
}
