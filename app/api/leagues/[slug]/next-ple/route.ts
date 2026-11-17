import { NextResponse } from "next/server";
import { getLeagueBySlug } from "@/lib/leagues";
import { resolveNextPleLink } from "@/lib/nextPleLink";

type RouteContext = { params: Promise<{ slug: string }> };

/** GET /api/leagues/[slug]/next-ple — href for the next premium live event this league should open. */
export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const league = await getLeagueBySlug(slug);
  if (!league) {
    return NextResponse.json({ error: "League not found or access denied." }, { status: 404 });
  }
  const link = await resolveNextPleLink(league);
  return NextResponse.json(link);
}
