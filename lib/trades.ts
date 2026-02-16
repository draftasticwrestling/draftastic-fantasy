import { supabase } from "@/lib/supabase";
import { EXAMPLE_LEAGUE } from "@/lib/league";

export type TradeRow = {
  id: string;
  league_slug: string;
  trade_date: string;
  notes: string | null;
  created_at?: string;
};

export type TradeLegRow = {
  id: string;
  trade_id: string;
  from_owner_slug: string;
  to_owner_slug: string;
  wrestler_id: string | null;
  draft_pick_id: string | null;
};

export type TradeWithLegs = TradeRow & { legs: TradeLegRow[] };

export type TradeLegInput = {
  from_owner_slug: string;
  to_owner_slug: string;
  wrestler_id?: string | null;
  draft_pick_id?: string | null;
};

/**
 * List trades for the league, most recent first, with legs.
 */
export async function getTrades(leagueSlug: string): Promise<TradeWithLegs[]> {
  const { data: tradesData, error: tradesError } = await supabase
    .from("trades")
    .select("id, league_slug, trade_date, notes, created_at")
    .eq("league_slug", leagueSlug)
    .order("trade_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (tradesError || !tradesData?.length) {
    return [];
  }

  const { data: legsData, error: legsError } = await supabase
    .from("trade_legs")
    .select("id, trade_id, from_owner_slug, to_owner_slug, wrestler_id, draft_pick_id")
    .in("trade_id", (tradesData as TradeRow[]).map((t) => t.id));

  if (legsError) {
    return (tradesData as TradeRow[]).map((t) => ({ ...t, legs: [] }));
  }

  const legsByTradeId: Record<string, TradeLegRow[]> = {};
  for (const leg of (legsData ?? []) as TradeLegRow[]) {
    if (!legsByTradeId[leg.trade_id]) legsByTradeId[leg.trade_id] = [];
    legsByTradeId[leg.trade_id].push(leg);
  }

  return (tradesData as TradeRow[]).map((t) => ({
    ...t,
    legs: legsByTradeId[t.id] ?? [],
  }));
}

const LEAGUE_SLUG = EXAMPLE_LEAGUE.slug;

/**
 * Record a trade: insert trade + legs, then update roster_assignments and draft_picks.
 */
export async function createTrade(
  leagueSlug: string,
  tradeDate: string,
  legs: TradeLegInput[],
  notes?: string | null
): Promise<{ tradeId: string } | { error: string }> {
  if (!legs.length) {
    return { error: "At least one trade leg is required." };
  }

  for (const leg of legs) {
    const hasWrestler = leg.wrestler_id != null && leg.wrestler_id !== "";
    const hasPick = leg.draft_pick_id != null && leg.draft_pick_id !== "";
    if (!hasWrestler && !hasPick) {
      return { error: "Each leg must specify either a wrestler or a draft pick." };
    }
    if (leg.from_owner_slug === leg.to_owner_slug) {
      return { error: "From and to owner must be different." };
    }
  }

  const { data: tradeRow, error: tradeError } = await supabase
    .from("trades")
    .insert({
      league_slug: leagueSlug,
      trade_date: tradeDate,
      notes: notes ?? null,
    })
    .select("id")
    .single();

  if (tradeError || !tradeRow?.id) {
    return { error: tradeError?.message ?? "Failed to create trade." };
  }

  const tradeId = tradeRow.id as string;

  const legRows = legs.map((leg) => ({
    trade_id: tradeId,
    from_owner_slug: leg.from_owner_slug,
    to_owner_slug: leg.to_owner_slug,
    wrestler_id: leg.wrestler_id ?? null,
    draft_pick_id: leg.draft_pick_id ?? null,
  }));

  const { error: legsError } = await supabase.from("trade_legs").insert(legRows);

  if (legsError) {
    await supabase.from("trades").delete().eq("id", tradeId);
    return { error: legsError.message };
  }

  for (const leg of legs) {
    if (leg.wrestler_id) {
      const { data: existing } = await supabase
        .from("roster_assignments")
        .select("contract")
        .eq("league_slug", LEAGUE_SLUG)
        .eq("owner_slug", leg.from_owner_slug)
        .eq("wrestler_id", leg.wrestler_id)
        .single();

      const contract = (existing as { contract: string | null } | null)?.contract ?? null;

      await supabase
        .from("roster_assignments")
        .delete()
        .eq("league_slug", LEAGUE_SLUG)
        .eq("owner_slug", leg.from_owner_slug)
        .eq("wrestler_id", leg.wrestler_id);

      await supabase.from("roster_assignments").insert({
        league_slug: LEAGUE_SLUG,
        owner_slug: leg.to_owner_slug,
        wrestler_id: leg.wrestler_id,
        contract,
      });
    }
    if (leg.draft_pick_id) {
      await supabase
        .from("draft_picks")
        .update({ current_owner_slug: leg.to_owner_slug })
        .eq("id", leg.draft_pick_id);
    }
  }

  return { tradeId };
}
