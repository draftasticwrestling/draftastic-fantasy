import "server-only";

import { MIN_LEAGUE_TEAMS } from "@/lib/leagueStructure";
import { getAdminClient } from "@/lib/supabase/admin";
import { awardUserXp } from "@/lib/xp/awardUserXp";
import { XP_AMOUNTS } from "@/lib/xp/xpReasons";

/**
 * Award "league started" XP to the commissioner once the league has at least
 * {@link MIN_LEAGUE_TEAMS} factions (creator plus two others who joined).
 * Idempotent per league via `league_started:{leagueId}`.
 */
export async function maybeAwardLeagueStartedXp(leagueId: string): Promise<void> {
  const id = leagueId?.trim();
  if (!id) return;
  const admin = getAdminClient();
  if (!admin) return;

  const { count, error: countErr } = await admin
    .from("league_members")
    .select("*", { count: "exact", head: true })
    .eq("league_id", id);
  if (countErr || (count ?? 0) < MIN_LEAGUE_TEAMS) return;

  const { data: league } = await admin
    .from("leagues")
    .select("id, slug, commissioner_id")
    .eq("id", id)
    .maybeSingle();
  const row = league as { id?: string; slug?: string; commissioner_id?: string | null } | null;
  const commissionerId = row?.commissioner_id?.trim();
  if (!commissionerId) return;

  await awardUserXp({
    userId: commissionerId,
    delta: XP_AMOUNTS.league_started,
    reason: "league_started",
    idempotencyKey: `league_started:${id}`,
    metadata: { leagueId: id, slug: row?.slug ?? null },
  });
}

/** Resolve league id from slug, then try commissioner XP if the league is full enough. */
export async function maybeAwardLeagueStartedXpBySlug(leagueSlug: string): Promise<void> {
  const slug = leagueSlug?.trim();
  if (!slug) return;
  const admin = getAdminClient();
  if (!admin) return;
  const { data: league } = await admin.from("leagues").select("id").eq("slug", slug).maybeSingle();
  const leagueId = (league as { id?: string } | null)?.id;
  if (!leagueId) return;
  await maybeAwardLeagueStartedXp(leagueId);
}
