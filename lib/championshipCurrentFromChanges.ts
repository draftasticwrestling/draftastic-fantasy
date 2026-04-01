/**
 * Optional: read current champions from a "title changes" table (e.g. from Boxscore)
 * where each row is a change: championship_type, champion, champion_slug, date.
 * The latest row per championship_type = current champion.
 * Use when championship_history is empty or not synced but this table has the data.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";
import {
  expandWomensTagNiaLashIfSingleMemberListed,
  expandWorldTagPriestTruthIfSingleMemberListed,
  getTagTeamMemberSlugs,
  parseTagTeamChampionToMemberSlugs,
} from "@/lib/scoring/tagTeamMembers.js";

/** Supabase table for title changes (synced from Boxscore). Used for UI + inferring reigns for scoring. */
export const CHAMPIONSHIP_CHANGES_TABLE_NAME =
  process.env.CHAMPIONSHIP_CHANGES_TABLE ?? "championship_changes";

/** Map championship_type (e.g. wwe-championship) to display title name. */
export const CHAMPIONSHIP_TYPE_TO_TITLE: Record<string, string> = {
  "wwe-championship": "Undisputed WWE Championship",
  "world-heavyweight-championship": "World Heavyweight Championship",
  "womens-world-championship": "Women's World Championship",
  "wwe-womens-championship": "WWE Women's Championship",
  "intercontinental-championship": "Intercontinental Championship",
  "womens-intercontinental-championship": "Women's Intercontinental Championship",
  /** Boxscore URL slug / short type (see prowrestlingboxscore.com/championship/womens-ic-championship) */
  "womens-ic-championship": "Women's Intercontinental Championship",
  "united-states-championship": "United States Championship",
  "womens-united-states-championship": "Women's United States Championship",
  "world-tag-team-championship": "World Tag Team Championship",
  "womens-tag-team-championship": "Women's Tag Team Championship",
  "raw-tag-team-championship": "Raw Tag Team Championship",
  "smackdown-tag-team-championship": "SmackDown Tag Team Championship",
};

const TAG_TEAM_TYPES = new Set([
  "world-tag-team-championship",
  "womens-tag-team-championship",
  "raw-tag-team-championship",
  "smackdown-tag-team-championship",
]);

function isTagTeamChampionshipType(typeKey: string): boolean {
  const x = typeKey.trim().toLowerCase();
  if (TAG_TEAM_TYPES.has(x)) return true;
  return x.includes("tag-team") || x.includes("tag_team");
}

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
    .from(CHAMPIONSHIP_CHANGES_TABLE_NAME)
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
    const title =
      CHAMPIONSHIP_TYPE_TO_TITLE[typeKey] ??
      typeKey.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const slugKey = champion_slug ? normalizeWrestlerName(champion_slug) : normalizeWrestlerName(champion);
    if (!slugKey) continue;
    const entry: CurrentChampionFromChanges = { title, wonDate: date };
    result[slugKey] = entry;
    if (champion && normalizeWrestlerName(champion) !== slugKey) result[normalizeWrestlerName(champion)] = entry;
    if ((champion_slug ?? "").includes("_")) {
      const hyphenKey = normalizeWrestlerName((champion_slug ?? "").replace(/_/g, "-"));
      if (hyphenKey && hyphenKey !== slugKey) result[hyphenKey] = entry;
    }
    // Tag team: also assign to each member so profile/roster show belt for both
    if (isTagTeamChampionshipType(typeKey)) {
      const rawSlug = (champion_slug ?? "").toString().trim();
      const memberSlugs =
        getTagTeamMemberSlugs(slugKey) ??
        parseTagTeamChampionToMemberSlugs(champion || rawSlug || "") ??
        expandWorldTagPriestTruthIfSingleMemberListed(title, slugKey, slugKey, rawSlug) ??
        expandWomensTagNiaLashIfSingleMemberListed(title, slugKey, slugKey, rawSlug);
      if (memberSlugs?.length) {
        for (const memberSlug of memberSlugs) {
          const memberKey = normalizeWrestlerName(memberSlug) || memberSlug;
          result[memberKey] = entry;
        }
      }
    }
  }
  return result;
}

export type ChampionshipChangeRow = {
  championship_type?: string | null;
  champion?: string | null;
  champion_slug?: string | null;
  date?: string | null;
};

/**
 * Build reign-shaped rows from the full championship_changes timeline so mergeReigns + monthly
 * belt scoring see the same title lineage the site uses for "current champion" UI when
 * championship_history is incomplete or slug-mismatched.
 */
export function inferReignsFromChampionshipChanges(rows: ChampionshipChangeRow[]) {
  if (!rows?.length) return [];

  const byType = new Map<string, ChampionshipChangeRow[]>();
  for (const r of rows) {
    const t = (r.championship_type ?? "").toString().trim().toLowerCase();
    if (!t) continue;
    if (!byType.has(t)) byType.set(t, []);
    byType.get(t)!.push(r);
  }

  /** Shape compatible with mergeReigns second argument (event-inferred reign rows). */
  const out: Array<{
    champion_slug: string | null;
    champion_id: string | null;
    champion: string;
    champion_name: string;
    title: string;
    title_name: string;
    won_date: string;
    start_date: string;
    lost_date: string | null;
    end_date: string | null;
  }> = [];

  for (const [typeKey, list] of byType) {
    const sorted = [...list].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
    const deduped: ChampionshipChangeRow[] = [];
    for (const r of sorted) {
      const slug = (r.champion_slug ?? "").toString().trim();
      const nm = (r.champion ?? "").toString().trim();
      const key = slug ? normalizeWrestlerName(slug) : normalizeWrestlerName(nm);
      const prev = deduped[deduped.length - 1];
      if (prev) {
        const ps = (prev.champion_slug ?? "").toString().trim();
        const pn = (prev.champion ?? "").toString().trim();
        const pkey = ps ? normalizeWrestlerName(ps) : normalizeWrestlerName(pn);
        if (pkey && pkey === key) continue;
      }
      deduped.push(r);
    }

    const title =
      CHAMPIONSHIP_TYPE_TO_TITLE[typeKey] ??
      typeKey.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    for (let i = 0; i < deduped.length; i++) {
      const row = deduped[i]!;
      const next = deduped[i + 1];
      const won = (row.date ?? "").toString().slice(0, 10);
      if (!won) continue;
      const lost = next ? (next.date ?? "").toString().slice(0, 10) : null;
      const rawSlug = (row.champion_slug ?? "").toString().trim() || null;
      const namePart = (row.champion ?? "").toString().trim();
      const champion =
        namePart ||
        (rawSlug ? rawSlug.replace(/-/g, " ") : "") ||
        "Unknown";
      out.push({
        champion_slug: rawSlug,
        champion_id: rawSlug,
        champion,
        champion_name: champion,
        title,
        title_name: title,
        won_date: won,
        start_date: won,
        lost_date: lost,
        end_date: lost,
      });
    }
  }

  return out;
}
