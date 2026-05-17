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

function resolveTitlesForWrestler(
  w: { id: string; name: string },
  currentChampionsBySlug: Record<string, string[]>,
  currentFromTable: Record<string, CurrentChampionFromChanges>,
  currentFromChanges: Record<string, CurrentChampionFromChanges>
): string[] {
  const slugKey = w.id;
  const nameKey = w.name ? normalizeWrestlerName(w.name) : "";
  const idKey = normalizeWrestlerName(String(w.id));
  const canonicalKey = nameKey || (slugKey ? normalizeWrestlerName(String(slugKey)) : "") || slugKey;

  const fromTable =
    currentFromTable[idKey] ?? mergeGetCurrentChampionFromMap(currentFromTable, slugKey, nameKey) ?? null;
  const fromChanges =
    currentFromChanges[idKey] ?? mergeGetCurrentChampionFromMap(currentFromChanges, slugKey, nameKey) ?? null;

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

  const primaryTitle = (fromTable ?? fromChanges) ? (fromTable ?? fromChanges)!.title : (titlesFromHistory[0] ?? null);
  const titles = primaryTitle ? [primaryTitle] : titlesFromHistory;
  return dedupeChampionshipTitlesForDisplay(titles);
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
