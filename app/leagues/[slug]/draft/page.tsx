import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLeagueBySlug, getLeagueMembers, getRostersForLeague } from "@/lib/leagues";
import {
  getDraftOrder,
  getLeagueDraftState,
  getCurrentPick,
  getDraftPicksHistory,
  getDraftPreferences,
  runAutoPickIfExpired,
  isDraftableWrestler,
  normalizeWrestlerRowFromApi,
} from "@/lib/leagueDraft";
import { generateDraftOrderFromFormAction, startDraftFromFormAction } from "./actions";
import { MakePickForm } from "./MakePickForm";
import { DraftTimer } from "./DraftTimer";
import { DraftPolling } from "./DraftPolling";
import { CommissionerDraftActions } from "./CommissionerDraftActions";
import { getRosterRulesForLeague } from "@/lib/leagueStructure";

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
  let wrestlersRows: { id: string; name: string | null; gender: string | null; status?: string | null; brand?: string | null; classification?: string | null }[] = [];
  let memberByUserId: Record<string, { display_name?: string | null }> = {};
  let availableWrestlers: { id: string; name: string | null }[] = [];
  let isCommissioner = false;
  let isCurrentPicker = false;
  let picksHistory: Awaited<ReturnType<typeof getDraftPicksHistory>> = [];
  let rosterRules: ReturnType<typeof getRosterRulesForLeague> = null;
  let userDraftPrefs: Awaited<ReturnType<typeof getDraftPreferences>> = null;

  try {
    league = await getLeagueBySlug(slug);
    if (!league) notFound();

    const autoResult = await runAutoPickIfExpired(league.id);
    if (autoResult.didAutoPick) redirect(`/leagues/${slug}/draft`);

    const [membersData, orderData, stateData, currentPickData, rostersData, wrestlersData, picksData] = await Promise.all([
      getLeagueMembers(league.id),
      getDraftOrder(league.id),
      getLeagueDraftState(league.id),
      getCurrentPick(league.id),
      getRostersForLeague(league.id),
      (async () => {
        const supabase = await createClient();
        type Row = { id: string; name: string | null; gender: string | null; status?: string | null; brand?: string | null; classification?: string | null };
        let result = await supabase
          .from("wrestlers")
          .select('id, name, gender, status, "Status", brand, classification, "Classification"')
          .order("name", { ascending: true });
        if (result.error) {
          result = await supabase.from("wrestlers").select('id, name, gender, status, "Status", brand, classification, "Classification"').order("name", { ascending: true });
        }
        let rawRows = (result.data ?? []) as Record<string, unknown>[];
        if (result.error && !rawRows.length) {
          const fallback = await supabase.from("wrestlers").select('id, name, gender, status, "Status", brand, classification, "Classification"').order("name", { ascending: true });
          rawRows = (fallback.data ?? []) as Record<string, unknown>[];
        }
        const rows = rawRows.map((r) => ({ ...r, ...normalizeWrestlerRowFromApi(r) })) as Row[];
        return rows.filter((w) => isDraftableWrestler(w));
      })(),
      getDraftPicksHistory(league.id),
    ]);
    members = membersData;
    picksHistory = picksData;
    order = orderData;
    state = stateData;
    currentPick = currentPickData;
    rosters = rostersData;
    wrestlersRows = wrestlersData;

    memberByUserId = Object.fromEntries(members.map((m) => [m.user_id, m]));
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
    const orderReady = order.length > 0;
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

    return (
    <main className="app-page" style={{ maxWidth: 720, fontSize: 16, lineHeight: 1.5 }}>
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
                <strong style={{ color: "var(--color-text)" }}>Draft date:</strong> {league.draft_date}
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
        <p style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 12 }}>
          If the pick clock runs out, your pick is made automatically using your priority list and strategy.
        </p>
        <Link
          href={`/leagues/${slug}/draft/preferences`}
          className="app-link"
          style={{ fontWeight: 600 }}
        >
          {userDraftPrefs ? "Edit your auto-draft preferences" : "Set your auto-draft preferences"} →
        </Link>
      </section>

      {draftStatus === "completed" ? (
        <p style={{ color: "#0d7d0d", fontWeight: 600, marginBottom: 24 }}>Draft completed.</p>
      ) : null}

      {draftStatus !== "completed" && (
        <p style={{ color: "var(--color-text-muted)", marginBottom: 16 }}>
          {draftStyle === "linear" ? "Linear" : "Snake"} order · {totalPicks} total picks
        </p>
      )}

      {draftStatus === "not_started" && !orderReady && (
        <>
          <p style={{ marginBottom: 16 }}>
            No draft order yet. The commissioner can generate a randomized order (uses draft type from League Settings).
          </p>
          {isCommissioner && (
            <form action={generateDraftOrderFromFormAction} style={{ marginBottom: 24 }}>
              <input type="hidden" name="league_slug" value={slug} />
              <button
                type="submit"
                style={{
                  padding: "10px 20px",
                  background: "#1a73e8",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Generate draft order
              </button>
            </form>
          )}
        </>
      )}

      {draftStatus === "not_started" && orderReady && (
        <>
          <p style={{ marginBottom: 16, color: "#555" }}>
            Draft order is set. When all owners are ready, the commissioner can start the draft.
          </p>
          {isCommissioner && (
            <form action={startDraftFromFormAction} style={{ marginBottom: 24 }}>
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
                Start draft
              </button>
            </form>
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

      {(draftStatus === "in_progress" || draftStatus === "completed") && orderReady && (
        <>
          {draftStatus === "in_progress" && <DraftPolling />}
          <section style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: "1.1rem", marginBottom: 12, color: "var(--color-text)" }}>Draft board</h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, border: "1px solid var(--color-border)", borderRadius: "var(--radius)", overflow: "hidden", background: "var(--color-bg-surface)" }}>
              {order.map((o) => {
                const managerName = memberByUserId[o.user_id]?.display_name?.trim() ?? "Unknown";
                const pick = picksBySlot[o.overall_pick];
                const wrestlerDisplay = pick ? (pick.wrestler_name ?? pick.wrestler_id) : null;
                const isCurrent = draftStatus === "in_progress" && draftCurrentPick === o.overall_pick;
                const isYourTurn = isCurrent && isCurrentPicker;
                const risk = isCurrent && rosterRules ? rosterRisk(o.user_id) : null;
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
                      background: isCurrent ? "var(--color-blue-bg)" : undefined,
                      borderLeft: isCurrent ? "4px solid var(--color-blue)" : undefined,
                    }}
                  >
                    <div>
                      <span style={{ color: "var(--color-text-muted)", fontWeight: 600 }}>#{o.overall_pick} · {managerName}</span>
                      {risk && (
                        <span style={{ display: "block", fontSize: 12, color: "#d4a017", marginTop: 4 }}>
                          Roster: need {risk}
                        </span>
                      )}
                    </div>
                    <span style={{ color: "var(--color-text)", fontWeight: risk ? 500 : undefined }}>
                      {wrestlerDisplay ?? (isYourTurn ? "Your turn" : "—")}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      {draftStatus === "in_progress" && (
        <>
          {currentPick && (
            <p style={{ marginBottom: 8, fontSize: 14, color: "#666" }}>
              Up now: <strong>{memberByUserId[currentPick.user_id]?.display_name?.trim() ?? "Unknown"}</strong>
              {state?.draft_current_pick_started_at && isCurrentPicker && (
                <DraftTimer startedAt={state.draft_current_pick_started_at} leagueSlug={slug} />
              )}
            </p>
          )}
          {isCurrentPicker && availableWrestlers.length > 0 && (
            <MakePickForm leagueSlug={slug} availableWrestlers={availableWrestlers} />
          )}
          {isCurrentPicker && availableWrestlers.length === 0 && (
            <p style={{ color: "#666", marginBottom: 16 }}>No wrestlers left to pick.</p>
          )}
          {isCommissioner && (
            <CommissionerDraftActions leagueSlug={slug} canClearLastPick={picksHistory.length > 0} />
          )}
        </>
      )}

      {draftStatus === "completed" && (
        <p style={{ marginBottom: 24, color: "#666", fontSize: 14 }}>
          Rosters are set. View teams on the league page.
        </p>
      )}
    </main>
    );
  } catch {
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
