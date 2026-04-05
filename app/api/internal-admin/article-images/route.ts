import { NextResponse } from "next/server";

import { getSiteAdminForApi } from "@/lib/auth/siteAdmin";
import { ARTICLE_IMAGES_BUCKET } from "@/lib/articleImages";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const IMAGE_RE = /\.(jpe?g|png|gif|webp)$/i;
const MAX_LIST = 60;

/**
 * GET — list image objects under the current site admin's folder (for reusing uploads in articles).
 */
export async function GET() {
  const gate = await getSiteAdminForApi();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const supabase = await createClient();
  const userId = gate.user.id;
  const acc: { path: string; publicUrl: string; createdAt: string }[] = [];

  const { data: L1, error: e1 } = await supabase.storage.from(ARTICLE_IMAGES_BUCKET).list(userId, {
    limit: 100,
  });
  if (e1) {
    return NextResponse.json({ error: e1.message }, { status: 500 });
  }

  for (const entry of L1 ?? []) {
    const sub = `${userId}/${entry.name}`;
    if (IMAGE_RE.test(entry.name)) {
      const { data: pub } = supabase.storage.from(ARTICLE_IMAGES_BUCKET).getPublicUrl(sub);
      acc.push({
        path: sub,
        publicUrl: pub.publicUrl,
        createdAt: entry.updated_at ?? entry.created_at ?? "",
      });
      continue;
    }
    const { data: L2, error: e2 } = await supabase.storage.from(ARTICLE_IMAGES_BUCKET).list(sub, {
      limit: 200,
    });
    if (e2) continue;
    for (const f of L2 ?? []) {
      if (!IMAGE_RE.test(f.name)) continue;
      const path = `${sub}/${f.name}`;
      const { data: pub } = supabase.storage.from(ARTICLE_IMAGES_BUCKET).getPublicUrl(path);
      acc.push({
        path,
        publicUrl: pub.publicUrl,
        createdAt: f.updated_at ?? f.created_at ?? "",
      });
    }
  }

  acc.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return NextResponse.json({ images: acc.slice(0, MAX_LIST) });
}
