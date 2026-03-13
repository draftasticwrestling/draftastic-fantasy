/**
 * Read current champions from the Supabase `championships` table
 * (id, title_name, current_champion, current_champion_slug).
 * Use this when your source of truth is the championships table rather than
 * championship_history or championship_changes.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";
import { getTagTeamMemberSlugs, parseTagTeamChampionToMemberSlugs } from "@/lib/scoring/tagTeamMembers.js";

const TABLE_NAME = "championships";

/** Same shape as CurrentChampionFromChanges for easy merging. wonDate may be empty. */
export type CurrentChampionFromTable = {
  title: string;
  wonDate: string;
};

const TAG_TEAM_IDS = new Set([
  "raw-tag-team-championship",
  "smackdown-tag-team-championship",
  "womens-tag-team-championship",
  "world-tag-team-championship",
]);

/**
 * Fetch current champions from the championships table.
 * Returns a map from canonical slug to { title, wonDate }.
 * Tag team rows are expanded so both members get the title.
 */
export async function getCurrentChampionsFromChampionshipsTable(
  db: SupabaseClient
): Promise<Record<string, CurrentChampionFromTable>> {
  type Row = {
    id?: string | null;
    title_name?: string | null;
    current_champion?: string | null;
    current_champion_slug?: string | null;
  };
  const { data: rows, error } = await db
    .from(TABLE_NAME)
    .select("id, title_name, current_champion, current_champion_slug");

  if (error || !rows?.length) return {};

  const result: Record<string, CurrentChampionFromTable> = {};
  for (const r of rows as Row[]) {
    const id = (r.id ?? "").toString().trim().toLowerCase();
    const title = (r.title_name ?? "").toString().trim() || id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const champion = (r.current_champion ?? "").toString().trim();
    const championSlug = (r.current_champion_slug ?? "").toString().trim() || null;
    const slugKey = championSlug ? normalizeWrestlerName(championSlug) : normalizeWrestlerName(champion);
    if (!title) continue;

    const entry: CurrentChampionFromTable = { title, wonDate: "" };
    const isTagTeam = TAG_TEAM_IDS.has(id);

    if (isTagTeam) {
      const memberSlugs =
        getTagTeamMemberSlugs(slugKey) ?? parseTagTeamChampionToMemberSlugs(champion || championSlug || "");
      if (memberSlugs?.length) {
        for (const memberSlug of memberSlugs) {
          const key = normalizeWrestlerName(memberSlug) || memberSlug;
          result[key] = entry;
        }
      } else {
        if (slugKey) result[slugKey] = entry;
        if (champion && normalizeWrestlerName(champion) !== slugKey) result[normalizeWrestlerName(champion)] = entry;
      }
    } else {
      if (slugKey) result[slugKey] = entry;
      if (champion && normalizeWrestlerName(champion) !== slugKey) result[normalizeWrestlerName(champion)] = entry;
    }
  }
  return result;
}
