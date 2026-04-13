import { NextResponse } from "next/server";
import { fetchCompletedEventsPage } from "@/lib/event-results/listingQueries";

const MAX_OFFSET = 20_000;
const MAX_LIMIT = 100;

/**
 * GET /api/event-results/completed?offset=0&limit=50
 * Paginated completed events (newest first) for the Results page "Load older" control.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const offsetRaw = parseInt(searchParams.get("offset") || "0", 10);
  const limitRaw = parseInt(searchParams.get("limit") || "50", 10);
  const offset = Number.isFinite(offsetRaw) ? Math.min(Math.max(0, offsetRaw), MAX_OFFSET) : 0;
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), MAX_LIMIT) : 50;

  const { events, hasMore } = await fetchCompletedEventsPage(offset, limit);

  return NextResponse.json({ events, hasMore });
}
