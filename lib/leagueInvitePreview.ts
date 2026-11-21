import "server-only";

import { INVITE_LINK_EXPIRY_DAYS } from "@/lib/leagueJoinCode";
import { DRAFTASTIC_PUBLIC_SITE_ORIGIN } from "@/lib/siteDomains";
import { getAdminClient } from "@/lib/supabase/admin";

export type LeagueInvitePreview = {
  token: string;
  leagueId: string;
  leagueName: string;
  leagueSlug: string;
  leagueType: string | null;
  seasonSlug: string | null;
  expired: boolean;
};

export function leagueInviteOnboardingPath(slug: string, token: string): string {
  return `/leagues/${encodeURIComponent(slug)}/onboarding?invite=${encodeURIComponent(token)}`;
}

/** Email this. After sign-in it opens that league's onboarding agree step. */
export function leagueInvitePublicUrl(token: string): string {
  return `${DRAFTASTIC_PUBLIC_SITE_ORIGIN}/leagues/join?token=${encodeURIComponent(token)}`;
}

export async function getLeagueInvitePreview(token: string): Promise<LeagueInvitePreview | null> {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const admin = getAdminClient();
  if (!admin) return null;

  const { data: invite, error } = await admin
    .from("league_invites")
    .select("token, league_id, expires_at")
    .eq("token", trimmed)
    .maybeSingle();
  if (error || !invite) return null;

  const { data: league, error: leagueError } = await admin
    .from("leagues")
    .select("id, name, slug, league_type, season_slug")
    .eq("id", invite.league_id)
    .maybeSingle();
  if (leagueError || !league?.slug) return null;

  const expiresAt = new Date(String(invite.expires_at ?? ""));
  return {
    token: String(invite.token),
    leagueId: String(league.id),
    leagueName: String(league.name ?? "this league"),
    leagueSlug: String(league.slug),
    leagueType: (league.league_type as string | null) ?? null,
    seasonSlug: (league.season_slug as string | null) ?? null,
    expired: Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now(),
  };
}

export async function getLeagueSlugForJoinCode(code: string): Promise<string | null> {
  const norm = code.trim().toUpperCase().replace(/-/g, "");
  if (norm.length < 6 || norm.length > 16) return null;
  const admin = getAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.from("leagues").select("slug, join_code").not("join_code", "is", null);
  if (error || !data) return null;
  const match = data.find(
    (row) => String(row.join_code ?? "").toUpperCase().replace(/-/g, "") === norm
  );
  return match?.slug ? String(match.slug) : null;
}

/** Reuse the newest unexpired invite, or create one. Does not email anyone. */
export async function ensureReusableLeagueInvite(leagueId: string): Promise<string | null> {
  const admin = getAdminClient();
  if (!admin) return null;

  const { data: existing } = await admin
    .from("league_invites")
    .select("token")
    .eq("league_id", leagueId)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.token) return String(existing.token);

  const { data: league } = await admin
    .from("leagues")
    .select("commissioner_id")
    .eq("id", leagueId)
    .maybeSingle();
  const createdBy = league?.commissioner_id;
  if (!createdBy) return null;

  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_LINK_EXPIRY_DAYS);
  const { error } = await admin.from("league_invites").insert({
    league_id: leagueId,
    token,
    created_by: createdBy,
    expires_at: expiresAt.toISOString(),
  });
  if (error) return null;
  return token;
}
