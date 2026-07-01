import "server-only";

import { MIN_LEAGUE_TEAMS } from "@/lib/leagueStructure";
import { countPlacedLeagueMembers } from "@/lib/leaguePlacement";
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

  const { data: league } = await admin
    .from("leagues")
    .select("id, slug, commissioner_id, visibility_type, league_type, season_slug")
    .eq("id", id)
    .maybeSingle();
  const row = league as {
    id?: string;
    slug?: string;
    commissioner_id?: string | null;
    visibility_type?: string | null;
    league_type?: string | null;
    season_slug?: string | null;
  } | null;
  if (!row?.id) return;

  const memberCount = await countPlacedLeagueMembers(admin, id, row);
  if (memberCount < MIN_LEAGUE_TEAMS) return;

  const commissionerId = row.commissioner_id?.trim();
  if (!commissionerId) return;

  await awardUserXp({
    userId: commissionerId,
    delta: XP_AMOUNTS.league_started,
    reason: "league_started",
    idempotencyKey: `league_started:${id}`,
    metadata: { leagueId: id, slug: row.slug ?? null },
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
