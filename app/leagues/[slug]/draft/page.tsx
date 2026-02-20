import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLeagueBySlug, getLeagueMembers, getRostersForLeague } from "@/lib/leagues";
import {
  getDraftOrder,
  getLeagueDraftState,
  getCurrentPick,
} from "@/lib/leagueDraft";
import { generateDraftOrderFromFormAction, makeDraftPickFromFormAction } from "./actions";

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
  let wrestlersRows: { id: string; name: string | null }[] = [];
  let memberByUserId: Record<string, { display_name?: string | null }> = {};
  let availableWrestlers: { id: string; name: string | null }[] = [];
  let isCommissioner = false;
  let isCurrentPicker = false;

  try {
    league = await getLeagueBySlug(slug);
    if (!league) notFound();

    const [membersData, orderData, stateData, currentPickData, rostersData, wrestlersData] = await Promise.all([
      getLeagueMembers(league.id),
      getDraftOrder(league.id),
      getLeagueDraftState(league.id),
      getCurrentPick(league.id),
      getRostersForLeague(league.id),
      (async () => {
        const supabase = await createClient();
        const { data } = await supabase
          .from("wrestlers")
          .select("id, name")
          .order("name", { ascending: true });
        return (data ?? []) as { id: string; name: string | null }[];
      })(),
    ]);
    members = membersData;
    order = orderData;
    state = stateData;
    currentPick = currentPickData;
    rosters = rostersData;
    wrestlersRows = wrestlersData;

    memberByUserId = Object.fromEntries(members.map((m) => [m.user_id, m]));
    const draftedIds = new Set<string>();
    for (const entries of Object.values(rosters)) {
      for (const e of entries) draftedIds.add(e.wrestler_id);
    }
    availableWrestlers = wrestlersRows.filter((w) => !draftedIds.has(w.id));

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
      <p style={{ color: "#555", marginBottom: 24 }}>
        {draftStyle === "linear" ? "Linear" : "Snake"} order · {totalPicks} total picks
      </p>

      {draftStatus === "not_started" && (
        <>
          <p style={{ marginBottom: 16 }}>
            No draft order yet. The commissioner can set the draft style and generate a randomized order to start the draft.
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

      {draftStatus === "in_progress" && (
        <>
          <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>Pick order</h2>
          <p style={{ marginBottom: 16, fontSize: 14, color: "#666" }}>
            Current pick: <strong>#{draftCurrentPick ?? 0}</strong>
            {currentPick &&
              ` — ${memberByUserId[currentPick.user_id]?.display_name?.trim() ?? "Unknown"}`}
          </p>

          {order.length > 0 && (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: "0 0 24px 0",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                gap: 8,
              }}
            >
              {order.map((o) => {
                const member = memberByUserId[o.user_id];
                const name = member?.display_name?.trim() ?? "Unknown";
                const isCurrent = draftCurrentPick === o.overall_pick;
                return (
                  <li
                    key={o.overall_pick}
                    style={{
                      padding: "8px 12px",
                      background: isCurrent ? "#e3f2fd" : "#f5f5f5",
                      borderRadius: 6,
                      border: isCurrent ? "2px solid #1a73e8" : "1px solid #eee",
                      fontWeight: isCurrent ? 600 : 400,
                    }}
                  >
                    #{o.overall_pick} — {name}
                  </li>
                );
              })}
            </ul>
          )}

          {isCurrentPicker && availableWrestlers.length > 0 && (
            <div
              style={{
                padding: 16,
                background: "#f8f9fa",
                borderRadius: 8,
                border: "1px solid #eee",
              }}
            >
              <h3 style={{ fontSize: "1rem", marginBottom: 12 }}>Your pick</h3>
              <form
                action={makeDraftPickFromFormAction}
                style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}
              >
                <input type="hidden" name="league_slug" value={slug} />
                <div style={{ flex: "1 1 200px" }}>
                  <label htmlFor="draft-wrestler" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
                    Select wrestler
                  </label>
                  <select
                    id="draft-wrestler"
                    name="wrestler_id"
                    required
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      fontSize: 16,
                      border: "1px solid #ccc",
                      borderRadius: 6,
                    }}
                  >
                    <option value="">Choose…</option>
                    {availableWrestlers.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name ?? w.id}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  style={{
                    padding: "10px 20px",
                    background: "#333",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 16,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Submit pick
                </button>
              </form>
            </div>
          )}

          {isCurrentPicker && availableWrestlers.length === 0 && (
            <p style={{ color: "#666" }}>No wrestlers left to pick.</p>
          )}
        </>
      )}

      {draftStatus === "completed" && (
        <p style={{ marginBottom: 24, color: "#0d7d0d", fontWeight: 500 }}>
          Draft complete. Rosters are set.
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
