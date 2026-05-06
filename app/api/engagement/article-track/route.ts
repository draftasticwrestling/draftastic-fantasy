import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import { getAdminClient } from "@/lib/supabase/admin";

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/i;

function clampDwellSeconds(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.floor(n), 6 * 60 * 60);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    slug?: string;
    visitorKey?: string;
    event?: string;
    dwellSeconds?: number;
  };

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const visitorKey = typeof body.visitorKey === "string" ? body.visitorKey.trim() : "";
  const event = body.event === "dwell" ? "dwell" : "view";
  const dwellSeconds = clampDwellSeconds(Number(body.dwellSeconds));

  if (!slug || slug.length > 160 || !SLUG_RE.test(slug)) {
    return NextResponse.json({ ok: false, error: "invalid_slug" }, { status: 400 });
  }
  if (!visitorKey || visitorKey.length > 80) {
    return NextResponse.json({ ok: false, error: "invalid_visitor" }, { status: 400 });
  }

  const { supabase, user } = await getServerAuth();
  const admin = getAdminClient();

  const path = `/news/${slug}`;
  const occurredAt = new Date().toISOString();

  if (event === "view") {
    const row = {
      event_name: "page.news_article_view",
      user_id: user?.id ?? null,
      league_id: null as string | null,
      season_slug: null as string | null,
      path,
      metadata: { article_slug: slug, visitor_key: visitorKey },
      occurred_at: occurredAt,
    };
    if (user) {
      const { error } = await supabase.from("engagement_events").insert(row);
      if (error) console.error("[article-track] insert view (user)", error.message);
    } else if (admin) {
      const { error } = await admin.from("engagement_events").insert(row);
      if (error) console.error("[article-track] insert view (anon)", error.message);
    }
    return NextResponse.json({ ok: true });
  }

  if (dwellSeconds < 3) {
    return NextResponse.json({ ok: true });
  }

  const row = {
    event_name: "page.news_article_dwell",
    user_id: user?.id ?? null,
    league_id: null as string | null,
    season_slug: null as string | null,
    path,
    metadata: { article_slug: slug, visitor_key: visitorKey, dwell_seconds: dwellSeconds },
    occurred_at: occurredAt,
  };
  if (user) {
    const { error } = await supabase.from("engagement_events").insert(row);
    if (error) console.error("[article-track] insert dwell (user)", error.message);
  } else if (admin) {
    const { error } = await admin.from("engagement_events").insert(row);
    if (error) console.error("[article-track] insert dwell (anon)", error.message);
  }

  return NextResponse.json({ ok: true });
}
