import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import { getAdminClient } from "@/lib/supabase/admin";
import { getLeagueBySlug, getLeagueMembers, getRostersForLeague, getEffectiveLeagueStartDate } from "@/lib/leagues";
import { aggregateWrestlerPoints } from "@/lib/scoring/aggregateWrestlerPoints.js";
import { brandByWrestlerSlugFromRows } from "@/lib/wrestlerBrandLookup";
import {
  getDraftOrder,
  getLeagueDraftState,
  getCurrentPick,
  getDraftPicksHistory,
  getDraftPreferences,
  getDraftPreferencesForAllMembers,
  DEFAULT_AUTOPICK_DESCRIPTION,
  runAutoPickIfExpired,
  MAX_AUTOPICK_PICKS_DRAFT_PAGE,
  repairDraftAutopickCursor,
  isDraftableWrestler,
  normalizeWrestlerRowFromApi,
} from "@/lib/leagueDraft";
import { getAutopickRequiredPriorityCount } from "@/lib/draftPriorityRequirements";
import {
  BETA_AUTOPICK_DRAFT_WINDOW_LABEL,
  BETA_AUTOPICK_FIRST_EVENT_LABEL,
  BETA_AUTOPICK_PREF_DEADLINE_LABEL,
  BETA_AUTOPICK_ROSTERS_LIVE_LABEL,
} from "@/lib/betaAutopickSchedule";
import { MakePickForm } from "./MakePickForm";
import { DraftTimer } from "./DraftTimer";
import { DraftPolling } from "./DraftPolling";
import { CommissionerDraftActions } from "./CommissionerDraftActions";
import { getRosterRulesForLeague, leagueIncludesNxt, leagueUsesSalaryCap } from "@/lib/leagueStructure";
import { EVENT_STATUSES_FOR_SCORING } from "@/lib/eventsScoring";
import { draftEquivalentSlugs } from "@/lib/scoring/personaResolution.js";
import { GenerateDraftOrderForm } from "./GenerateDraftOrderForm";
import { LeagueDraftRoom } from "./LeagueDraftRoom";
import { AutopickClientRunner } from "./AutopickClientRunner";
import { AutopickDraftBoardView } from "./AutopickDraftBoardView";
import { startDraftFromFormAction } from "./actions";
import { getIsSiteAdmin } from "@/lib/auth/siteAdmin";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  try {
    const { slug } = await params;
    const league = await getLeagueBySlug(slug);
    if (!league) return { title: "Draft — Draftastic Fantasy" };
    return {
      title: `Draft — ${league.name} — Draftastic Fantasy`,
      description: `Draft for ${league.name}`,
    };
  } catch {
    return { title: "Draft — Draftastic Fantasy" };
  }
}

export default async function LeagueDraftPage({ params }: Props) {
  const { slug } = await params;
  let league: Awaited<ReturnType<typeof getLeagueBySlug>>;
  let members: Awaited<ReturnType<typeof getLeagueMembers>> = [];
  let order: Awaited<ReturnType<typeof getDraftOrder>> = [];
  let state: Awaited<ReturnType<typeof getLeagueDraftState>> = null;
  let currentPick: Awaited<ReturnType<typeof getCurrentPick>> = null;
  let rosters: Awaited<ReturnType<typeof getRostersForLeague>> = {};
  let wrestlersRows: { id: string; name: string | null; gender: string | null; status?: string | null; brand?: string | null; classification?: string | null; dob?: string | null; image_url?: string | null; "2K26 rating"?: number | null; "2K25 rating"?: number | null }[] = [];
  let memberByUserId: Record<string, { display_name?: string | null; team_name?: string | null }> = {};
  let availableWrestlers: { id: string; name: string | null }[] = [];
  let isCommissioner = false;
  let isSiteAdmin = false;
  let isCurrentPicker = false;
  let picksHistory: Awaited<ReturnType<typeof getDraftPicksHistory>> = [];
  let rosterRules: ReturnType<typeof getRosterRulesForLeague> = null;
  let userDraftPrefs: Awaited<ReturnType<typeof getDraftPreferences>> = null;
  let allMembersPrefs: Awaited<ReturnType<typeof getDraftPreferencesForAllMembers>> = [];
  let pointsBySlug: Record<string, { rsPoints: number; plePoints: number; beltPoints: number }> = {};
  let points2025BySlug: Record<string, { rsPoints: number; plePoints: number; beltPoints: number }> = {};
  let points2026BySlug: Record<string, { rsPoints: number; plePoints: number; beltPoints: number }> = {};
  let pointsAllTimeBySlug: Record<string, { rsPoints: number; plePoints: number; beltPoints: number }> = {};
  /** Set when wrestler pool is loaded; used to show why pool is empty (RLS, filter, missing service role). */
  let wrestlerPoolDiagnostic: {
    source: "user" | "admin" | "none";
    userRawCount: number;
    userError: string | null;
    adminUsed: boolean;
    adminRawCount: number | null;
    adminError: string | null;
    filteredCount: number;
    hasServiceRole: boolean;
  } | null = null;

  try {
    league = await getLeagueBySlug(slug);
    if (!league) notFound();
    if (leagueUsesSalaryCap(league.league_type) || String(league.draft_type ?? "") === "salary_cap") {
      redirect(`/leagues/${slug}/salary-cap`);
    }

    const { supabase: serverSupabase } = await getServerAuth();

    const autopickDisabled = process.env.DISABLE_AUTOPICK_DRAFT === "1" || process.env.DISABLE_AUTOPICK_DRAFT === "true";
    // Only run when a draft is live — avoids admin round-trips on every poll/refresh for not_started/completed.
    const draftStatusEarly = league.draft_status ?? "not_started";
    const isAutopickInProgress =
      !autopickDisabled && draftStatusEarly === "in_progress" && league.draft_type === "autopick";

    // Autopick runs via client server actions (AutopickClientRunner) so this RSC response stays fast.
    // Long synchronous autopick here caused browsers to abort the flight request ("network error").
    if (isAutopickInProgress) {
      await repairDraftAutopickCursor(league.id);
    }

    const autoResult =
      autopickDisabled || draftStatusEarly !== "in_progress"
        ? { didAutoPick: false as const }
        : isAutopickInProgress
          ? { didAutoPick: false as const }
          : await runAutoPickIfExpired(league.id, { maxPicksPerInvocation: MAX_AUTOPICK_PICKS_DRAFT_PAGE });
    if (autoResult.didAutoPick) redirect(`/leagues/${slug}/draft`);

    // Do not auto-start autopick on page load. Beginning/restarting the draft is site-admin-only; cron handles scheduled runs.

    const skipHeavyDraftPool =
      isAutopickInProgress || draftStatusEarly === "completed" || draftStatusEarly === "ready_for_review";

    const emptyWrestlerDiagnostic = {
      source: "none" as const,
      userRawCount: 0,
      userError: null as string | null,
      adminUsed: false,
      adminRawCount: null as number | null,
      adminError: null as string | null,
      filteredCount: 0,
      hasServiceRole: !!getAdminClient(),
    };

    const [membersData, stateData, currentPickData, rostersData, wrestlersResult, picksData, allPrefsData, pointsData] = await Promise.all([
      getLeagueMembers(league.id),
      getLeagueDraftState(league.id),
      getCurrentPick(league.id),
      getRostersForLeague(league.id),
      skipHeavyDraftPool
        ? Promise.resolve({ rows: [] as typeof wrestlersRows, diagnostic: emptyWrestlerDiagnostic })
        : (async () => {
        type Row = {
          id: string;
          name: string | null;
          gender: string | null;
          status?: string | null;
          brand?: string | null;
          classification?: string | null;
          dob?: string | null;
          image_url?: string | null;
          "2K26 rating"?: number | null;
          "2K25 rating"?: number | null;
        };
        const diagnostic: {
          source: "user" | "admin" | "none";
          userRawCount: number;
          userError: string | null;
          adminUsed: boolean;
          adminRawCount: number | null;
          adminError: string | null;
          filteredCount: number;
          hasServiceRole: boolean;
        } = {
          source: "none",
          userRawCount: 0,
          userError: null,
          adminUsed: false,
          adminRawCount: null,
          adminError: null,
          filteredCount: 0,
          hasServiceRole: false,
        };
        const admin = getAdminClient();
        diagnostic.hasServiceRole = !!admin;

        // Same fallback cascade as Draft Testing: try full columns first, then drop
        // Status/Classification (they may not exist in production), then minimal.
        const SELECTS = [
          'id, name, gender, brand, dob, image_url, "Status", "Classification", "2K26 rating", "2K25 rating"',
          'id, name, gender, brand, dob, image_url, "Status", "2K26 rating", "2K25 rating"',
          'id, name, gender, brand, dob, image_url, "2K26 rating", "2K25 rating"',
          'id, name, gender, brand, dob, image_url',
          'id, name, gender, brand',
        ] as const;

        let rawRows: Record<string, unknown>[] = [];
        if (admin) {
          for (const cols of SELECTS) {
            const result = await admin.from("wrestlers").select(cols).order("name", { ascending: true });
            rawRows = ((result.data ?? []) as unknown) as Record<string, unknown>[];
            diagnostic.adminUsed = true;
            diagnostic.adminRawCount = rawRows.length;
            diagnostic.adminError = result.error?.message ?? null;
            if (!result.error && rawRows.length > 0) {
              diagnostic.source = "admin";
              break;
            }
          }
        }
        if (!rawRows.length) {
          for (const cols of SELECTS) {
            const result = await serverSupabase.from("wrestlers").select(cols).order("name", { ascending: true });
            rawRows = ((result.data ?? []) as unknown) as Record<string, unknown>[];
            diagnostic.userRawCount = rawRows.length;
            diagnostic.userError = result.error?.message ?? null;
            if (!result.error && rawRows.length > 0) {
              diagnostic.source = "user";
              break;
            }
          }
        }

        const rows = rawRows.map((r) => ({ ...r, ...normalizeWrestlerRowFromApi(r) })) as Row[];
        const filtered = rows.filter((w) => isDraftableWrestler(w));
        diagnostic.filteredCount = filtered.length;
        return { rows: filtered, diagnostic };
      })(),
      getDraftPicksHistory(league.id),
      skipHeavyDraftPool ? Promise.resolve([] as Awaited<ReturnType<typeof getDraftPreferencesForAllMembers>>) : getDraftPreferencesForAllMembers(league.id),
      skipHeavyDraftPool
        ? Promise.resolve({
            pointsBySlug: {} as Record<string, { rsPoints: number; plePoints: number; beltPoints: number }>,
            points2025BySlug: {},
            points2026BySlug: {},
            pointsAllTimeBySlug: {},
          })
        : (async () => {
            const start = getEffectiveLeagueStartDate(league);
            const ALL_TIME_FROM = "2020-01-01";
            const ALL_TIME_LIMIT = 10000;
            const [sinceStart, events2025, events2026, eventsAll, brandRes] = await Promise.all([
              serverSupabase.from("events").select("id, name, date, matches").in("status", [...EVENT_STATUSES_FOR_SCORING]).gte("date", start).order("date", { ascending: true }),
              serverSupabase.from("events").select("id, name, date, matches").in("status", [...EVENT_STATUSES_FOR_SCORING]).gte("date", "2025-01-01").lte("date", "2025-12-31").order("date", { ascending: true }),
              serverSupabase.from("events").select("id, name, date, matches").in("status", [...EVENT_STATUSES_FOR_SCORING]).gte("date", "2026-01-01").order("date", { ascending: true }),
              serverSupabase.from("events").select("id, name, date, matches").in("status", [...EVENT_STATUSES_FOR_SCORING]).gte("date", ALL_TIME_FROM).order("date", { ascending: true }).limit(ALL_TIME_LIMIT),
              serverSupabase.from("wrestlers").select("id, brand"),
            ]);
            const cast = (d: unknown[]) => d as { id: string; name: string; date: string; matches?: object[] }[];
            const brandBySlugDraft = brandByWrestlerSlugFromRows(
              (brandRes.data ?? []) as { id: string; brand: string | null }[]
            );
            return {
              pointsBySlug: aggregateWrestlerPoints(cast(sinceStart.data ?? []), brandBySlugDraft),
              points2025BySlug: aggregateWrestlerPoints(cast(events2025.data ?? []), brandBySlugDraft),
              points2026BySlug: aggregateWrestlerPoints(cast(events2026.data ?? []), brandBySlugDraft),
              pointsAllTimeBySlug: aggregateWrestlerPoints(cast(eventsAll.data ?? []), brandBySlugDraft),
            };
          })(),
    ]);
    members = membersData;
    picksHistory = picksData;
    allMembersPrefs = allPrefsData;
    pointsBySlug = pointsData.pointsBySlug;
    points2025BySlug = pointsData.points2025BySlug;
    points2026BySlug = pointsData.points2026BySlug;
    pointsAllTimeBySlug = pointsData.pointsAllTimeBySlug;
    state = stateData;
    currentPick = currentPickData;
    rosters = rostersData;
    wrestlersRows = wrestlersResult.rows;
    wrestlerPoolDiagnostic = wrestlersResult.diagnostic;

    memberByUserId = Object.fromEntries(members.map((m) => [m.user_id, { display_name: m.display_name, team_name: m.team_name }]));
    rosterRules = getRosterRulesForLeague(
      members.length,
      league.season_slug ?? null,
      leagueIncludesNxt(league),
      league.league_type ?? null
    );
    const draftedIds = new Set<string>();
    for (const entries of Object.values(rosters)) {
      for (const e of entries) {
        draftedIds.add(e.wrestler_id);
        for (const alias of draftEquivalentSlugs(e.wrestler_id)) draftedIds.add(alias);
      }
    }
    availableWrestlers = wrestlersRows
      .filter((w) => !draftedIds.has(w.id))
      .map((w) => ({ id: w.id, name: w.name }));

    const { user } = await getServerAuth();
    userDraftPrefs = user ? await getDraftPreferences(league.id, user.id) : null;
    isCommissioner = league.role === "commissioner";
    isSiteAdmin = user ? await getIsSiteAdmin() : false;
    isCurrentPicker =
      !!currentPick &&
      !!user &&
      (currentPick.user_id === user.id || isCommissioner);

    const draftStatus = state?.draft_status ?? "not_started";
    const totalPicks = state?.total_picks ?? 0;
    const draftCurrentPick = state?.draft_current_pick ?? null;
    const picksBySlot = Object.fromEntries(picksHistory.map((p) => [p.overall_pick, p]));

    const leagueDraftType =
      league.draft_type === "offline" ? "offline" : league.draft_type === "autopick" ? "autopick" : "autopick";

    const prefSrc = userDraftPrefs?.strategy_options as { priorityListSource?: string } | undefined;
    const customPrefs = prefSrc?.priorityListSource === "custom";
    const listLen = userDraftPrefs?.priority_list?.length ?? 0;
    const autopickRequiredPriorityCount = getAutopickRequiredPriorityCount(leagueIncludesNxt(league));
    const hasAutoDraftSettingsSaved =
      league.draft_type === "autopick"
        ? !customPrefs || listLen >= autopickRequiredPriorityCount
        : userDraftPrefs != null &&
          (userDraftPrefs.priority_list?.length > 0 || userDraftPrefs.strategy_options != null);

    const orderInitial = await getDraftOrder(league.id);
    order = orderInitial;

    function normGender(g: string | null | undefined): "F" | "M" | null {
      if (g == null || typeof g !== "string") return null;
      const l = g.trim().toLowerCase();
      if (l === "female" || l === "f") return "F";
      if (l === "male" || l === "m") return "M";
      return null;
    }
    function countGender(wrestlerIds: string[]): { female: number; male: number } {
      let female = 0;
      let male = 0;
      const byId = new Map(wrestlersRows.map((w) => [w.id.toLowerCase(), w]));
      for (const id of wrestlerIds) {
        const g = normGender(byId.get(id.toLowerCase())?.gender);
        if (g === "F") female++;
        else if (g === "M") male++;
      }
      return { female, male };
    }
    function remainingPicksForUser(userId: string): number {
      const inOrder = order.filter((o) => o.user_id === userId).length;
      const onRoster = (rosters[userId] ?? []).length;
      return inOrder - onRoster;
    }
    function rosterRisk(userId: string): string | null {
      if (!rosterRules) return null;
      const entries = rosters[userId] ?? [];
      const ids = entries.map((e) => e.wrestler_id);
      const { female, male } = countGender(ids);
      const remaining = remainingPicksForUser(userId);
      if (remaining <= 0) return null;
      if (remaining > 3) return null;
      const needs: string[] = [];
      if (female < rosterRules.minFemale) needs.push(`${rosterRules.minFemale - female} more female`);
      if (male < rosterRules.minMale) needs.push(`${rosterRules.minMale - male} more male`);
      return needs.length ? needs.join(", ") : null;
    }

    const isReviewPending = draftStatus === "ready_for_review";
    const canSeeAllDraftReadiness = isCommissioner || isSiteAdmin;
    const readinessRows = canSeeAllDraftReadiness
      ? allMembersPrefs
      : allMembersPrefs.filter((entry) => Boolean(user?.id && entry.user_id === user.id));
    const showDraftRoom =
      (draftStatus === "in_progress" || draftStatus === "completed" || isReviewPending) &&
      order.length > 0 &&
      league.draft_type !== "offline";
    const isAutopickRunning = league.draft_type === "autopick" && draftStatus === "in_progress";
    const wideDraftLayout = showDraftRoom && !isAutopickRunning;
    return (
    <main className="app-page" style={{ maxWidth: wideDraftLayout ? 1100 : 720, margin: "0 auto", padding: showDraftRoom ? "2rem 1rem" : undefined, fontSize: 16, lineHeight: 1.5 }}>
      <h1 style={{ marginBottom: 8, fontSize: "1.5rem", color: "var(--color-text)" }}>Draft</h1>

      <section
          aria-labelledby="league-draft-details-heading"
          style={{
            marginBottom: 24,
            padding: "16px 18px",
            background: "var(--color-bg-elevated)",
            borderRadius: "var(--radius)",
            border: "1px solid var(--color-border)",
          }}
        >
          <h2 id="league-draft-details-heading" style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 12, color: "var(--color-text)" }}>
            League draft details
          </h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 14, color: "var(--color-text-muted)", lineHeight: 1.8 }}>
            <li>
              <strong style={{ color: "var(--color-text)" }}>Draft type:</strong>{" "}
              {leagueDraftType === "offline" ? "Offline" : "Autopick"}
            </li>
            <li>
              <strong style={{ color: "var(--color-text)" }}>Pick order:</strong> Snake (same pattern for any on-site autopick run).
            </li>
            {leagueDraftType === "autopick" && (
              <li>
                <strong style={{ color: "var(--color-text)" }}>Beta schedule:</strong> Set preferences by end of day{" "}
                {BETA_AUTOPICK_PREF_DEADLINE_LABEL}. Autopick runs {BETA_AUTOPICK_DRAFT_WINDOW_LABEL}. Rosters should appear{" "}
                {BETA_AUTOPICK_ROSTERS_LIVE_LABEL}, before {BETA_AUTOPICK_FIRST_EVENT_LABEL}.
              </li>
            )}
            {leagueDraftType === "offline" && (
              <li>
                <strong style={{ color: "var(--color-text)" }}>Rosters:</strong> When your offline draft is done, the GM adds wrestlers
                to each faction from that team&apos;s page (full roster workflow coming soon).
              </li>
            )}
          </ul>
          {isCommissioner && (
            <p style={{ marginTop: 12, marginBottom: 0, fontSize: 13 }}>
              <Link href={`/leagues/${slug}/league-settings#draft-settings-heading`} className="app-link">
                Edit in League Settings →
              </Link>
            </p>
          )}
        </section>

      <section
        aria-labelledby="auto-draft-settings-heading"
        style={{
          marginBottom: 24,
          padding: "16px 18px",
          background: "var(--color-bg-elevated)",
          borderRadius: "var(--radius)",
          border: "1px solid var(--color-border)",
        }}
      >
        <h2 id="auto-draft-settings-heading" style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 8, color: "var(--color-text)" }}>
          Your auto-draft settings
        </h2>
        {hasAutoDraftSettingsSaved && (
          <p style={{ fontSize: "1rem", fontWeight: 700, color: "#0d7d0d", marginBottom: 12 }}>
            Your auto-draft settings have been saved.
          </p>
        )}
        <p style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 12 }}>
          {leagueDraftType === "autopick" ? (
            <>
              Autopick uses your saved priority order (or the site Default Big Board until you deliberately choose another
              provided Big Board or <strong>My own list</strong> via the link below).{" "}
              <strong>Tie-break after your list runs out</strong> (same for everyone): {DEFAULT_AUTOPICK_DESCRIPTION}
            </>
          ) : (
            <>
              If the pick clock runs out, your pick is made automatically using your priority list; after it runs out,
              picks use all-time total points and best-available tie-breaks.
            </>
          )}
        </p>
        {hasAutoDraftSettingsSaved && userDraftPrefs && (
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px", fontSize: 14, color: "var(--color-text-muted)", lineHeight: 1.8 }}>
            {userDraftPrefs.priority_list?.length > 0 && (
              <li>
                <strong style={{ color: "var(--color-text)" }}>Priority list:</strong> {userDraftPrefs.priority_list.length} wrestlers
              </li>
            )}
          </ul>
        )}
        <Link
          href={`/leagues/${slug}/draft/preferences`}
          className="app-link"
          style={{ fontWeight: 600 }}
        >
          {userDraftPrefs ? "Edit your auto-draft preferences" : "Set your auto-draft preferences"} →
        </Link>
      </section>

      {draftStatus === "not_started" && leagueDraftType === "autopick" && readinessRows.length > 0 && (
        <section
          aria-labelledby="auto-draft-readiness-heading"
          style={{
            marginBottom: 24,
            padding: "16px 18px",
            background: "var(--color-bg-elevated)",
            borderRadius: "var(--radius)",
            border: "1px solid var(--color-border)",
          }}
        >
          <h2 id="auto-draft-readiness-heading" style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 12, color: "var(--color-text)" }}>
            Auto-draft readiness
          </h2>
          <p style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 12 }}>
            {canSeeAllDraftReadiness
              ? "Before the draft runs at the scheduled time, confirm each manager has set preferences. If not set, the default is used."
              : "Your readiness is shown below. Only the GM and site admins can view other managers' draft-preference readiness."}
            {" "}
            <strong style={{ color: "var(--color-text)" }}>
              Strategy details (board choice, list length, etc.) are shown only on your own row.
            </strong>
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 14, color: "var(--color-text-muted)", lineHeight: 1.8 }}>
            {readinessRows.map((entry) => {
              const isOwnRow = Boolean(user?.id && entry.user_id === user.id);
              return (
              <li
                key={entry.user_id}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "baseline",
                  gap: 8,
                  padding: "8px 0",
                  borderBottom: "1px solid var(--color-border)",
                }}
              >
                <span style={{ fontWeight: 600, color: "var(--color-text)", minWidth: 120 }}>
                  {entry.display_name}
                </span>
                {entry.hasPreferences ? (
                  <span style={{ color: "#0d7d0d" }}>✓ Preferences set</span>
                ) : (
                  <span style={{ color: "var(--color-text-muted)" }}>Default</span>
                )}
                {isOwnRow ? (
                  <span style={{ width: "100%", fontSize: 13, marginTop: 2 }}>{entry.summary}</span>
                ) : null}
              </li>
            );
            })}
          </ul>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 12, marginBottom: 0 }}>
            <strong>Tie-break after your list runs out</strong> (same for everyone): {DEFAULT_AUTOPICK_DESCRIPTION} Everyone defaults to the
            site Default Big Board until they deliberately choose another provided Big Board or &quot;My own list&quot; under &quot;Set your
            auto-draft preferences&quot; above.
          </p>
        </section>
      )}

      {(draftStatus === "completed" || isReviewPending) && order.length === 0 ? (
        <p style={{ color: "#0d7d0d", fontWeight: 600, marginBottom: 24 }}>Draft completed.</p>
      ) : null}

      {draftStatus !== "completed" && !isReviewPending && league.draft_type !== "offline" && (
        <p style={{ color: "var(--color-text-muted)", marginBottom: 16 }}>
          Snake order · {totalPicks} total picks
        </p>
      )}
      {isReviewPending && (
        <p style={{ color: "var(--color-text-muted)", marginBottom: 16 }}>
          Draft completed. Rosters are being reviewed and will appear shortly.
        </p>
      )}

      {draftStatus === "not_started" && order.length === 0 && (
        <>
          {league.draft_type === "offline" ? (
            <p style={{ marginBottom: 16, color: "var(--color-text-muted)" }}>
              Offline league: there is no on-site draft order. When your draft is finished, the GM adds wrestlers to each roster from the
              team pages (full workflow coming soon).
            </p>
          ) : (
            <>
              <p style={{ marginBottom: 16 }}>
                No pick order yet. The GM must click once below to randomize the full snake order for all managers. This cannot be undone;
                if the GM skips it, a random order is created automatically when autopick runs during {BETA_AUTOPICK_DRAFT_WINDOW_LABEL}.
                Starting the draft, restarting, and undoing picks are handled from the site admin panel.
              </p>
              {isCommissioner && <GenerateDraftOrderForm leagueSlug={slug} />}
            </>
          )}
        </>
      )}

      {draftStatus === "not_started" && order.length > 0 && (
        <>
          <p style={{ marginBottom: 8, color: "#555" }}>
            {league.draft_type === "autopick"
              ? "Pick order is locked in (snake). Autopick runs during the beta window — you do not start the draft manually."
              : "Draft order is listed below for reference."}
          </p>
          {!isSiteAdmin && league.draft_type === "autopick" && (
            <p style={{ marginBottom: 24, fontSize: 14, color: "#666" }}>
              A site admin starts the draft from the site admin panel when it is time. You can still set preferences until the deadline in
              League draft details.
            </p>
          )}
          {isSiteAdmin && league.draft_type === "autopick" && (
            <form action={startDraftFromFormAction} style={{ marginBottom: 16 }}>
              <input type="hidden" name="league_slug" value={slug} />
              <button type="submit" className="app-button">
                Begin draft now
              </button>
            </form>
          )}
          <section style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: "1.1rem", marginBottom: 12, color: "var(--color-text)" }}>Draft board</h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, border: "1px solid var(--color-border)", borderRadius: "var(--radius)", overflow: "hidden", background: "var(--color-bg-surface)" }}>
              {order.map((o) => {
                const managerName = memberByUserId[o.user_id]?.display_name?.trim() ?? "Unknown";
                return (
                  <li
                    key={o.overall_pick}
                    style={{
                      padding: "10px 14px",
                      borderBottom: "1px solid var(--color-border)",
                      fontSize: 14,
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <span style={{ color: "var(--color-text-muted)", fontWeight: 600 }}>#{o.overall_pick} · {managerName}</span>
                    <span style={{ color: "var(--color-text-dim)" }}>—</span>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      {(draftStatus === "in_progress" || draftStatus === "completed" || isReviewPending) && order.length > 0 && (
        <>
          {draftStatus === "in_progress" && !autopickDisabled && (
            <DraftPolling
              isAutopick={league.draft_type === "autopick"}
              intervalMs={isAutopickRunning ? 3500 : undefined}
            />
          )}
          {draftStatus === "in_progress" && !autopickDisabled && league.draft_type === "autopick" && isSiteAdmin && (
            <AutopickClientRunner leagueSlug={slug} enabled />
          )}
          {isAutopickRunning || draftStatus === "completed" || isReviewPending ? (
            <AutopickDraftBoardView
              leagueSlug={slug}
              order={order}
              picksHistory={picksHistory}
              members={members.map((m) => ({ user_id: m.user_id, display_name: m.display_name, team_name: m.team_name }))}
              draftStatus={draftStatus === "completed" || isReviewPending ? "completed" : "in_progress"}
              currentPickSlot={draftStatus === "completed" || isReviewPending ? null : draftCurrentPick}
              totalPicks={totalPicks}
              isAutopickLeague={league.draft_type === "autopick"}
            />
          ) : null}
          {!isAutopickRunning ? (
            <div style={{ marginTop: draftStatus === "completed" || isReviewPending ? 28 : 0 }}>
            <LeagueDraftRoom
              siteAdminRecoveryHintForAutopickConflict={!isSiteAdmin}
              autopickError={autoResult?.error ?? null}
              order={order}
              picksHistory={picksHistory}
              members={members.map((m) => ({ user_id: m.user_id, display_name: m.display_name, team_name: m.team_name }))}
              wrestlerPoolDiagnostic={wrestlerPoolDiagnostic}
              wrestlers={wrestlersRows.map((w) => ({
                id: w.id,
                name: w.name ?? null,
                gender: w.gender ?? null,
                brand: w.brand ?? null,
                dob: w.dob ?? null,
                image_url: w.image_url ?? null,
                rating_2k26: (w as { "2K26 rating"?: number | null })["2K26 rating"] ?? null,
                rating_2k25: (w as { "2K25 rating"?: number | null })["2K25 rating"] ?? null,
              }))}
              pointsBySlug={pointsBySlug}
              points2025BySlug={points2025BySlug}
              points2026BySlug={points2026BySlug}
              pointsAllTimeBySlug={pointsAllTimeBySlug}
              draftedIds={Array.from(draftedIds)}
              rosterEntriesByUser={rosters}
              currentPickSlot={draftCurrentPick}
              totalPicks={totalPicks}
              draftStatus={draftStatus}
              currentPickerUserId={currentPick?.user_id ?? null}
              isCurrentPicker={isCurrentPicker}
              leagueSlug={slug}
              draftCurrentPickStartedAt={state?.draft_current_pick_started_at ?? null}
              timePerPickSeconds={
                league.draft_type === "autopick"
                  ? 5
                  : (league.time_per_pick_seconds ?? 120)
              }
              showTimerForAll={league.draft_type === "autopick"}
              defaultIncludeNxtInPool={leagueIncludesNxt(league)}
            />
            </div>
          ) : null}
          {(draftStatus === "in_progress" || draftStatus === "completed" || isReviewPending) && isSiteAdmin && (
            <div style={{ marginTop: 24 }}>
              <CommissionerDraftActions leagueSlug={slug} canClearLastPick={picksHistory.length > 0} />
            </div>
          )}
        </>
      )}
    </main>
    );
  } catch (e) {
    // Let Next.js handle notFound() / redirect() so we don't show generic error for 404s
    const err = e as { digest?: string };
    if (err?.digest && String(err.digest).startsWith("NEXT_")) throw e;
    return (
      <main style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 720, margin: "0 auto" }}>
        <p style={{ marginBottom: 24 }}>
          <Link href="/leagues" style={{ color: "#1a73e8", textDecoration: "none" }}>← My leagues</Link>
        </p>
        <h1 style={{ fontSize: "1.25rem", marginBottom: 16 }}>Something went wrong</h1>
        <p style={{ color: "#666", marginBottom: 16 }}>
          We couldn’t load the draft. You may need to sign in, or the league may not exist.
        </p>
        <Link href="/leagues" style={{ color: "#1a73e8", textDecoration: "none" }}>Back to My leagues</Link>
      </main>
    );
  }
}
