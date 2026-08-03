import { cache } from "react";
import { getChampionshipHistoryDataset } from "@/lib/championshipData";
import { compareChampionshipTitleNames } from "@/lib/championshipDisplayOrder";
import {
  formatChampionshipTitleForHolder,
  stripChampionshipTitleHolderSuffix,
} from "@/lib/championshipReignKind";
import { getPwbsChampionshipPage } from "@/lib/pwbsChampionshipSlug.js";
import { getCurrentChampionsBySlug } from "@/lib/scoring/endOfMonthBeltPoints.js";
import { mergeCurrentChampionTitleStrings } from "@/lib/scoring/draftAliasListMerge";
import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";

function sortTitleNames(titles: string[]): string[] {
  return [...titles].sort((a, b) =>
    compareChampionshipTitleNames(
      stripChampionshipTitleHolderSuffix(a),
      stripChampionshipTitleHolderSuffix(b)
    )
  );
}

/** Collapse aliases (e.g. "Women's Speed Championship" vs "NXT Women's Speed Championship") to one PWBS label. */
function dedupeChampionshipTitlesForDisplay(titles: string[]): string[] {
  const bySlug = new Map<string, string>();
  for (const raw of titles) {
    const t = raw?.trim();
    if (!t) continue;
    const base = stripChampionshipTitleHolderSuffix(t);
    const isInterim = / \(Interim\)$/i.test(t);
    const page = getPwbsChampionshipPage(base);
    const key = page?.slug ?? `literal:${base.toLowerCase()}`;
    const displayBase = page?.displayTitle ?? base;
    const label = isInterim ? formatChampionshipTitleForHolder(displayBase, "interim") : displayBase;
    const existing = bySlug.get(key);
    if (!existing || (isInterim && !/ \(Interim\)$/i.test(existing))) {
      bySlug.set(key, label);
    }
  }
  return [...bySlug.values()];
}

/**
 * Real-world title(s) each roster wrestler currently holds (same sources as /wrestlers grid).
 * Keys are wrestler URL slugs (`wrestlers.id`).
 */
export const getMatchupWrestlerChampionTitleLineBySlug = cache(
  async (
    wrestlerSlugs: string[],
    displayNameBySlug: Record<string, string>
  ): Promise<Record<string, string | null>> => {
    const unique = [...new Set(wrestlerSlugs.map((s) => String(s).trim()).filter(Boolean))];
    const out: Record<string, string | null> = {};
    if (unique.length === 0) return out;

    const { reigns } = await getChampionshipHistoryDataset();
    const currentChampionsBySlug = getCurrentChampionsBySlug(reigns);

    for (const slugKey of unique) {
      const rawName = displayNameBySlug[slugKey] ?? "";
      const nameKey = rawName ? normalizeWrestlerName(rawName) : "";
      const idKey = normalizeWrestlerName(String(slugKey));
      const canonicalKey = nameKey || (slugKey ? normalizeWrestlerName(String(slugKey)) : "") || slugKey;

      const directChamp =
        currentChampionsBySlug[canonicalKey] ?? currentChampionsBySlug[idKey] ?? null;
      const aliasChamp = mergeCurrentChampionTitleStrings(currentChampionsBySlug, slugKey, nameKey);

      const titles: string[] = [];
      const seen = new Set<string>();
      for (const list of [directChamp, aliasChamp]) {
        if (!list) continue;
        for (const t of list) {
          if (t && !seen.has(t)) {
            seen.add(t);
            titles.push(t);
          }
        }
      }

      const ordered = sortTitleNames(dedupeChampionshipTitlesForDisplay(titles));
      out[slugKey] = ordered.length > 0 ? ordered.join(", ") : null;
    }

    return out;
  }
);
