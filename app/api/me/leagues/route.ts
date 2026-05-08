import { NextResponse } from "next/server";
import { getIsSiteAdmin } from "@/lib/auth/siteAdmin";
import { getAdminClient } from "@/lib/supabase/admin";
import { getLeaguesForUser } from "@/lib/leagues";

/**
 * GET /api/me/leagues
 * Returns leagues the current user is a member of (slug, name, role).
 * Optional `?previewSlug=` for site admins: merge that league for nav (Open league from admin) when not a member.
 */
export async function GET(req: Request) {
  const leagues = await getLeaguesForUser();
  const url = new URL(req.url);
  const previewSlug = (url.searchParams.get("previewSlug") ?? "").trim().toLowerCase();

  const payload = leagues.map((l) => ({
    slug: l.slug,
    name: l.name,
    role: l.role,
    league_type: (l as { league_type?: string | null }).league_type ?? null,
    season_slug: (l as { season_slug?: string | null }).season_slug ?? null,
    start_date: (l as { start_date?: string | null }).start_date ?? null,
    end_date: (l as { end_date?: string | null }).end_date ?? null,
    visibility_type: (l as { visibility_type?: string | null }).visibility_type ?? "private",
  }));

  if (
    previewSlug &&
    !payload.some((p) => p.slug === previewSlug) &&
    (await getIsSiteAdmin())
  ) {
    const admin = getAdminClient();
    if (admin) {
      const { data } = await admin
        .from("leagues")
        .select("slug, name, league_type, season_slug, start_date, end_date, visibility_type")
        .eq("slug", previewSlug)
        .maybeSingle();
      const row = data as {
        slug: string;
        name: string;
        league_type: string | null;
        season_slug: string | null;
        start_date: string | null;
        end_date: string | null;
        visibility_type: string | null;
      } | null;
      if (row?.slug) {
        payload.push({
          slug: row.slug,
          name: row.name,
          role: "owner",
          league_type: row.league_type ?? null,
          season_slug: row.season_slug ?? null,
          start_date: row.start_date ?? null,
          end_date: row.end_date ?? null,
          visibility_type: row.visibility_type ?? "private",
        });
      }
    }
  }

  return NextResponse.json({ leagues: payload });
}
