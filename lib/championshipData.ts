import { cache } from "react";
import { supabase } from "@/lib/supabase";
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
  error: Error | null;
};

/**
 * Shared data for /wrestlers and /championship/* — merged reigns and title history lookup maps.
 */
export const getChampionshipHistoryDataset = cache(async (): Promise<ChampionshipHistoryDataset> => {
  const [wrestlersResult, { data: events }, { data: eventsForReignInference }, { data: rawReigns }] =
    await Promise.all([
      supabase
        .from("wrestlers")
        .select('id, name, gender, brand, image_url, dob, nationality, "Status", "2K26 rating", "2K25 rating"')
        .order("name", { ascending: true }),
      supabase
        .from("events")
        .select("id, name, date, matches")
        .eq("status", "completed")
        .gte("date", LEAGUE_START_DATE)
        .order("date", { ascending: true }),
      supabase
        .from("events")
        .select("id, name, date, matches")
        .eq("status", "completed")
        .gte("date", REIGN_EFFECTIVE_START)
        .order("date", { ascending: true }),
      supabase.from("championship_history").select("*"),
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

  return {
    events: (events ?? []) as ChampionshipHistoryDataset["events"],
    wrestlers,
    reigns,
    titleHistoryBySlug,
    wrestlerBySlug,
    wrestlerByNameKey,
    error: wrestlersResult.error ?? null,
  };
});
