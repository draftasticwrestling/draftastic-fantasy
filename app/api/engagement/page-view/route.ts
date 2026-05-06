import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import { recordEngagementEvent } from "@/lib/engagementEvents";

function normalizePath(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "/";
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      return new URL(raw).pathname || "/";
    } catch {
      return "/";
    }
  }
  return raw.startsWith("/") ? raw : `/${raw}`;
}

/** Pathname only; no query. */
function classifyContentViews(path: string): { eventResults: boolean } {
  const p = path.split("?")[0]?.replace(/\/+$/, "") || "/";
  const eventResults = p === "/event-results" || p.startsWith("/event-results/");
  return { eventResults };
}

export async function POST(request: Request) {
  const { supabase, user } = await getServerAuth();
  if (!user) return NextResponse.json({ ok: true });

  const body = (await request.json().catch(() => ({}))) as {
    path?: string;
    newSession?: boolean;
  };
  const path = normalizePath(body.path);

  let leagueId: string | null = null;
  let seasonSlug: string | null = null;

  const leagueMatch = path.match(/^\/leagues\/([^/]+)/);
  if (leagueMatch?.[1]) {
    const slug = decodeURIComponent(leagueMatch[1]);
    const { data: league } = await supabase
      .from("leagues")
      .select("id, season_slug")
      .eq("slug", slug)
      .maybeSingle();
    leagueId = ((league as { id?: string } | null)?.id ?? null) || null;
    seasonSlug = ((league as { season_slug?: string | null } | null)?.season_slug ?? null) || null;
  }

  await recordEngagementEvent({
    eventName: "page.logged_in_view",
    userId: user.id,
    leagueId,
    seasonSlug,
    path,
  });

  const { eventResults } = classifyContentViews(path);
  if (eventResults) {
    await recordEngagementEvent({
      eventName: "page.event_results_view",
      userId: user.id,
      leagueId: null,
      seasonSlug: null,
      path,
    });
  }

  if (body.newSession === true) {
    await recordEngagementEvent({
      eventName: "session.logged_in_start",
      userId: user.id,
      leagueId,
      seasonSlug,
      path,
    });
  }

  return NextResponse.json({ ok: true });
}
