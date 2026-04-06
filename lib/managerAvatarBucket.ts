import { isAllowedManagerPresetUrl } from "@/lib/managerAvatarPresets";

/** Supabase Storage bucket for manager profile avatars (public read). */
export const MANAGER_AVATARS_BUCKET = "manager-avatars";

const BUCKET_SEGMENT = `/${MANAGER_AVATARS_BUCKET}/`;

function parsePathSegments(url: string): { originOk: boolean; parts: string[] } {
  try {
    const u = new URL(url);
    const idx = u.pathname.indexOf(BUCKET_SEGMENT);
    if (idx < 0) return { originOk: false, parts: [] };
    const rest = u.pathname.slice(idx + BUCKET_SEGMENT.length);
    const parts = rest.split("/").filter(Boolean);
    return { originOk: true, parts };
  } catch {
    return { originOk: false, parts: [] };
  }
}

/** Same Supabase project + bucket path. */
export function isManagerAvatarObjectUrl(url: string, supabaseOrigin: string): boolean {
  try {
    const u = new URL(url);
    const base = new URL(supabaseOrigin);
    return u.origin === base.origin && u.pathname.includes(BUCKET_SEGMENT);
  } catch {
    return false;
  }
}

/**
 * URLs for profiles.avatar_url: curated presets, or legacy manager-avatars/{userId}/... (not .../leagues/...).
 */
export function isProfileManagerAvatarUrl(
  url: string,
  userId: string,
  supabaseOrigin: string
): boolean {
  if (!isManagerAvatarObjectUrl(url, supabaseOrigin)) return false;
  if (isAllowedManagerPresetUrl(url, supabaseOrigin)) return true;
  const { parts } = parsePathSegments(url);
  if (parts.length < 2 || parts[0] !== userId) return false;
  if (parts[1] === "leagues") return false;
  return true;
}

/**
 * URLs for league_members.manager_avatar_url: curated presets, or legacy .../{userId}/leagues/{leagueId}/...
 */
export function isLeagueManagerAvatarUrl(
  url: string,
  userId: string,
  leagueId: string,
  supabaseOrigin: string
): boolean {
  if (!isManagerAvatarObjectUrl(url, supabaseOrigin)) return false;
  if (isAllowedManagerPresetUrl(url, supabaseOrigin)) return true;
  const { parts } = parsePathSegments(url);
  return (
    parts.length >= 4 &&
    parts[0] === userId &&
    parts[1] === "leagues" &&
    parts[2] === leagueId
  );
}

/** Per-league override, else profile default (for league UI). */
export function resolvedManagerAvatarUrl(m: {
  manager_avatar_url?: string | null;
  avatar_url?: string | null;
}): string | null {
  const a = m.manager_avatar_url?.trim() || m.avatar_url?.trim();
  return a || null;
}
