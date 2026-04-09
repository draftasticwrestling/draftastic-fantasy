import { NextResponse } from "next/server";
import { createLeague } from "@/lib/leagues";
import { createClient } from "@/lib/supabase/server";
import {
  consumeLeagueCreationAccessCode,
  leagueCreationAccessIsConfigured,
} from "@/lib/leagueCreationAccess";

/**
 * POST /api/leagues — create a new league. Body: { name, season_slug, season_year?, access_code? }
 * season_year defaults to the current calendar year if omitted or invalid.
 * Note: The "Create a league" form uses a Server Action instead; this route is for programmatic use.
 */
export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body. Expected { name, season_slug, season_year?, access_code? }." },
        { status: 400 }
      );
    }
    const name = typeof body === "object" && body !== null && "name" in body
      ? String((body as { name?: unknown }).name ?? "").trim()
      : "";
    const season_slug = typeof body === "object" && body !== null && "season_slug" in body
      ? String((body as { season_slug?: unknown }).season_slug ?? "").trim()
      : "";
    const season_year = typeof body === "object" && body !== null && "season_year" in body
      ? Number((body as { season_year?: unknown }).season_year)
      : NaN;
    const accessCode =
      typeof body === "object" && body !== null && "access_code" in body
        ? String((body as { access_code?: unknown }).access_code ?? "").trim()
        : "";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_site_admin")
      .eq("id", user.id)
      .maybeSingle();
    const isSiteAdmin = Boolean((profile as { is_site_admin?: boolean | null } | null)?.is_site_admin);

    if (!isSiteAdmin) {
      if (!(await leagueCreationAccessIsConfigured())) {
        return NextResponse.json(
          { error: "League creation access codes are not configured yet." },
          { status: 503 }
        );
      }
      const consume = await consumeLeagueCreationAccessCode(accessCode);
      if (!consume.ok) {
        return NextResponse.json(
          { error: consume.error ?? "Invalid league creation access code." },
          { status: 403 }
        );
      }
    }

    const { league, error } = await createLeague({
      name,
      season_slug,
      season_year,
    });
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }
    return NextResponse.json({ league });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
