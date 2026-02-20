import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLeagueBySlug, getLeagueMembers, getRostersForLeague } from "@/lib/leagues";
import {
  getDraftOrder,
  getLeagueDraftState,
  getCurrentPick,
} from "@/lib/leagueDraft";
import { generateDraftOrderAction, makeDraftPickAction } from "./actions";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) return { title: "Draft — Draftastic Fantasy" };
  return {
    title: `Draft — ${league.name} — Draftastic Fantasy`,
    description: `Draft for ${league.name}`,
  };
}

export default async function LeagueDraftPage({ params }: Props) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const [members, order, state, currentPick, rosters, wrestlersRows] = await Promise.all([
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

  const memberByUserId = Object.fromEntries(members.map((m) => [m.user_id, m]));
  const draftedIds = new Set<string>();
  for (const entries of Object.values(rosters)) {
    for (const e of entries) draftedIds.add(e.wrestler_id);
  }
  const availableWrestlers = wrestlersRows.filter((w) => !draftedIds.has(w.id));

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isCommissioner = league.role === "commissioner";
  const isCurrentPicker =
    currentPick &&
    user &&
    (currentPick.user_id === user.id || isCommissioner);

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
        {state?.draft_style === "linear" ? "Linear" : "Snake"} order · {state?.total_picks ?? 0} total picks
      </p>

      {state?.draft_status === "not_started" && (
        <>
          <p style={{ marginBottom: 16 }}>
            No draft order yet. The commissioner can set the draft style and generate a randomized order to start the draft.
          </p>
          {isCommissioner && (
            <form
              action={async (formData: FormData) => {
                await generateDraftOrderAction(slug, formData);
              }}
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                alignItems: "flex-end",
              }}
            >
              <div>
                <label htmlFor="draft-style" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
                  Draft style
                </label>
                <select
                  id="draft-style"
                  name="draft_style"
                  defaultValue={state?.draft_style ?? "snake"}
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

      {state?.draft_status === "in_progress" && (
        <>
          <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>Pick order</h2>
          <p style={{ marginBottom: 16, fontSize: 14, color: "#666" }}>
            Current pick: <strong>#{state.draft_current_pick ?? 0}</strong>
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
                const isCurrent = state.draft_current_pick === o.overall_pick;
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
                action={async (formData: FormData) => {
                  await makeDraftPickAction(slug, formData);
                }}
                style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}
              >
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

      {state?.draft_status === "completed" && (
        <p style={{ marginBottom: 24, color: "#0d7d0d", fontWeight: 500 }}>
          Draft complete. Rosters are set.
        </p>
      )}
    </main>
  );
}
