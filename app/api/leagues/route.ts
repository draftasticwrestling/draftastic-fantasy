import { NextResponse } from "next/server";
import { createLeague } from "@/lib/leagues";

/**
 * POST /api/leagues — create a new league. Body: { name, start_date?, end_date? }
 * Note: The "Create a league" form uses a Server Action instead; this route is for programmatic use.
 */
export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body. Expected { name, start_date?, end_date? }." },
        { status: 400 }
      );
    }
    const name = typeof body === "object" && body !== null && "name" in body
      ? String((body as { name?: unknown }).name ?? "").trim()
      : "";
    const start_date =
      typeof body === "object" && body !== null && "start_date" in body
        ? String((body as { start_date?: unknown }).start_date ?? "") || null
        : null;
    const end_date =
      typeof body === "object" && body !== null && "end_date" in body
        ? String((body as { end_date?: unknown }).end_date ?? "") || null
        : null;

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
