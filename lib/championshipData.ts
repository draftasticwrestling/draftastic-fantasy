import { cache } from "react";
import { supabase } from "@/lib/supabase";
import { EVENT_STATUSES_FOR_SCORING, SCORING_EVENTS_FETCH_LIMIT } from "@/lib/eventsScoring";
import {
  closeReignsFromSuccessors,
  inferReignsFromEvents,
  mergeReigns,
  REIGN_EFFECTIVE_START,
} from "@/lib/scoring/endOfMonthBeltPoints.js";
import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";
import { normalizeChampionshipHistoryRow } from "@/lib/championshipHistoryNormalize";
import {
  buildTitleHistoryByChampionshipSlug,
  enrichTitleHistoryItems,
  type ChampionshipReignRow,
  type TitleHistoryBucket,
} from "@/lib/championshipTitleHistory";

const LEAGUE_START_DATE = "2025-05-02";

function titleHistoryBySlugFromReigns(
  source: ChampionshipReignRow[],
  wrestlerBySlug: Map<string, WrestlerMini>,
  wrestlerByNameKey: Map<string, WrestlerMini>
): Map<string, TitleHistoryBucket> {
  const hasBoxscoreIds = source.some((r) => (r.championship_id ?? "").trim() !== "");
  const prepared = hasBoxscoreIds
    ? source.map((r) => ({ ...r }))
    : (closeReignsFromSuccessors(structuredClone(source) as never) as ChampionshipReignRow[]);
  return buildTitleHistoryByChampionshipSlug(prepared, wrestlerBySlug, wrestlerByNameKey);
}

/** Subset of wrestlers row used for title history + /wrestlers table. */
export type WrestlerMini = {
  id: string;
  name: string | null;
  image_url: string | null;
  gender: string | null;
  brand?: string | null;
  dob?: string | null;
  nationality?: string | null;
  Status?: string | null;
  "2K26 rating"?: number | null;
  "2K25 rating"?: number | null;
};

export type ChampionshipHistoryDataset = {
  events: Array<{ id?: string; name?: string; date?: string; matches?: unknown[] }>;
  wrestlers: WrestlerMini[];
  reigns: ChampionshipReignRow[];
  /**
   * Slug keyed (PWBS /championship/{slug}). Built only from championship_history whenever that
   * table has any rows (same source as PWBS); never event-inferred, so bogus defenses don’t appear
   * as title changes. If the table is empty (e.g. local dev), falls back to merged reigns only then.
   */
  titleHistoryBySlug: Map<string, TitleHistoryBucket>;
  wrestlerBySlug: Map<string, WrestlerMini>;
  wrestlerByNameKey: Map<string, WrestlerMini>;
  /**
   * tag_team_members lookup keyed by member slug and team id slug; value is all member slugs.
   * Used to expand tag titles when history rows only include one member slug.
   */
  tagTeamMembersBySlug: Map<string, string[]>;
  /** Active tag team display names keyed by sorted member slugs (e.g. "brie-bella|paige" → "Scream Mode"). */
  tagTeamMonikerByMemberKey: Map<string, string>;
  error: Error | null;
};

/**
 * Shared data for /wrestlers and /championship/* — merged reigns and title history lookup maps.
 */
export const getChampionshipHistoryDataset = cache(async (): Promise<ChampionshipHistoryDataset> => {
  const [wrestlersResult, { data: events }, { data: eventsForReignInference }, { data: rawReigns }, { data: rawTagTeamMembers }, { data: rawTagTeams }] =
    await Promise.all([
      supabase
        .from("wrestlers")
        .select('id, name, gender, brand, image_url, dob, nationality, "Status", "2K26 rating", "2K25 rating"')
        .order("name", { ascending: true }),
      supabase
        .from("events")
        .select("id, name, date, matches")
        .in("status", [...EVENT_STATUSES_FOR_SCORING])
        .gte("date", LEAGUE_START_DATE)
        .order("date", { ascending: true })
        .limit(SCORING_EVENTS_FETCH_LIMIT),
      supabase
        .from("events")
        .select("id, name, date, matches")
        .eq("status", "completed")
        .gte("date", REIGN_EFFECTIVE_START)
        .order("date", { ascending: true })
        .limit(SCORING_EVENTS_FETCH_LIMIT),
      supabase.from("championship_history").select("*"),
      supabase
        .from("tag_team_members")
        .select("tag_team_id,wrestler_slug,member_order,active")
        .eq("active", true)
        .order("member_order", { ascending: true }),
      supabase.from("tag_teams").select("id,name").eq("active", true),
    ]);

  const tableReigns = (rawReigns ?? [])
    .map((row) => normalizeChampionshipHistoryRow(row as Record<string, unknown>))
    .sort((a, b) => {
      const ax = (a.won_date ?? a.start_date ?? "").slice(0, 10);
      const bx = (b.won_date ?? b.start_date ?? "").slice(0, 10);
      return ax.localeCompare(bx);
    }) as ChampionshipReignRow[];
  const inferredReigns = inferReignsFromEvents(eventsForReignInference ?? []);
  const reigns = mergeReigns(tableReigns, inferredReigns) as ChampionshipReignRow[];

  const wrestlers = (wrestlersResult.data ?? []) as WrestlerMini[];
  const wrestlerBySlug = new Map<string, WrestlerMini>();
  const wrestlerByNameKey = new Map<string, WrestlerMini>();
  for (const w of wrestlers) {
    const row = w as Record<string, unknown>;
    const item: WrestlerMini = {
      id: w.id,
      name: w.name ?? null,
      image_url: (row.image_url as string | null | undefined) ?? null,
      gender: w.gender ?? null,
      brand: (row.brand as string | null | undefined) ?? null,
      dob: (row.dob as string | null | undefined) ?? null,
      nationality: (row.nationality as string | null | undefined) ?? null,
      Status: row.Status != null ? String(row.Status) : undefined,
      "2K26 rating": row["2K26 rating"] != null ? Number(row["2K26 rating"]) : undefined,
      "2K25 rating": row["2K25 rating"] != null ? Number(row["2K25 rating"]) : undefined,
    };
    wrestlerBySlug.set(w.id, item);
    if (w.name) wrestlerByNameKey.set(normalizeWrestlerName(w.name), item);
  }

  const historyBuckets = titleHistoryBySlugFromReigns(
    tableReigns.length > 0 ? tableReigns : reigns,
    wrestlerBySlug,
    wrestlerByNameKey
  );
  const titleHistoryBySlug = new Map<string, TitleHistoryBucket>();
  for (const [slug, bucket] of historyBuckets) {
    titleHistoryBySlug.set(slug, {
      ...bucket,
      items: enrichTitleHistoryItems(bucket.items),
    });
  }

  const tagTeamMembersBySlug = new Map<string, string[]>();
  const membersByTeam = new Map<string, string[]>();
  for (const r of (rawTagTeamMembers ?? []) as Array<{ tag_team_id?: string | null; wrestler_slug?: string | null }>) {
    const teamId = normalizeWrestlerName(String(r.tag_team_id ?? ""));
    const member = normalizeWrestlerName(String(r.wrestler_slug ?? ""));
    if (!teamId || !member) continue;
    const list = membersByTeam.get(teamId) ?? [];
    if (!list.includes(member)) list.push(member);
    membersByTeam.set(teamId, list);
  }
  for (const [teamId, members] of membersByTeam) {
    tagTeamMembersBySlug.set(teamId, members);
    for (const member of members) tagTeamMembersBySlug.set(member, members);
  }

  const tagTeamMonikerByMemberKey = new Map<string, string>();
  for (const team of (rawTagTeams ?? []) as Array<{ id?: string | null; name?: string | null }>) {
    const teamId = normalizeWrestlerName(String(team.id ?? ""));
    const name = String(team.name ?? "").trim();
    const members = membersByTeam.get(teamId);
    if (!teamId || !name || !members || members.length < 2) continue;
    const key = [...new Set(members.map((m) => m.toLowerCase().trim()).filter(Boolean))].sort().join("|");
    tagTeamMonikerByMemberKey.set(key, name);
  }

  return {
    events: (events ?? []) as ChampionshipHistoryDataset["events"],
    wrestlers,
    reigns,
    titleHistoryBySlug,
    wrestlerBySlug,
    wrestlerByNameKey,
    tagTeamMembersBySlug,
    tagTeamMonikerByMemberKey,
    error: wrestlersResult.error ?? null,
  };
});
