import { NextResponse } from "next/server";
import { getLoginNudgesForCurrentUser } from "@/lib/loginNudges";

/**
 * GET /api/me/nudges
 * Returns active login nudges for the current user.
 */
export async function GET() {
  const nudges = await getLoginNudgesForCurrentUser();
  return NextResponse.json({ nudges });
}
