import { createClient } from "@/lib/supabase/server";

export type EventScoreCorrectionPublicRow = {
  id: string;
  league_id: string | null;
  event_id: string;
  title: string;
  body_markdown: string;
  visible_at: string;
  created_at: string;
};

/** Built-in notices shown on every league Stat corrections tab (same as DB rows with league_id null). */
const BUILTIN_ALL_LEAGUES_STAT_CORRECTIONS: EventScoreCorrectionPublicRow[] = [
  {
    id: "builtin-stat-correction-oba-femi-raw-2026-05-11",
    league_id: null,
    event_id: "raw-2026-05-11",
    title: "May 11, 2026 — Oba Femi (RAW handicap match)",
    body_markdown:
      "Oba Femi's points for his handicap match on RAW were originally scored incorrectly. He earned 4 pts (+1 for appearance, +2 for winning, and +1 special match bonus for the additional opponent beaten).",
    visible_at: "2026-05-11T00:00:00.000Z",
    created_at: "2026-05-11T00:00:00.000Z",
  },
  {
    id: "builtin-stat-correction-brie-bella-belt-2026-05-12",
    league_id: null,
    event_id: "platform-scoring",
    title: "May 12, 2026 — Brie Bella (faction belt scoring; point earned May 10)",
    body_markdown:
      "Brie Bella should have earned **1 belt point on May 10, 2026** (title-hold scoring). Faction pages and scoreboards were not crediting that point correctly. **This correction was applied May 12, 2026**; totals should now match her wrestler profile.",
    visible_at: "2026-05-12T00:00:00.000Z",
    created_at: "2026-05-12T00:00:00.000Z",
  },
];

/**
 * When `event_id` is a synthetic platform notice, there is no single event-results page to link.
 */
export function statCorrectionEventResultsPath(eventId: string): string | null {
  const id = (eventId ?? "").trim();
  if (!id || id === "platform-scoring") return null;
  return `/event-results/${encodeURIComponent(id)}`;
}

/**
 * DB rows are already limited to visible_at <= now by the query. Built-in rows ship with the app:
 * they are always included (do not gate on visible_at — a future-looking timestamp would hide them
 * for part of the “posted” calendar day in some time zones).
 */
function mergeAndSortCorrections(fromDb: EventScoreCorrectionPublicRow[]): EventScoreCorrectionPublicRow[] {
  const byId = new Map<string, EventScoreCorrectionPublicRow>();
  for (const r of fromDb) {
    if (!byId.has(r.id)) byId.set(r.id, r);
  }
  for (const r of BUILTIN_ALL_LEAGUES_STAT_CORRECTIONS) {
    if (!byId.has(r.id)) byId.set(r.id, r);
  }
  return [...byId.values()].sort((a, b) => {
    const ta = Date.parse(a.visible_at);
    const tb = Date.parse(b.visible_at);
    if (tb !== ta) return tb - ta;
    return b.created_at.localeCompare(a.created_at);
  });
}

function eventDateYmdForCorrection(row: EventScoreCorrectionPublicRow): string {
  const id = (row.event_id ?? "").trim();
  const fromId = id.match(/(\d{4}-\d{2}-\d{2})/);
  if (fromId) return fromId[1];
  return (row.visible_at ?? "").slice(0, 10);
}

/** Keep only corrections for events on or after the league scoring window begins. */
export function filterCorrectionsForLeagueWindow(
  rows: EventScoreCorrectionPublicRow[],
  leagueStartYmd: string
): EventScoreCorrectionPublicRow[] {
  return rows.filter((row) => eventDateYmdForCorrection(row) >= leagueStartYmd);
}

/**
 * Corrections visible to the current user for a league context: site-wide (league_id null)
 * plus rows for this league. RLS enforces membership and visible_at.
 */
export async function listEventScoreCorrectionsForLeaguePage(
  leagueId: string,
  leagueStartYmd?: string
): Promise<EventScoreCorrectionPublicRow[]> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("event_score_corrections")
    .select("id, league_id, event_id, title, body_markdown, visible_at, created_at")
    .lte("visible_at", now)
    .or(`league_id.is.null,league_id.eq.${leagueId}`)
    .order("visible_at", { ascending: false });

  const merged = mergeAndSortCorrections(error ? [] : ((data ?? []) as EventScoreCorrectionPublicRow[]));
  if (!leagueStartYmd) return merged;
  return filterCorrectionsForLeagueWindow(merged, leagueStartYmd);
}
