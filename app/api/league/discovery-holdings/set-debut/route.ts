import { NextResponse } from "next/server";
import { setDebutDate } from "@/lib/discoveryHoldings";

/**
 * POST /api/league/discovery-holdings/set-debut
 * Body: { holding_id, debut_date (YYYY-MM-DD) }
 * Sets WWE main roster debut date (starts 12-month activation clock).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { holding_id, debut_date } = body as { holding_id?: string; debut_date?: string };

    if (!holding_id || !debut_date) {
      return NextResponse.json(
        { error: "holding_id and debut_date are required." },
        { status: 400 }
      );
    }

    const result = await setDebutDate(holding_id, debut_date);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
