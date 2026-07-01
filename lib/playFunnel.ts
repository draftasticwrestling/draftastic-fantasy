/** Unified entry point for new players: sign in → join or create a league. */

export const PLAY_PATH = "/play";

export type PlayFunnelStep =
  | "choose"
  | "join"
  | "join-public"
  | "join-private"
  | "create";

export type ProfileLeagueReadiness = {
  ready: boolean;
  accountHref: string | null;
  missingLabels: string[];
};

type ProfileInput = {
  display_name?: string | null;
  accepted_terms_at?: string | null;
  accepted_privacy_at?: string | null;
  timezone?: string | null;
  needs_avatar_selection?: boolean | null;
  is_site_admin?: boolean | null;
};

export function buildPlayPath(query?: Record<string, string | undefined | null>): string {
  if (!query) return PLAY_PATH;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value != null && value !== "") qs.set(key, value);
  }
  const s = qs.toString();
  return s ? `${PLAY_PATH}?${s}` : PLAY_PATH;
}

export function authPathForPlay(playReturnPath: string, mode: "sign-in" | "sign-up"): string {
  return `/auth/${mode}?next=${encodeURIComponent(playReturnPath)}`;
}

export function getProfileLeagueReadiness(
  profile: ProfileInput | null | undefined,
  continuePath: string
): ProfileLeagueReadiness {
  const missingLabels: string[] = [];
  if (!profile?.display_name?.trim()) missingLabels.push("Display name");
  if (!profile?.accepted_terms_at || !profile?.accepted_privacy_at) {
    missingLabels.push("Terms and privacy acceptance");
  }
  if (!profile?.timezone?.trim()) missingLabels.push("Timezone");
  if (
    Boolean(profile?.needs_avatar_selection) &&
    !Boolean(profile?.is_site_admin)
  ) {
    missingLabels.push("Manager avatar");
  }
  return {
    ready: missingLabels.length === 0,
    missingLabels,
    accountHref: missingLabels.length
      ? `/account?required=1&next=${encodeURIComponent(continuePath)}`
      : null,
  };
}

export const PUBLIC_JOIN_STEPS = [
  {
    title: "Create your faction",
    detail: "Pick a team name, manager avatar, and catchphrase.",
  },
  {
    title: "Build your roster",
    detail:
      "Pick wrestlers using your $100 fantasy salary cap. Playing is free—the cap only limits in-game roster value, not what you pay.",
  },
  {
    title: "Compete weekly",
    detail:
      "Earn points from RAW, SmackDown, and PLEs. Scoring begins on Mondays after at least three factions finish setup.",
  },
] as const;
