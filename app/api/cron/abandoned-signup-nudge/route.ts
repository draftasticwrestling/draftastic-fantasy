import { NextResponse } from "next/server";
import { runAbandonedSignupNudgeCron } from "@/lib/abandonedSignupNudge";

/** Daily re-engagement email for users who signed up but never joined a league. */
export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runAbandonedSignupNudgeCron();
  return NextResponse.json({ ok: true, ...result });
}
