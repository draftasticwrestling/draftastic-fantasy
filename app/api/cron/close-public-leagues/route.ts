import { NextResponse } from "next/server";
import { closeExpiredPublicLeagues } from "@/lib/leagues";

/** Close public leagues at Monday RAW; activate when 3+ teams, else defer one week. */
export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await closeExpiredPublicLeagues();
  return NextResponse.json({ ok: true });
}
