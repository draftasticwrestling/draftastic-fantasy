import "server-only";

import { leagueOnboardingPath, leagueUsesMemberOnboarding, resolveMemberOnboardingState } from "@/lib/leagueOnboarding";
import {
  isPlacedLeagueMember,
  maybeActivatePlacementForStartedRoster,
} from "@/lib/leaguePlacement";
import { PLAY_PATH } from "@/lib/playFunnel";
import { isPublicSalaryCapLeague } from "@/lib/publicLeagueSchedule";
import { getSalaryCapLeagueMeta, getSalaryCapSpentForUser } from "@/lib/salaryCap";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import { getAdminClient } from "@/lib/supabase/admin";
import { getIsSiteAdmin } from "@/lib/auth/siteAdmin";
import { hasAdequateAutopickDraftPreferences } from "@/lib/draftBigBoards";
import { isRoadToWarGamesSeasonSlug } from "@/lib/leagueStructure";

export type LoginNudgeKey = "missing_draft_prefs" | "no_league_joined" | "pending_league_setup";

/** Shown once per browser (localStorage) when rules match; not configurable in admin. */
export type DynamicLoginNudgeKey = "salary_cap_budget_remaining" | "drafts_ready_for_review";

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
    title: "Join or create a league",
    body: "You're not in a league yet. Play now to join a public league or create one for your group.",
    primary_cta_label: "Play now",
    primary_cta_href: PLAY_PATH,
    secondary_cta_label: null,
    secondary_cta_href: null,
  },
  pending_league_setup: {
    nudge_key: "pending_league_setup",
    enabled: true,
    title: "Finish your league setup",
    body: "You joined {{league_name}} but haven't finished roster setup yet. Build your roster and complete setup before Monday so you keep your spot.",
    primary_cta_label: "Complete setup",
    primary_cta_href: "/leagues",
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
      raw.nudge_key !== "pending_league_setup"
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
    .select(
      "league_id, placement_status, onboarding_completed_at, leagues!inner(slug, name, draft_status, is_archived, league_type, season_slug, visibility_type, draft_type, include_nxt)"
    )
    .eq("user_id", user.id);
  if (!primary.error) {
    memberships = primary.data as unknown[] | null;
  } else {
    // Be resilient to partial schema drift (e.g. missing placement_status / is_archived columns).
    const fallback = await supabase
      .from("league_members")
      .select(
        "league_id, onboarding_completed_at, leagues!inner(slug, name, draft_status, league_type, season_slug, visibility_type, draft_type, include_nxt)"
      )
      .eq("user_id", user.id);
    if (!fallback.error) {
      memberships = fallback.data as unknown[] | null;
    } else {
      const minimal = await supabase
        .from("league_members")
        .select("league_id, leagues!inner(slug, name)")
        .eq("user_id", user.id);
      memberships = minimal.error ? [] : (minimal.data as unknown[] | null);
    }
  }

  const leagueRows = (memberships ?? []) as Array<{
    league_id: string;
    placement_status?: string | null;
    onboarding_completed_at?: string | null;
    leagues?: {
      slug?: string | null;
      name?: string | null;
      draft_status?: string | null;
      is_archived?: boolean | null;
      league_type?: string | null;
      season_slug?: string | null;
      visibility_type?: string | null;
      draft_type?: string | null;
      include_nxt?: boolean | null;
    } | null;
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
  const leagueMetaById = new Map<
    string,
    {
      slug: string;
      league_type?: string | null;
      season_slug?: string | null;
      draft_type?: string | null;
      include_nxt?: boolean | null;
    }
  >();
  for (const row of eligibleLeagueRows) {
    const slug = row.leagues?.slug;
    if (slug) {
      slugByLeagueId.set(row.league_id, slug);
      leagueMetaById.set(row.league_id, {
        slug,
        league_type: row.leagues?.league_type ?? null,
        season_slug: row.leagues?.season_slug ?? null,
        draft_type: row.leagues?.draft_type ?? null,
        include_nxt: row.leagues?.include_nxt ?? null,
      });
    }
  }
  const draftLeagueIds = eligibleLeagueRows
    .filter((row) => row.leagues?.league_type !== "salary_cap")
    .map((r) => r.league_id);

  const configs = await getLoginNudgeConfigs();
  const nudges: UserLoginNudge[] = [];

  const { data: activeRosterRows } = await supabase
    .from("league_rosters")
    .select("league_id")
    .eq("user_id", user.id)
    .is("released_at", null);
  const rosterCountByLeagueId = new Map<string, number>();
  for (const row of activeRosterRows ?? []) {
    const leagueId = (row as { league_id: string }).league_id;
    rosterCountByLeagueId.set(leagueId, (rosterCountByLeagueId.get(leagueId) ?? 0) + 1);
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

  const pendingPlacementRows = leagueRows.filter((row) => {
    if (Boolean(row.leagues?.is_archived)) return false;
    const leagueCtx = {
      visibility_type: row.leagues?.visibility_type ?? null,
      league_type: row.leagues?.league_type ?? null,
      season_slug: row.leagues?.season_slug ?? null,
    };
    if (!isPublicSalaryCapLeague(leagueCtx)) return false;
    return !isPlacedLeagueMember(
      {
        placement_status: row.placement_status as "pending" | "active" | null | undefined,
        onboarding_completed_at: row.onboarding_completed_at ?? null,
        active_roster_count: rosterCountByLeagueId.get(row.league_id) ?? 0,
      },
      leagueCtx
    );
  });

  if (pendingPlacementRows.length > 0) {
    const cfg = configs.pending_league_setup;
    if (cfg.enabled) {
      const first = pendingPlacementRows[0];
      const slug = first.leagues?.slug?.trim() ?? "";
      const leagueName = first.leagues?.name?.trim() || slug || "your public league";
      let href = cfg.primary_cta_href || "/leagues";
      if (slug && pendingPlacementRows.length === 1) {
        const leagueMeta = {
          slug,
          league_type: first.leagues?.league_type ?? null,
          season_slug: first.leagues?.season_slug ?? null,
        };
        const { needsOnboarding } = await resolveMemberOnboardingState(
          supabase,
          first.league_id,
          leagueMeta,
          user.id
        );
        href = needsOnboarding
          ? leagueOnboardingPath(slug)
          : `/leagues/${encodeURIComponent(slug)}/salary-cap`;
      }
      nudges.push({
        key: cfg.nudge_key,
        title: cfg.title,
        body: renderTemplate(cfg.body, {
          pending_count: pendingPlacementRows.length,
          league_name: leagueName,
        }),
        primaryCta:
          cfg.primary_cta_label && href ? { label: cfg.primary_cta_label, href } : null,
        secondaryCta:
          cfg.secondary_cta_label && cfg.secondary_cta_href
            ? { label: cfg.secondary_cta_label, href: cfg.secondary_cta_href }
            : null,
      });
    }
  }

  const budgetRemainingRows = leagueRows.filter((row) => {
    if (Boolean(row.leagues?.is_archived)) return false;
    if (row.onboarding_completed_at?.trim()) return false;
    const leagueCtx = {
      visibility_type: row.leagues?.visibility_type ?? null,
      league_type: row.leagues?.league_type ?? null,
      season_slug: row.leagues?.season_slug ?? null,
    };
    if (!isPublicSalaryCapLeague(leagueCtx)) return false;
    const activeRosterCount = rosterCountByLeagueId.get(row.league_id) ?? 0;
    if (activeRosterCount === 0) return false;
    return isPlacedLeagueMember(
      {
        placement_status: row.placement_status as "pending" | "active" | null | undefined,
        onboarding_completed_at: row.onboarding_completed_at ?? null,
        active_roster_count: activeRosterCount,
      },
      leagueCtx
    );
  });

  if (budgetRemainingRows.length > 0) {
    const first = budgetRemainingRows[0];
    const slug = first.leagues?.slug?.trim() ?? "";
    const leagueName = first.leagues?.name?.trim() || slug || "your public league";
    const meta = await getSalaryCapLeagueMeta(supabase, first.league_id);
    const { spent } = await getSalaryCapSpentForUser(supabase, first.league_id, user.id);
    const remaining = (meta?.budget ?? 100) - spent;
    if (remaining > 0) {
      const href = slug ? `/leagues/${encodeURIComponent(slug)}/salary-cap` : "/leagues";
      nudges.push({
        key: "salary_cap_budget_remaining",
        title: "Finish building your roster",
        body: `You still have $${remaining} left on your fantasy salary cap in ${leagueName}. Add wrestlers before Monday RAW (5 PM PT), or complete setup when you're ready.`,
        primaryCta: { label: "Build roster", href },
        secondaryCta: null,
      });
    }
  }

  type PrefRow = {
    league_id: string;
    priority_list?: unknown;
    strategy_options?: unknown;
  };
  const prefByLeagueId = new Map<string, PrefRow>();
  if (draftLeagueIds.length > 0) {
    const { data: prefRows } = await supabase
      .from("league_draft_preferences")
      .select("league_id, priority_list, strategy_options")
      .eq("user_id", user.id)
      .in("league_id", draftLeagueIds);
    for (const row of (prefRows ?? []) as PrefRow[]) {
      prefByLeagueId.set(row.league_id, row);
    }
  }

  function priorityListFromPref(prefs: PrefRow | undefined): string[] {
    if (!prefs) return [];
    if (Array.isArray(prefs.priority_list)) return prefs.priority_list as string[];
    if (typeof prefs.priority_list === "string") {
      try {
        const parsed = JSON.parse(prefs.priority_list) as unknown;
        return Array.isArray(parsed) ? (parsed as string[]) : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  function priorityListSourceFromPref(prefs: PrefRow | undefined): string | null {
    if (!prefs?.strategy_options) return null;
    let so = prefs.strategy_options as { priorityListSource?: string } | string;
    if (typeof so === "string") {
      try {
        so = JSON.parse(so) as { priorityListSource?: string };
      } catch {
        return null;
      }
    }
    const src = so?.priorityListSource?.trim();
    return src || null;
  }

  const missingLeagueIds = draftLeagueIds.filter((id) => {
    const meta = leagueMetaById.get(id);
    const prefs = prefByLeagueId.get(id);
    // Road to War Games: Big Boards just shipped — require a deliberate adequate list/board.
    if (isRoadToWarGamesSeasonSlug(meta?.season_slug)) {
      return !hasAdequateAutopickDraftPreferences({
        includeNxt: true,
        priorityList: priorityListFromPref(prefs),
        priorityListSource: priorityListSourceFromPref(prefs),
      });
    }
    return !prefs;
  });

  if (missingLeagueIds.length > 0) {
    const cfg = configs.missing_draft_prefs;
    if (cfg.enabled) {
      const missingSingleId = missingLeagueIds.length === 1 ? missingLeagueIds[0] : null;
      const missingSingleMeta = missingSingleId ? leagueMetaById.get(missingSingleId) ?? null : null;
      const href = missingSingleMeta
        ? leagueUsesMemberOnboarding(missingSingleMeta)
          ? leagueOnboardingPath(missingSingleMeta.slug)
          : `/leagues/${encodeURIComponent(missingSingleMeta.slug)}/draft/preferences`
        : cfg.primary_cta_href || "/leagues";
      const hasR2wgMissing = missingLeagueIds.some((id) =>
        isRoadToWarGamesSeasonSlug(leagueMetaById.get(id)?.season_slug)
      );
      const title = hasR2wgMissing ? "Set your Road to War Games draft list" : cfg.title;
      const body = hasR2wgMissing
        ? renderTemplate(
            "Big Boards are ready for Road to War Games. Set draft preferences in {{missing_count}} of your {{league_count}} league(s).",
            {
              missing_count: missingLeagueIds.length,
              league_count: draftLeagueIds.length,
            }
          )
        : renderTemplate(cfg.body, {
            missing_count: missingLeagueIds.length,
            league_count: draftLeagueIds.length,
          });
      nudges.push({
        key: cfg.nudge_key,
        title,
        body,
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

  const isSiteAdminUser = await getIsSiteAdmin();
  if (isSiteAdminUser) {
    const admin = getAdminClient();
    if (admin) {
      const { count } = await admin
        .from("leagues")
        .select("id", { count: "exact", head: true })
        .eq("draft_status", "ready_for_review")
        .eq("is_archived", false);
      const pending = count ?? 0;
      if (pending > 0) {
        nudges.push({
          key: "drafts_ready_for_review",
          title: pending === 1 ? "1 draft ready for review" : `${pending} drafts ready for review`,
          body:
            pending === 1
              ? "A league draft finished and is awaiting site admin approval before rosters go live."
              : "League drafts finished and are awaiting site admin approval before rosters go live.",
          primaryCta: {
            label: "Review drafts",
            href: "/internal-admin/leagues",
          },
          secondaryCta: null,
          persist: "daily",
        });
      }
    }
  }

  return nudges;
}
