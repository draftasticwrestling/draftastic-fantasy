import { getRostersFromSheet } from "@/lib/rosters";
import { NextResponse } from "next/server";

/**
 * GET /api/roster-debug
 * Returns whether the sheet is configured and how many roster entries per member.
 * Use this to verify GOOGLE_SHEET_CSV_URL and sheet structure.
 */
export async function GET() {
  const sheetUrlSet = Boolean(process.env.GOOGLE_SHEET_CSV_URL?.trim());
  if (!sheetUrlSet) {
    return NextResponse.json({
      sheetUrlSet: false,
      error: "GOOGLE_SHEET_CSV_URL is not set in .env",
      byMember: {},
    });
  }
  try {
    const rosters = await getRostersFromSheet();
    const byMember: Record<string, number> = {};
    for (const [slug, entries] of Object.entries(rosters)) {
      byMember[slug] = entries.length;
    }
    return NextResponse.json({
      sheetUrlSet: true,
      byMember,
      totalRows: Object.values(rosters).reduce((s, arr) => s + arr.length, 0),
    });
  } catch (e) {
    return NextResponse.json({
      sheetUrlSet: true,
      error: e instanceof Error ? e.message : "Failed to load sheet",
      byMember: {},
    });
  }
}
