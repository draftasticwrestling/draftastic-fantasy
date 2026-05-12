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
    visible_at: "2026-05-11T16:00:00.000Z",
    created_at: "2026-05-11T16:00:00.000Z",
  },
  {
    id: "builtin-stat-correction-brie-bella-belt-2026-05-12",
    league_id: null,
    event_id: "platform-scoring",
    title: "May 12, 2026 — Brie Bella (faction belt scoring)",
    body_markdown:
      "Brie Bella's belt points were not factoring into faction scores correctly. She earned 1 belt point on May 10, 2026. Scores should count correctly now.",
    visible_at: "2026-05-12T16:00:00.000Z",
    created_at: "2026-05-12T16:00:00.000Z",
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

function mergeAndSortCorrections(
  fromDb: EventScoreCorrectionPublicRow[],
  nowIso: string
): EventScoreCorrectionPublicRow[] {
  const nowMs = Date.parse(nowIso);
  const builtins = BUILTIN_ALL_LEAGUES_STAT_CORRECTIONS.filter((b) => {
    const t = Date.parse(b.visible_at);
    return !Number.isNaN(t) && t <= nowMs;
  });
  const byId = new Map<string, EventScoreCorrectionPublicRow>();
  for (const r of [...fromDb, ...builtins]) {
    if (!byId.has(r.id)) byId.set(r.id, r);
  }
  return [...byId.values()].sort((a, b) => {
    const ta = Date.parse(a.visible_at);
    const tb = Date.parse(b.visible_at);
    if (tb !== ta) return tb - ta;
    return b.created_at.localeCompare(a.created_at);
  });
}

/**
 * Corrections visible to the current user for a league context: site-wide (league_id null)
 * plus rows for this league. RLS enforces membership and visible_at.
 */
export async function listEventScoreCorrectionsForLeaguePage(
  leagueId: string
): Promise<EventScoreCorrectionPublicRow[]> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("event_score_corrections")
    .select("id, league_id, event_id, title, body_markdown, visible_at, created_at")
    .lte("visible_at", now)
    .or(`league_id.is.null,league_id.eq.${leagueId}`)
    .order("visible_at", { ascending: false });

  if (error) return mergeAndSortCorrections([], now);
  return mergeAndSortCorrections((data ?? []) as EventScoreCorrectionPublicRow[], now);
}
