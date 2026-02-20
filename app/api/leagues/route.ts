import { NextResponse } from "next/server";
import { createLeague } from "@/lib/leagues";

/**
 * POST /api/leagues — create a new league. Body: { name, season_slug, season_year, draft_date? }
 * Note: The "Create a league" form uses a Server Action instead; this route is for programmatic use.
 */
export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body. Expected { name, season_slug, season_year, draft_date? }." },
        { status: 400 }
      );
    }
    const name = typeof body === "object" && body !== null && "name" in body
      ? String((body as { name?: unknown }).name ?? "").trim()
      : "";
    const season_slug = typeof body === "object" && body !== null && "season_slug" in body
      ? String((body as { season_slug?: unknown }).season_slug ?? "").trim()
      : "";
    const season_year = typeof body === "object" && body !== null && "season_year" in body
      ? Number((body as { season_year?: unknown }).season_year)
      : NaN;
    const draft_date =
      typeof body === "object" && body !== null && "draft_date" in body
        ? String((body as { draft_date?: unknown }).draft_date ?? "").trim() || null
        : null;

    const { league, error } = await createLeague({
      name,
      season_slug,
      season_year,
      draft_date,
    });
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }
    return NextResponse.json({ league });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
