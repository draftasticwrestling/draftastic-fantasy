import "server-only";

import { getServerAuth } from "@/lib/supabase/serverAuth";
import { getAdminClient } from "@/lib/supabase/admin";

export type LoginNudgeKey = "missing_draft_prefs" | "no_league_joined" | "big_boards_updated";

export type LoginNudgeConfig = {
  nudge_key: LoginNudgeKey;
  enabled: boolean;
  title: string;
  body: string;
  primary_cta_label: string | null;
  primary_cta_href: string | null;
  secondary_cta_label: string | null;
  secondary_cta_href: string | null;
};

export type UserLoginNudge = {
  key: LoginNudgeKey;
  title: string;
  body: string;
  primaryCta: { label: string; href: string } | null;
  secondaryCta: { label: string; href: string } | null;
};

const DEFAULT_CONFIGS: Record<LoginNudgeKey, LoginNudgeConfig> = {
  missing_draft_prefs: {
    nudge_key: "missing_draft_prefs",
    enabled: true,
    title: "Set your draft preferences",
    body: "You still need to save draft preferences in {{missing_count}} of your {{league_count}} league(s).",
    primary_cta_label: "Set draft preferences",
    primary_cta_href: "/leagues",
    secondary_cta_label: null,
    secondary_cta_href: null,
  },
  no_league_joined: {
    nudge_key: "no_league_joined",
    enabled: true,
    title: "Create or join a league",
    body: "You're not in a league yet. Join a public/private league or create your own to get started.",
    primary_cta_label: "Join a league",
    primary_cta_href: "/leagues/join",
    secondary_cta_label: "Create a league",
    secondary_cta_href: "/leagues/new",
  },
  big_boards_updated: {
    nudge_key: "big_boards_updated",
    enabled: true,
    title: "BIG BOARDS UPDATED",
    body: "Much has changed since WrestleMania, with releases and call ups, so our Big Boards have changed as well! Check out the updates and make sure you like your draft order. Drafts begin May 1st!",
    primary_cta_label: null,
    primary_cta_href: null,
    secondary_cta_label: null,
    secondary_cta_href: null,
  },
};

function renderTemplate(
  template: string,
  vars: Record<string, string | number | null | undefined>
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    const v = vars[key];
    return v == null ? "" : String(v);
  });
}

export async function getLoginNudgeConfigs(): Promise<Record<LoginNudgeKey, LoginNudgeConfig>> {
  const admin = getAdminClient();
  if (!admin) return DEFAULT_CONFIGS;
  const { data, error } = await admin
    .from("site_login_nudges")
    .select(
      "nudge_key, enabled, title, body, primary_cta_label, primary_cta_href, secondary_cta_label, secondary_cta_href"
    );
  if (error || !data) return DEFAULT_CONFIGS;

  const out: Record<LoginNudgeKey, LoginNudgeConfig> = {
    ...DEFAULT_CONFIGS,
  };
  for (const raw of data as LoginNudgeConfig[]) {
    if (
      raw.nudge_key !== "missing_draft_prefs" &&
      raw.nudge_key !== "no_league_joined" &&
      raw.nudge_key !== "big_boards_updated"
    ) {
      continue;
    }
    out[raw.nudge_key] = {
      ...DEFAULT_CONFIGS[raw.nudge_key],
      ...raw,
    };
  }
  return out;
}

export async function getLoginNudgesForCurrentUser(): Promise<UserLoginNudge[]> {
  const { supabase, user } = await getServerAuth();
  if (!user) return [];

  let memberships: unknown[] | null = null;
  const primary = await supabase
    .from("league_members")
    .select("league_id, leagues!inner(slug, draft_status, is_archived)")
    .eq("user_id", user.id);
  if (!primary.error) {
    memberships = primary.data as unknown[] | null;
  } else {
    // Be resilient to partial schema drift (e.g. missing is_archived / draft_status columns).
    const fallback = await supabase
      .from("league_members")
      .select("league_id, leagues!inner(slug, draft_status)")
      .eq("user_id", user.id);
    if (!fallback.error) {
      memberships = fallback.data as unknown[] | null;
    } else {
      const minimal = await supabase
        .from("league_members")
        .select("league_id, leagues!inner(slug)")
        .eq("user_id", user.id);
      memberships = minimal.error ? [] : (minimal.data as unknown[] | null);
    }
  }

  const leagueRows = (memberships ?? []) as Array<{
    league_id: string;
    leagues?: { slug?: string | null; draft_status?: string | null; is_archived?: boolean | null } | null;
  }>;
  const eligibleLeagueRows = leagueRows.filter((row) => {
    const isArchived = Boolean(row.leagues?.is_archived);
    if (isArchived) return false;
    const draftStatus = String(row.leagues?.draft_status ?? "not_started");
    return draftStatus !== "completed" && draftStatus !== "ready_for_review";
  });
  const leagueIds = eligibleLeagueRows.map((r) => r.league_id);
  const slugByLeagueId = new Map<string, string>();
  for (const row of eligibleLeagueRows) {
    const slug = row.leagues?.slug;
    if (slug) slugByLeagueId.set(row.league_id, slug);
  }

  const configs = await getLoginNudgeConfigs();
  const nudges: UserLoginNudge[] = [];

  const bigBoardsCfg = configs.big_boards_updated;
  if (bigBoardsCfg.enabled) {
    nudges.push({
      key: bigBoardsCfg.nudge_key,
      title: bigBoardsCfg.title,
      body: bigBoardsCfg.body,
      primaryCta:
        bigBoardsCfg.primary_cta_label && bigBoardsCfg.primary_cta_href
          ? { label: bigBoardsCfg.primary_cta_label, href: bigBoardsCfg.primary_cta_href }
          : null,
      secondaryCta:
        bigBoardsCfg.secondary_cta_label && bigBoardsCfg.secondary_cta_href
          ? { label: bigBoardsCfg.secondary_cta_label, href: bigBoardsCfg.secondary_cta_href }
          : null,
    });
  }

  // Only show "no league joined" when the user truly has no memberships.
  if (leagueRows.length === 0) {
    const cfg = configs.no_league_joined;
    if (cfg.enabled) {
      nudges.push({
        key: cfg.nudge_key,
        title: cfg.title,
        body: cfg.body,
        primaryCta:
          cfg.primary_cta_label && cfg.primary_cta_href
            ? { label: cfg.primary_cta_label, href: cfg.primary_cta_href }
            : null,
        secondaryCta:
          cfg.secondary_cta_label && cfg.secondary_cta_href
            ? { label: cfg.secondary_cta_label, href: cfg.secondary_cta_href }
            : null,
      });
    }
    return nudges;
  }

  const { data: prefRows } = await supabase
    .from("league_draft_preferences")
    .select("league_id")
    .eq("user_id", user.id)
    .in("league_id", leagueIds);
  const prefLeagueIds = new Set(((prefRows ?? []) as { league_id: string }[]).map((r) => r.league_id));
  const missingLeagueIds = leagueIds.filter((id) => !prefLeagueIds.has(id));

  if (missingLeagueIds.length > 0) {
    const cfg = configs.missing_draft_prefs;
    if (cfg.enabled) {
      const missingSingleSlug = missingLeagueIds.length === 1 ? slugByLeagueId.get(missingLeagueIds[0]) ?? null : null;
      const href =
        missingSingleSlug
          ? `/leagues/${encodeURIComponent(missingSingleSlug)}/draft/preferences`
          : cfg.primary_cta_href || "/leagues";
      nudges.push({
        key: cfg.nudge_key,
        title: cfg.title,
        body: renderTemplate(cfg.body, {
          missing_count: missingLeagueIds.length,
          league_count: leagueIds.length,
        }),
        primaryCta:
          cfg.primary_cta_label && href
            ? { label: cfg.primary_cta_label, href }
            : null,
        secondaryCta:
          cfg.secondary_cta_label && cfg.secondary_cta_href
            ? { label: cfg.secondary_cta_label, href: cfg.secondary_cta_href }
            : null,
      });
    }
  }

  return nudges;
}
