import { NextResponse } from "next/server";
import { createHolding } from "@/lib/discoveryHoldings";
import { EXAMPLE_LEAGUE } from "@/lib/league";

const LEAGUE_SLUG = EXAMPLE_LEAGUE.slug;

/**
 * POST /api/league/discovery-holdings/create
 * Body: { owner_slug, draft_pick_id, wrestler_name, company? }
 * Uses the discovery pick and creates a holding (rights to that wrestler).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { owner_slug, draft_pick_id, wrestler_name, company } = body as {
      owner_slug?: string;
      draft_pick_id?: string;
      wrestler_name?: string;
      company?: string | null;
    };

    if (!owner_slug || !draft_pick_id || wrestler_name === undefined) {
      return NextResponse.json(
        { error: "owner_slug, draft_pick_id, and wrestler_name are required." },
        { status: 400 }
      );
    }

    const result = await createHolding(LEAGUE_SLUG, owner_slug, draft_pick_id, wrestler_name, company);

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, id: result.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
