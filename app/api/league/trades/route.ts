import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getTrades, createTrade } from "@/lib/trades";
import { getDraftPicksByOwner, getPickLabel, DEFAULT_SEASON } from "@/lib/draftPicks";
import { EXAMPLE_LEAGUE } from "@/lib/league";

const LEAGUE_SLUG = EXAMPLE_LEAGUE.slug;

/**
 * GET /api/league/trades
 * Returns all trades for the league with legs (enriched with wrestler_name and pick_label), most recent first.
 */
export async function GET() {
  try {
    const trades = await getTrades(LEAGUE_SLUG);

    const { data: wrestlers } = await supabase.from("wrestlers").select("id, name");
    const wrestlerNameById: Record<string, string> = {};
    for (const w of wrestlers ?? []) {
      const row = w as { id: string; name: string | null };
      wrestlerNameById[row.id] = row.name ?? row.id;
    }

    const picksByOwner = await getDraftPicksByOwner(LEAGUE_SLUG, DEFAULT_SEASON);
    const allPicks = Object.values(picksByOwner).flat();
    const pickLabelById: Record<string, string> = {};
    for (const p of allPicks) {
      pickLabelById[p.id] = getPickLabel(p);
    }

    const enriched = trades.map((t) => ({
      ...t,
      legs: t.legs.map((leg) => ({
        ...leg,
        wrestler_name: leg.wrestler_id ? wrestlerNameById[leg.wrestler_id] ?? leg.wrestler_id : undefined,
        pick_label: leg.draft_pick_id ? pickLabelById[leg.draft_pick_id] ?? "Draft pick" : undefined,
      })),
    }));

    return NextResponse.json({ league_slug: LEAGUE_SLUG, trades: enriched });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/league/trades
 * Body: { trade_date: string (YYYY-MM-DD), legs: TradeLegInput[], notes?: string }
 * Creates the trade and updates roster_assignments and draft_picks.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { trade_date, legs, notes } = body as {
      trade_date?: string;
      legs?: Array<{
        from_owner_slug: string;
        to_owner_slug: string;
        wrestler_id?: string | null;
        draft_pick_id?: string | null;
      }>;
      notes?: string | null;
    };

    if (!trade_date || !Array.isArray(legs)) {
      return NextResponse.json(
        { error: "trade_date and legs are required." },
        { status: 400 }
      );
    }

    const result = await createTrade(LEAGUE_SLUG, trade_date, legs, notes);

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, trade_id: result.tradeId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
