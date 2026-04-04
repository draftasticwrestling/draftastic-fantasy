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

  if (error) return [];
  return (data ?? []) as EventScoreCorrectionPublicRow[];
}
