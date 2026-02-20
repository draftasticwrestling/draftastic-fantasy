import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";

export type League = {
  id: string;
  name: string;
  slug: string;
  commissioner_id: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

export type LeagueMember = {
  id: string;
  league_id: string;
  user_id: string;
  role: "commissioner" | "owner";
  joined_at: string;
  display_name?: string | null;
};

export type LeagueWithRole = League & { role: "commissioner" | "owner" };

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "league";
}

function makeSlugUnique(base: string, existingSlugs: Set<string>): string {
  let slug = base;
  let n = 0;
  while (existingSlugs.has(slug)) {
    n += 1;
    slug = `${base}-${n}`;
  }
  return slug;
}

/**
 * Create a new league. Caller must be authenticated; they become commissioner.
 */
export async function createLeague(params: {
  name: string;
  start_date?: string | null;
  end_date?: string | null;
}): Promise<{ league?: League; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const name = params.name?.trim();
  if (!name) return { error: "League name is required" };

  const baseSlug = slugify(name);
  const admin = getAdminClient();
  if (!admin) {
    return {
      error:
        "Server configuration: SUPABASE_SERVICE_ROLE_KEY is not set. Add it in Netlify → Site settings → Environment variables (from Supabase Dashboard → Settings → API → service_role).",
    };
  }
  const { data: existing } = await admin.from("leagues").select("slug");
  const existingSlugs = new Set((existing ?? []).map((r) => r.slug));
  const slug = makeSlugUnique(baseSlug, existingSlugs);

  const { data: league, error } = await admin
    .from("leagues")
    .insert({
      name,
      slug,
      commissioner_id: user.id,
      start_date: params.start_date || null,
      end_date: params.end_date || null,
    })
    .select("id, name, slug, commissioner_id, start_date, end_date, created_at")
    .single();

  if (error) return { error: error.message };
  if (!league) return { error: "Failed to create league" };

  await admin.from("league_members").insert({
    league_id: league.id,
    user_id: user.id,
    role: "commissioner",
  });

  return { league: league as League };
}

/**
 * Get a league by slug. Returns null if not found or user is not a member.
 */
export async function getLeagueBySlug(slug: string): Promise<(League & { role: "commissioner" | "owner" }) | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: league, error } = await supabase
    .from("leagues")
    .select("id, name, slug, commissioner_id, start_date, end_date, created_at")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !league) return null;

  const { data: member } = await supabase
    .from("league_members")
    .select("role")
    .eq("league_id", league.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) return null;
  return { ...league, role: member.role } as League & { role: "commissioner" | "owner" };
}

/**
 * List leagues the current user is a member of.
 */
export async function getLeaguesForUser(): Promise<LeagueWithRole[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: members, error: meError } = await supabase
    .from("league_members")
    .select("league_id, role")
    .eq("user_id", user.id);

  if (meError || !members?.length) return [];

  const leagueIds = members.map((m) => m.league_id);
  const { data: leagues, error: leagueError } = await supabase
    .from("leagues")
    .select("id, name, slug, commissioner_id, start_date, end_date, created_at")
    .in("id", leagueIds);

  if (leagueError || !leagues?.length) return [];

  const roleByLeagueId = Object.fromEntries(members.map((m) => [m.league_id, m.role]));
  return leagues.map((l) => ({
    ...l,
    role: roleByLeagueId[l.id] ?? "owner",
  })) as LeagueWithRole[];
}

/**
 * Get members of a league with display names. Caller must be a member.
 */
export async function getLeagueMembers(leagueId: string): Promise<LeagueMember[]> {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("league_members")
    .select("id, league_id, user_id, role, joined_at")
    .eq("league_id", leagueId)
    .order("joined_at", { ascending: true });

  if (error || !rows?.length) return [];

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", userIds);

  const nameByUserId = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id, p.display_name])
  );

  return rows.map((r) => ({
    ...r,
    display_name: nameByUserId[r.user_id] ?? null,
  })) as LeagueMember[];
}

/**
 * Create an invite for a league. Returns the full join URL and token. Commissioner only.
 */
export async function createLeagueInvite(
  leagueId: string,
  expiresInDays: number = 7
): Promise<{ url: string; token: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { url: "", token: "", error: "Not authenticated" };

  const { data: league } = await supabase
    .from("leagues")
    .select("id, commissioner_id, slug")
    .eq("id", leagueId)
    .single();

  if (!league || league.commissioner_id !== user.id) {
    return { url: "", token: "", error: "Not the commissioner" };
  }

  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const { error } = await supabase.from("league_invites").insert({
    league_id: leagueId,
    token,
    created_by: user.id,
    expires_at: expiresAt.toISOString(),
  });

  if (error) return { url: "", token: "", error: error.message };

  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = `${base}/leagues/join?token=${token}`;
  return { url, token };
}

/**
 * Join a league using an invite token. Uses the Supabase RPC.
 */
export async function joinLeagueWithToken(token: string): Promise<{
  ok: boolean;
  league_slug?: string;
  error?: string;
  message?: string;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_league_with_token", {
    p_token: token.trim(),
  });

  if (error) return { ok: false, error: error.message };
  const result = data as { ok: boolean; league_slug?: string; error?: string; message?: string };
  return result;
}
