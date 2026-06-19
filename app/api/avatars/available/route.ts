import { NextResponse } from "next/server";
import { getAvailableAvatarsForUser } from "@/lib/avatarCatalog";
import { getServerAuth } from "@/lib/supabase/serverAuth";

/** GET /api/avatars/available — unlocked catalog characters (baseline square display URL). */
export async function GET() {
  const { user } = await getServerAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const avatars = await getAvailableAvatarsForUser(user.id);
  return NextResponse.json({
    avatars: avatars.map((a) => ({
      id: a.id,
      slug: a.slug,
      label: a.label,
      pack_slug: a.pack_slug,
      pack_name: a.pack_name,
      display_url: a.display_url,
      display_tier: a.display_tier,
    })),
  });
}
