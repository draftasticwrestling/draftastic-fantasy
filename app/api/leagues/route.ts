import { NextResponse } from "next/server";
import { createLeague } from "@/lib/leagues";

/**
 * POST /api/leagues — create a new league. Body: { name, start_date?, end_date? }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const start_date = typeof body.start_date === "string" ? body.start_date : null;
    const end_date = typeof body.end_date === "string" ? body.end_date : null;

    const { league, error } = await createLeague({ name, start_date, end_date });
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }
    return NextResponse.json({ league });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
