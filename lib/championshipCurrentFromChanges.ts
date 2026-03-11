/**
 * Optional: read current champions from a "title changes" table (e.g. from Boxscore)
 * where each row is a change: championship_type, champion, champion_slug, date.
 * The latest row per championship_type = current champion.
 * Use when championship_history is empty or not synced but this table has the data.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";

const CHANGES_TABLE = process.env.CHAMPIONSHIP_CHANGES_TABLE ?? "championship_changes";

/** Map championship_type (e.g. wwe-championship) to display title name. */
const TYPE_TO_TITLE: Record<string, string> = {
  "wwe-championship": "Undisputed WWE Championship",
  "world-heavyweight-championship": "World Heavyweight Championship",
  "womens-world-championship": "Women's World Championship",
  "wwe-womens-championship": "WWE Women's Championship",
  "intercontinental-championship": "Intercontinental Championship",
  "womens-intercontinental-championship": "Women's Intercontinental Championship",
  "united-states-championship": "United States Championship",
  "womens-united-states-championship": "Women's United States Championship",
  "world-tag-team-championship": "World Tag Team Championship",
  "womens-tag-team-championship": "Women's Tag Team Championship",
};

export type CurrentChampionFromChanges = {
  title: string;
  wonDate: string;
};

/**
 * Fetch current champions from the changes table: latest row per championship_type.
 * Returns a map from canonical slug (and normalized champion name) to { title, wonDate }.
 * If the table doesn't exist or query fails, returns empty map.
 */
export async function getCurrentChampionsFromChanges(
  db: SupabaseClient
): Promise<Record<string, CurrentChampionFromChanges>> {
  type Row = { championship_type?: string | null; champion?: string | null; champion_slug?: string | null; date?: string | null };
  const { data: rows, error } = await db
    .from(CHANGES_TABLE)
    .select("championship_type, champion, champion_slug, date")
    .order("date", { ascending: false });

  if (error || !rows?.length) return {};

  const byType = new Map<string, { champion: string; champion_slug: string | null; date: string }>();
  for (const r of rows as Row[]) {
    const typeKey = (r.championship_type ?? "").toString().trim().toLowerCase();
    if (!typeKey || byType.has(typeKey)) continue;
    const date = (r.date ?? "").toString().slice(0, 10);
    if (!date) continue;
    const champion = (r.champion ?? "").toString().trim();
    const slug = (r.champion_slug ?? "").toString().trim() || null;
    byType.set(typeKey, { champion, champion_slug: slug || null, date });
  }

  const result: Record<string, CurrentChampionFromChanges> = {};
  for (const [typeKey, { champion, champion_slug, date }] of byType) {
    const title = TYPE_TO_TITLE[typeKey] ?? typeKey.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const slugKey = champion_slug ? normalizeWrestlerName(champion_slug) : normalizeWrestlerName(champion);
    if (!slugKey) continue;
    const entry: CurrentChampionFromChanges = { title, wonDate: date };
    result[slugKey] = entry;
    if (champion && normalizeWrestlerName(champion) !== slugKey) result[normalizeWrestlerName(champion)] = entry;
  }
  return result;
}
