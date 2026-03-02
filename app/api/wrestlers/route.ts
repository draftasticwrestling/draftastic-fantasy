import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

/**
 * GET /api/wrestlers
 * Returns wrestlers from Supabase for the draft pool (id, name, gender, brand, 2K ratings).
 * Wrestler data is shared with Pro Wrestling Boxscore; 2K ratings come from Boxscore profiles.
 */
export async function GET() {
  let result = await supabase
    .from("wrestlers")
    .select('id, name, gender, brand, "2K26 rating", "2K25 rating"')
    .or("status.is.null,status.neq.Inactive")
    .order("name", { ascending: true });
  if (result.error) {
    result = await supabase
      .from("wrestlers")
      .select('id, name, gender, brand, "2K26 rating", "2K25 rating"')
      .order("name", { ascending: true });
  }
  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }
  return NextResponse.json({ wrestlers: result.data ?? [] });
}
