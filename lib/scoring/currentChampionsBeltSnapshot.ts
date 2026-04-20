import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentChampionsFromChampionshipsTable } from "@/lib/championshipCurrentFromTable";
import { getBeltPointsForTitle } from "@/lib/scoring/endOfMonthBeltPoints.js";

/**
 * Fallback belt snapshot from the current championships table.
 * Useful when season-end runs before month-end and history rows are incomplete.
 */
export async function getCurrentChampionsMonthlyBeltBySlug(
  db: SupabaseClient
): Promise<Record<string, number>> {
  const current = await getCurrentChampionsFromChampionshipsTable(db);
  const bySlug: Record<string, number> = {};
  for (const [slug, row] of Object.entries(current)) {
    const pts = getBeltPointsForTitle(row.title);
    if (pts <= 0) continue;
    bySlug[slug] = (bySlug[slug] ?? 0) + pts;
  }
  return bySlug;
}
