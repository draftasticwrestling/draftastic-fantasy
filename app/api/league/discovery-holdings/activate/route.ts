import { NextResponse } from "next/server";
import { activateHolding } from "@/lib/discoveryHoldings";

/**
 * POST /api/league/discovery-holdings/activate
 * Body: { holding_id }
 * Activates the holding: adds wrestler to owner's roster (creating wrestler if needed) and marks holding as activated.
 * Must be within 12 months of debut_date if debut was set.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { holding_id } = body as { holding_id?: string };

    if (!holding_id) {
      return NextResponse.json({ error: "holding_id is required." }, { status: 400 });
    }

    const result = await activateHolding(holding_id);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
