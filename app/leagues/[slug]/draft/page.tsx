import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getLeagueBySlug, getLeagueMembers, getRostersForLeague, getEffectiveLeagueStartDate } from "@/lib/leagues";
import { aggregateWrestlerPoints } from "@/lib/scoring/aggregateWrestlerPoints.js";
import {
  getDraftOrder,
  getLeagueDraftState,
  getCurrentPick,
  getDraftPicksHistory,
  getDraftPreferences,
  getDraftPreferencesForAllMembers,
  runAutoPickIfExpired,
  runFullAutopickDraftAtScheduledTime,
  isDraftableWrestler,
  normalizeWrestlerRowFromApi,
} from "@/lib/leagueDraft";
import { generateDraftOrderFromFormAction, startDraftFromFormAction } from "./actions";
import { MakePickForm } from "./MakePickForm";
import { DraftTimer } from "./DraftTimer";
import { DraftPolling } from "./DraftPolling";
import { CommissionerDraftActions } from "./CommissionerDraftActions";
import { getRosterRulesForLeague } from "@/lib/leagueStructure";
import { GenerateDraftOrderForm } from "./GenerateDraftOrderForm";
import { LeagueDraftRoom } from "./LeagueDraftRoom";

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
  let isCurrentPicker = false;
  let picksHistory: Awaited<ReturnType<typeof getDraftPicksHistory>> = [];
  let rosterRules: ReturnType<typeof getRosterRulesForLeague> = null;
  let userDraftPrefs: Awaited<ReturnType<typeof getDraftPreferences>> = null;
  let allMembersPrefs: Awaited<ReturnType<typeof getDraftPreferencesForAllMembers>> = [];
  let pointsBySlug: Record<string, { rsPoints: number; plePoints: number; beltPoints: number }> = {};
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

    const autoResult = await runAutoPickIfExpired(league.id);
    if (autoResult.didAutoPick) redirect(`/leagues/${slug}/draft`);

    const draftStateForAutostart = await getLeagueDraftState(league.id);
    const leagueDraftTypeForAutostart = league.draft_type ?? (league.draft_style === "linear" ? "linear" : "snake");
    if (
      leagueDraftTypeForAutostart === "autopick" &&
      (draftStateForAutostart?.draft_status ?? "not_started") === "not_started"
    ) {
      const fullAutopick = await runFullAutopickDraftAtScheduledTime(league.id);
      if (fullAutopick.didRun) redirect(`/leagues/${slug}/draft`);
    }

    const [membersData, stateData, currentPickData, rostersData, wrestlersResult, picksData, allPrefsData, pointsData] = await Promise.all([
      getLeagueMembers(league.id),
      getLeagueDraftState(league.id),
      getCurrentPick(league.id),
      getRostersForLeague(league.id),
      (async () => {
        type Row = { id: string; name: string | null; gender: string | null; status?: string | null; brand?: string | null; classification?: string | null; dob?: string | null; image_url?: string | null; "2K26 rating"?: number | null; "2K25 rating"?: number | null };
        const selectCols = 'id, name, gender, status, "Status", brand, classification, "Classification", dob, image_url, "2K26 rating", "2K25 rating"';
        const selectColsMinimal = 'id, name, gender, status, "Status", brand, classification, "Classification"';
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

        // Prefer admin client when available so draft page bypasses RLS (same as Draft Testing intent).
        // Draft Testing uses createClient() but is under /admin; league draft is per-league and may hit RLS.
        let rawRows: Record<string, unknown>[] = [];
        if (admin) {
          const adminResult = await admin.from("wrestlers").select(selectCols).order("name", { ascending: true });
          rawRows = (adminResult.data ?? []) as Record<string, unknown>[];
          diagnostic.adminUsed = true;
          diagnostic.adminRawCount = rawRows.length;
          diagnostic.adminError = adminResult.error?.message ?? null;
          if (adminResult.error && !rawRows.length) {
            const adminMinimal = await admin.from("wrestlers").select(selectColsMinimal).order("name", { ascending: true });
            rawRows = (adminMinimal.data ?? []) as Record<string, unknown>[];
            diagnostic.adminRawCount = rawRows.length;
            if (adminMinimal.error) diagnostic.adminError = adminMinimal.error.message;
          }
          diagnostic.source = rawRows.length ? "admin" : "none";
        }
        if (!rawRows.length) {
          const supabase = await createClient();
          const fullResult = await supabase
            .from("wrestlers")
            .select(selectCols)
            .order("name", { ascending: true });
          rawRows = (fullResult.data ?? []) as Record<string, unknown>[];
          diagnostic.userRawCount = rawRows.length;
          diagnostic.userError = fullResult.error?.message ?? null;
          if (fullResult.error && !rawRows.length) {
            const fallback = await supabase.from("wrestlers").select(selectColsMinimal).order("name", { ascending: true });
            rawRows = (fallback.data ?? []) as Record<string, unknown>[];
            diagnostic.userRawCount = rawRows.length;
            if (fallback.error) diagnostic.userError = fallback.error.message;
          }
          if (rawRows.length) diagnostic.source = "user";
        }

        const rows = rawRows.map((r) => ({ ...r, ...normalizeWrestlerRowFromApi(r) })) as Row[];
        const filtered = rows.filter((w) => isDraftableWrestler(w));
        diagnostic.filteredCount = filtered.length;
        if (diagnostic.source === "none" && diagnostic.userRawCount === 0 && diagnostic.adminRawCount === 0) {
          diagnostic.userRawCount = rawRows.length;
        }
        return { rows: filtered, diagnostic };
      })(),
      getDraftPicksHistory(league.id),
      getDraftPreferencesForAllMembers(league.id),
      (async () => {
        const supabase = await createClient();
        const start = getEffectiveLeagueStartDate(league);
        const { data: events } = await supabase
          .from("events")
          .select("id, name, date, matches")
          .eq("status", "completed")
          .gte("date", start)
          .order("date", { ascending: true });
        return aggregateWrestlerPoints((events ?? []) as { id: string; name: string; date: string; matches?: object[] }[]);
      })(),
    ]);
    members = membersData;
    picksHistory = picksData;
    allMembersPrefs = allPrefsData;
    pointsBySlug = pointsData;
    state = stateData;
    currentPick = currentPickData;
    rosters = rostersData;
    wrestlersRows = wrestlersResult.rows;
    wrestlerPoolDiagnostic = wrestlersResult.diagnostic;

    memberByUserId = Object.fromEntries(members.map((m) => [m.user_id, { display_name: m.display_name, team_name: m.team_name }]));
    rosterRules = getRosterRulesForLeague(members.length);
    const draftedIds = new Set<string>();
    for (const entries of Object.values(rosters)) {
      for (const e of entries) draftedIds.add(e.wrestler_id);
    }
    availableWrestlers = wrestlersRows
      .filter((w) => !draftedIds.has(w.id))
      .map((w) => ({ id: w.id, name: w.name }));

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userDraftPrefs = user ? await getDraftPreferences(league.id, user.id) : null;
    isCommissioner = league.role === "commissioner";
    isCurrentPicker =
      !!currentPick &&
      !!user &&
      (currentPick.user_id === user.id || isCommissioner);

    const draftStatus = state?.draft_status ?? "not_started";
    const draftStyle = state?.draft_style ?? "snake";
    const totalPicks = state?.total_picks ?? 0;
    const draftCurrentPick = state?.draft_current_pick ?? null;
    const picksBySlot = Object.fromEntries(picksHistory.map((p) => [p.overall_pick, p]));

    const leagueDraftType = league.draft_type ?? (league.draft_style === "linear" ? "linear" : "snake");
    const timePerPickLabel =
      league.time_per_pick_seconds != null
        ? league.time_per_pick_seconds === 60
          ? "1 minute"
          : league.time_per_pick_seconds === 90
            ? "90 seconds"
            : league.time_per_pick_seconds === 150
              ? "2 mins 30 seconds"
              : league.time_per_pick_seconds === 180
                ? "3 minutes"
                : league.time_per_pick_seconds === 30
                  ? "30 seconds"
                  : `${league.time_per_pick_seconds} seconds`
        : null;
    const draftOrderLabel =
      league.draft_order_method === "manual_by_gm"
        ? "Manually set by General Manager"
        : league.draft_order_method === "random_one_hour_before"
          ? "Randomized one hour before draft"
          : null;
    const hasLeagueDraftDetails =
      leagueDraftType || league.draft_date || timePerPickLabel || draftOrderLabel;

    const hasDraftScheduled = Boolean(league.draft_date);

    const isLiveDraftType = leagueDraftType === "linear" || leagueDraftType === "snake";

    const FOCUS_LABELS: Record<string, string> = { all: "All-time points", "2026": "2026 points", "2025": "2025 points" };
    const POINT_STRATEGY_LABELS: Record<string, string> = { total: "Total Points", rs: "R/S points", ple: "PLE Points", belt: "Belt Points" };
    const WRESTLER_STRATEGY_LABELS: Record<string, string> = {
      best_available: "Best available",
      balanced_gender: "Balanced male/female",
      balanced_brands: "Balanced Raw/SmackDown",
      high_males: "High ranking males",
      high_females: "High ranking females",
    };
    const hasAutoDraftSettingsSaved =
      userDraftPrefs != null &&
      (userDraftPrefs.priority_list?.length > 0 || userDraftPrefs.strategy_options != null);

    let canStartDraftNow = true;
    let scheduledDraftMessage: string | null = null;
    let scheduledMs: number | null = null;
    if (league.draft_date) {
      const raw = String(league.draft_date);
      const datePart = raw.slice(0, 10);
      const timePart =
        (league.draft_time && String(league.draft_time).trim()) ||
        (raw.length > 10 ? raw.slice(11, 16) : null);
      if (datePart) {
        const timeForDate = timePart && /^\d{1,2}:\d{2}/.test(timePart) ? timePart.slice(0, 5) : "00:00";
        const candidate = new Date(`${datePart}T${timeForDate}:00`);
        if (!Number.isNaN(candidate.getTime())) {
          scheduledMs = candidate.getTime();
        }
      }
      if (scheduledMs != null) {
        const nowMs = Date.now();
        canStartDraftNow = nowMs >= scheduledMs;
        if (!canStartDraftNow) {
          const rawTime =
            (league.draft_time && String(league.draft_time).trim()) ||
            (raw.length > 10 ? raw.slice(11, 16) : null);
          scheduledDraftMessage = rawTime
            ? `Draft is scheduled for ${datePart} at ${rawTime}. The Begin Draft button will appear at that time.`
            : `Draft is scheduled for ${datePart}. The Begin Draft button will appear on that date.`;
        }
      }
    }

    const orderInitial = await getDraftOrder(league.id);
    order = orderInitial;

    // Auto-generate draft order when we are within one hour of the scheduled draft time (or later),
    // method is not manual_by_gm, and no order exists yet. Only succeeds for the commissioner.
    const ONE_HOUR_MS = 60 * 60 * 1000;
    if (
      order.length === 0 &&
      scheduledMs != null &&
      Date.now() >= scheduledMs - ONE_HOUR_MS &&
      league.draft_order_method !== "manual_by_gm"
    ) {
      const { generateDraftOrder } = await import("@/lib/leagueDraft");
      const autoResult = await generateDraftOrder(league.id);
      if (!autoResult.error) {
        order = await getDraftOrder(league.id);
      }
    }

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

    const showDraftRoom = (draftStatus === "in_progress" || draftStatus === "completed") && order.length > 0;
    return (
    <main className="app-page" style={{ maxWidth: showDraftRoom ? 1100 : 720, margin: "0 auto", padding: showDraftRoom ? "2rem 1rem" : undefined, fontSize: 16, lineHeight: 1.5 }}>
      <p style={{ marginBottom: 24 }}>
        <Link href={`/leagues/${slug}`} className="app-link">
          ← {league.name}
        </Link>
      </p>
      <h1 style={{ marginBottom: 8, fontSize: "1.5rem", color: "var(--color-text)" }}>Draft</h1>

      {hasLeagueDraftDetails && (
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
          {hasDraftScheduled && (
            <p style={{ fontSize: "1rem", fontWeight: 700, color: "#0d7d0d", marginBottom: 12 }}>
              Your draft is scheduled
            </p>
          )}
          <h2 id="league-draft-details-heading" style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 12, color: "var(--color-text)" }}>
            League draft details
          </h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 14, color: "var(--color-text-muted)", lineHeight: 1.8 }}>
            {leagueDraftType && (
              <li>
                <strong style={{ color: "var(--color-text)" }}>Draft type:</strong>{" "}
                {leagueDraftType === "offline"
                  ? "Offline"
                  : leagueDraftType === "autopick"
                    ? "Autopick"
                    : leagueDraftType === "linear"
                      ? "Live (Linear)"
                      : leagueDraftType === "snake"
                        ? "Live (Snake)"
                        : leagueDraftType}
              </li>
            )}
            {league.draft_date && (
              <li>
                <strong style={{ color: "var(--color-text)" }}>Draft date:</strong>{" "}
                {league.draft_date}
                {league.draft_time && (() => {
                  const t = String(league.draft_time).trim();
                  const match = t.match(/^(\d{1,2}):(\d{2})/);
                  if (!match) return null;
                  const h = parseInt(match[1], 10);
                  const m = match[2];
                  const ampm = h >= 12 ? "PM" : "AM";
                  const h12 = h % 12 || 12;
                  return <span> at {h12}:{m} {ampm}</span>;
                })()}
              </li>
            )}
            {timePerPickLabel && (
              <li>
                <strong style={{ color: "var(--color-text)" }}>Time per pick:</strong> {timePerPickLabel}
              </li>
            )}
            {draftOrderLabel && (
              <li>
                <strong style={{ color: "var(--color-text)" }}>Draft order:</strong> {draftOrderLabel}
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
      )}

      {!hasLeagueDraftDetails && isCommissioner && (
        <p style={{ marginBottom: 24, fontSize: 14, color: "var(--color-text-muted)" }}>
          <Link href={`/leagues/${slug}/league-settings#draft-settings-heading`} className="app-link">
            Set draft details in League Settings
          </Link>
        </p>
      )}

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
          If the pick clock runs out, your pick is made automatically using your priority list and strategy.
        </p>
        {hasAutoDraftSettingsSaved && userDraftPrefs && (
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px", fontSize: 14, color: "var(--color-text-muted)", lineHeight: 1.8 }}>
            {userDraftPrefs.priority_list?.length > 0 && (
              <li>
                <strong style={{ color: "var(--color-text)" }}>Priority list:</strong> {userDraftPrefs.priority_list.length} wrestlers
              </li>
            )}
            {userDraftPrefs.strategy_options?.focus && (
              <li>
                <strong style={{ color: "var(--color-text)" }}>Focus:</strong> {FOCUS_LABELS[userDraftPrefs.strategy_options.focus] ?? userDraftPrefs.strategy_options.focus}
              </li>
            )}
            {userDraftPrefs.strategy_options?.pointStrategy && (
              <li>
                <strong style={{ color: "var(--color-text)" }}>Point strategy:</strong> {POINT_STRATEGY_LABELS[userDraftPrefs.strategy_options.pointStrategy] ?? userDraftPrefs.strategy_options.pointStrategy}
              </li>
            )}
            {userDraftPrefs.strategy_options?.wrestlerStrategy && (
              <li>
                <strong style={{ color: "var(--color-text)" }}>Wrestler strategy:</strong> {WRESTLER_STRATEGY_LABELS[userDraftPrefs.strategy_options.wrestlerStrategy] ?? userDraftPrefs.strategy_options.wrestlerStrategy}
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

      {draftStatus === "not_started" && leagueDraftType === "autopick" && allMembersPrefs.length > 0 && (
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
            Before the draft runs at the scheduled time, confirm each owner has set preferences. If not set, the default is used.
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 14, color: "var(--color-text-muted)", lineHeight: 1.8 }}>
            {allMembersPrefs.map((entry) => (
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
                <span style={{ width: "100%", fontSize: 13, marginTop: 2 }}>{entry.summary}</span>
              </li>
            ))}
          </ul>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 12, marginBottom: 0 }}>
            <strong>Default settings</strong> (when not set): Best available by total points (all-time). Owners can change this under &quot;Set your auto-draft preferences&quot; above.
          </p>
        </section>
      )}

      {draftStatus === "completed" ? (
        <p style={{ color: "#0d7d0d", fontWeight: 600, marginBottom: 24 }}>Draft completed.</p>
      ) : null}

      {draftStatus !== "completed" && (
        <p style={{ color: "var(--color-text-muted)", marginBottom: 16 }}>
          {draftStyle === "linear" ? "Linear" : "Snake"} order · {totalPicks} total picks
        </p>
      )}

      {draftStatus === "not_started" && order.length === 0 && (
        <>
          <p style={{ marginBottom: 16 }}>
            {league.draft_order_method === "manual_by_gm"
              ? "No draft order yet. The General Manager can set the pick order manually."
              : "No draft order yet. The commissioner can generate a randomized order (uses draft type from League Settings)."}
          </p>
          {isCommissioner && league.draft_order_method === "manual_by_gm" && (
            <p style={{ marginBottom: 16 }}>
              <Link
                href={`/leagues/${slug}/draft/set-order`}
                style={{
                  display: "inline-block",
                  padding: "10px 20px",
                  background: "#1a73e8",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: "pointer",
                  textDecoration: "none",
                }}
              >
                Set draft order
              </Link>
            </p>
          )}
          {isCommissioner && league.draft_order_method !== "manual_by_gm" && (
            <GenerateDraftOrderForm leagueSlug={slug} />
          )}
        </>
      )}

      {draftStatus === "not_started" && order.length > 0 && (
        <>
          <p style={{ marginBottom: 8, color: "#555" }}>
            Draft order is set. When all owners are ready, the commissioner can begin the draft.
          </p>
          {scheduledDraftMessage && (
            <p style={{ marginBottom: 8, fontSize: 13, color: "var(--color-text-muted)" }}>
              {scheduledDraftMessage}
            </p>
          )}
          {isCommissioner && isLiveDraftType && canStartDraftNow && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 24, alignItems: "center" }}>
              <form action={startDraftFromFormAction}>
                <input type="hidden" name="league_slug" value={slug} />
                <button
                  type="submit"
                  style={{
                    padding: "12px 24px",
                    background: "#0d7d0d",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 16,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Begin draft
                </button>
              </form>
              {league.draft_order_method === "manual_by_gm" && (
                <Link
                  href={`/leagues/${slug}/draft/set-order`}
                  style={{
                    padding: "12px 24px",
                    background: "transparent",
                    color: "var(--color-blue)",
                    border: "1px solid var(--color-blue)",
                    borderRadius: 8,
                    fontSize: 16,
                    fontWeight: 600,
                    cursor: "pointer",
                    textDecoration: "none",
                  }}
                >
                  Change draft order
                </Link>
              )}
            </div>
          )}
          {!isCommissioner && (
            <p style={{ marginBottom: 24, fontSize: 14, color: "#666" }}>
              Waiting for the commissioner to start the draft.
            </p>
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

      {(draftStatus === "in_progress" || draftStatus === "completed") && order.length > 0 && (
        <>
          {draftStatus === "in_progress" && <DraftPolling />}
          <LeagueDraftRoom
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
            draftedIds={Array.from(draftedIds)}
            currentPickSlot={draftCurrentPick}
            totalPicks={totalPicks}
            draftStatus={draftStatus}
            currentPickerUserId={currentPick?.user_id ?? null}
            isCurrentPicker={isCurrentPicker}
            leagueSlug={slug}
            draftCurrentPickStartedAt={state?.draft_current_pick_started_at ?? null}
          />
          {draftStatus === "in_progress" && isCommissioner && (
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
