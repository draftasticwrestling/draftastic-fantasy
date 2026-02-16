import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

/**
 * GET /api/wrestlers
 * Returns wrestlers from Supabase for the draft pool (id, name, gender, brand).
 * Use the wrestler pool page for a grouped view and roster rules.
 */
export async function GET() {
  const { data, error } = await supabase
    .from("wrestlers")
    .select("id, name, gender, brand")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ wrestlers: data ?? [] });
}
