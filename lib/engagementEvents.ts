import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type EngagementEventName =
  | "auth.sign_in"
  | "league.fa_add"
  | "league.drop"
  | "league.trade_proposed"
  | "league.trade_executed"
  | "page.my_faction_view"
  | "page.free_agents_view"
  | "page.league_leaders_view"
  | "page.logged_in_view"
  | "session.logged_in_start";

type Payload = {
  eventName: EngagementEventName;
  userId: string;
  leagueId?: string | null;
  seasonSlug?: string | null;
  path?: string | null;
  metadata?: Record<string, unknown> | null;
};

async function seasonSlugForLeague(
  supabase: Pick<SupabaseClient, "from">,
  leagueId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("leagues")
    .select("season_slug")
    .eq("id", leagueId)
    .maybeSingle();
  return ((data as { season_slug?: string | null } | null)?.season_slug ?? null) || null;
}

export async function recordEngagementEvent(payload: Payload): Promise<void> {
  try {
    const admin = getAdminClient();
    const db = admin ?? (await createClient());
    const seasonSlug =
      payload.seasonSlug ?? (payload.leagueId ? await seasonSlugForLeague(db, payload.leagueId) : null);

    await db.from("engagement_events").insert({
      event_name: payload.eventName,
      user_id: payload.userId,
      league_id: payload.leagueId ?? null,
      season_slug: seasonSlug,
      path: payload.path ?? null,
      metadata: payload.metadata ?? {},
      occurred_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[engagement] failed to record event", err);
  }
}
