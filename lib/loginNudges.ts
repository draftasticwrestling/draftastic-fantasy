import "server-only";

import { getServerAuth } from "@/lib/supabase/serverAuth";
import { getAdminClient } from "@/lib/supabase/admin";

export type LoginNudgeKey = "missing_draft_prefs" | "no_league_joined";

/** Shown once per browser (localStorage) when rules match; not configurable in admin. */
export type DynamicLoginNudgeKey = "post_draft_roster_check";

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
  key: LoginNudgeKey | DynamicLoginNudgeKey;
  title: string;
  body: string;
  primaryCta: { label: string; href: string } | null;
  secondaryCta: { label: string; href: string } | null;
  /** `once` = dismiss forever in this browser (see LoginNudges). Default daily cap. */
  persist?: "daily" | "once";
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
    body: "You're not in a league yet. Join a private league with a code from your GM, or create your own to get started.",
    primary_cta_label: "Join a league",
    primary_cta_href: "/leagues/join",
    secondary_cta_label: "Create a league",
    secondary_cta_href: "/leagues/new",
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
    if (raw.nudge_key !== "missing_draft_prefs" && raw.nudge_key !== "no_league_joined") {
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
  /** Leagues where the draft is not fully finished — prefs still matter (excludes completed + ready_for_review). */
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

  const completedDraftRows = leagueRows.filter((row) => {
    if (Boolean(row.leagues?.is_archived)) return false;
    return String(row.leagues?.draft_status ?? "") === "completed";
  });
  const firstCompletedSlug =
    completedDraftRows.map((r) => r.leagues?.slug).find((s) => s && String(s).trim().length > 0) ?? null;

  const configs = await getLoginNudgeConfigs();
  const nudges: UserLoginNudge[] = [];

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

  if (completedDraftRows.length > 0) {
    const rosterHref = firstCompletedSlug
      ? `/leagues/${encodeURIComponent(firstCompletedSlug)}/faction`
      : "/leagues";
    nudges.push({
      key: "post_draft_roster_check",
      title: "Check your roster!",
      body: "Your draft is complete and your roster is ready. Backlash is less than a week away!",
      primaryCta: { label: "View roster", href: rosterHref },
      secondaryCta: null,
      persist: "once",
    });
  }

  return nudges;
}
