import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLeagueBySlug, getLeagueMembers, getRostersForLeague } from "@/lib/leagues";
import {
  getDraftOrder,
  getLeagueDraftState,
  getCurrentPick,
  getDraftPicksHistory,
  runAutoPickIfExpired,
} from "@/lib/leagueDraft";
import { generateDraftOrderFromFormAction, startDraftFromFormAction } from "./actions";
import { updateDraftDateFromFormAction } from "../actions";
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
  let wrestlersRows: { id: string; name: string | null; gender: string | null }[] = [];
  let memberByUserId: Record<string, { display_name?: string | null }> = {};
  let availableWrestlers: { id: string; name: string | null }[] = [];
  let isCommissioner = false;
  let isCurrentPicker = false;
  let picksHistory: Awaited<ReturnType<typeof getDraftPicksHistory>> = [];
  let rosterRules: ReturnType<typeof getRosterRulesForLeague> = null;

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
        const { data } = await supabase
          .from("wrestlers")
          .select("id, name, gender")
          .order("name", { ascending: true });
        return (data ?? []) as { id: string; name: string | null; gender: string | null }[];
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
    availableWrestlers = wrestlersRows.map((w) => ({ id: w.id, name: w.name })).filter((w) => !draftedIds.has(w.id));

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
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
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: 24,
        maxWidth: 720,
        margin: "0 auto",
        fontSize: 16,
        lineHeight: 1.5,
      }}
    >
      <p style={{ marginBottom: 24 }}>
        <Link href={`/leagues/${slug}`} style={{ color: "#1a73e8", textDecoration: "none" }}>
          ← {league.name}
        </Link>
      </p>
      <h1 style={{ marginBottom: 8, fontSize: "1.5rem" }}>Draft</h1>

      {draftStatus === "completed" ? (
        <p style={{ color: "#0d7d0d", fontWeight: 600, marginBottom: 24 }}>Draft completed.</p>
      ) : (
        <>
          <p style={{ color: "#555", marginBottom: 8 }}>
            {draftStyle === "linear" ? "Linear" : "Snake"} order · {totalPicks} total picks
          </p>
          {league.draft_date && (
            <p style={{ fontSize: 14, color: "#666", marginBottom: 16 }}>
              Draft date: <strong>{league.draft_date}</strong> (points from first event after this date)
            </p>
          )}
          {isCommissioner && draftStatus === "not_started" && (
            <form
              action={updateDraftDateFromFormAction}
              style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", marginBottom: 24 }}
            >
              <input type="hidden" name="league_slug" value={slug} />
              <div>
                <label htmlFor="draft-date" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
                  Draft date
                </label>
                <input
                  id="draft-date"
                  type="date"
                  name="draft_date"
                  defaultValue={league.draft_date ?? ""}
                  style={{ padding: "8px 12px", fontSize: 14, border: "1px solid #ccc", borderRadius: 6 }}
                />
              </div>
              <button
                type="submit"
                style={{
                  padding: "8px 16px",
                  background: "#333",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Save draft date
              </button>
            </form>
          )}
        </>
      )}

      {draftStatus === "not_started" && !orderReady && (
        <>
          <p style={{ marginBottom: 16 }}>
            No draft order yet. The commissioner can set the draft style and generate a randomized order.
          </p>
          {isCommissioner && (
            <form
              action={generateDraftOrderFromFormAction}
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                alignItems: "flex-end",
              }}
            >
              <input type="hidden" name="league_slug" value={slug} />
              <div>
                <label htmlFor="draft-style" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
                  Draft style
                </label>
                <select
                  id="draft-style"
                  name="draft_style"
                  defaultValue={draftStyle}
                  style={{
                    padding: "10px 12px",
                    fontSize: 16,
                    border: "1px solid #ccc",
                    borderRadius: 6,
                    minWidth: 140,
                  }}
                >
                  <option value="snake">Snake</option>
                  <option value="linear">Linear</option>
                </select>
              </div>
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
            <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>Draft board</h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, border: "1px solid #eee", borderRadius: 8, overflow: "hidden" }}>
              {order.map((o) => {
                const managerName = memberByUserId[o.user_id]?.display_name?.trim() ?? "Unknown";
                return (
                  <li
                    key={o.overall_pick}
                    style={{
                      padding: "10px 14px",
                      borderBottom: "1px solid #eee",
                      fontSize: 14,
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <span style={{ fontWeight: 600, minWidth: 32 }}>#{o.overall_pick}</span>
                    <span style={{ minWidth: 120 }}>{managerName}</span>
                    <span style={{ color: "#999" }}>—</span>
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
            <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>Draft board</h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, border: "1px solid #eee", borderRadius: 8, overflow: "hidden" }}>
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
                      borderBottom: "1px solid #eee",
                      fontSize: 14,
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: 12,
                      background: isCurrent ? "#e3f2fd" : undefined,
                      borderLeft: isCurrent ? "4px solid #1a73e8" : undefined,
                    }}
                  >
                    <span style={{ fontWeight: 600, minWidth: 32 }}>#{o.overall_pick}</span>
                    <span style={{ minWidth: 120 }}>{managerName}</span>
                    <span style={{ color: "#555" }}>—</span>
                    <span style={{ flex: 1 }}>
                      {wrestlerDisplay ?? (isYourTurn ? "Your turn" : "—")}
                    </span>
                    {risk && (
                      <span style={{ fontSize: 12, color: "#b45309", background: "#fff4e6", padding: "4px 8px", borderRadius: 6 }}>
                        Roster: need {risk}
                      </span>
                    )}
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
