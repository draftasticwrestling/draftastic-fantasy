import { supabase } from "@/lib/supabase";
import { getWrestlerBySlug } from "@/lib/wrestlers";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/wrestlers/[slug]
 * Returns a single wrestler by URL slug (e.g. cody-rhodes) or 404.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const raw = (slug ?? "").trim();
  if (!raw) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  // Column is "Status" (capital S) in DB, not "status"
  const { data: direct, error: directError } = await supabase
    .from("wrestlers")
    .select('id, name, gender, brand, image_url, dob, "Status", "2K26 rating", "2K25 rating"')
    .eq("id", raw)
    .maybeSingle();

  if (!directError && direct) {
    return NextResponse.json(direct);
  }

  const wrestler = await getWrestlerBySlug(raw);
  if (!wrestler) {
    return NextResponse.json({ error: "Wrestler not found" }, { status: 404 });
  }
  return NextResponse.json(wrestler);
}
