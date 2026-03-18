import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLeagueBySlug, getLeagueMembers } from "@/lib/leagues";
import { getTradeProposalsForLeague, getLeagueRosterActivity, getTradeVoteTotals, getMyTradeVotes } from "@/lib/leagueOwner";
import { TradeGmActions } from "./TradeGmActions";
import { TradeVoteControls } from "./TradeVoteControls";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

function tradeStatusLabel(status: string): string {
  switch (status) {
    case "gm_approved": return "approved";
    case "gm_rejected": return "rejected by GM";
    case "accepted": return "completed";
    default: return status;
  }
}

export default async function ProposalsPage({ params }: Props) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const members = await getLeagueMembers(league.id);
  const memberByUserId = Object.fromEntries(members.map((m) => [m.user_id, m]));

  let tradeProposals: Awaited<ReturnType<typeof getTradeProposalsForLeague>> = [];
  let rosterActivity: Awaited<ReturnType<typeof getLeagueRosterActivity>> = [];
  let wrestlerNames: Record<string, string> = {};

  try {
    [tradeProposals, rosterActivity] = await Promise.all([
      getTradeProposalsForLeague(league.id),
      getLeagueRosterActivity(league.id, 50),
    ]);
    const { data: wrestlers } = await supabase
      .from("wrestlers")
      .select("id, name");
    wrestlerNames = Object.fromEntries((wrestlers ?? []).map((w: { id: string; name: string | null }) => [w.id, w.name ?? w.id]));
  } catch {
    // Tables may not exist
  }

  const pendingTrades = tradeProposals.filter((p) => p.status === "pending");
  const awaitingGmTrades = tradeProposals.filter((p) => p.status === "awaiting_gm_approval");
  const completedTrades = tradeProposals.filter((p) =>
    p.status === "accepted" || p.status === "rejected" || p.status === "gm_approved" || p.status === "gm_rejected"
  );
  const isCommissioner = league.role === "commissioner";

  const awaitingIds = awaitingGmTrades.map((p) => p.id);
  const emptyTotals: Record<string, { up: number; down: number }> = {};
  const emptyMyVotes: Record<string, -1 | 0 | 1> = {};
  const [voteTotals, myVotes] = await Promise.all([
    awaitingIds.length ? getTradeVoteTotals(awaitingIds) : Promise.resolve(emptyTotals),
    awaitingIds.length ? getMyTradeVotes(awaitingIds) : Promise.resolve(emptyMyVotes),
  ]);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 640, margin: "0 auto" }}>
      <p style={{ marginBottom: 24 }}>
        <Link href={`/leagues/${slug}`} style={{ color: "#1a73e8", textDecoration: "none" }}>
          ← {league.name}
        </Link>
      </p>
      <h1 style={{ marginBottom: 8, fontSize: "1.5rem" }}>Recent Activity</h1>
      <p style={{ color: "#555", marginBottom: 24 }}>
        Trades (pending and completed) and roster moves. When both managers agree, the commissioner must approve the trade. Drops and free agent pickups are first come, first serve.
      </p>

      {awaitingGmTrades.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>
            Trades awaiting GM approval
          </h2>
          <p style={{ fontSize: 14, color: "#555", marginBottom: 12 }}>
            Both managers have agreed. Approve or reject to complete the trade.
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {awaitingGmTrades.map((p) => (
              <li key={p.id} style={{ padding: "12px 0", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <span style={{ flex: 1, minWidth: 260 }}>
                  {memberByUserId[p.from_user_id]?.display_name ?? "Unknown"} ↔ {memberByUserId[p.to_user_id]?.display_name ?? "Unknown"}:{" "}
                  {p.items.filter((i) => i.direction === "give").map((i) => wrestlerNames[i.wrestler_id] ?? i.wrestler_id).join(", ")}
                  {" for "}
                  {p.items.filter((i) => i.direction === "receive").map((i) => wrestlerNames[i.wrestler_id] ?? i.wrestler_id).join(", ")}
                </span>
                <span style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {(() => {
                    const acceptedAt = (p as { accepted_at?: string | null }).accepted_at;
                    const acceptedMs = acceptedAt ? Date.parse(acceptedAt) : NaN;
                    const windowMs = 48 * 60 * 60 * 1000;
                    const endsInMs = Number.isFinite(acceptedMs) ? (acceptedMs + windowMs - Date.now()) : NaN;
                    const hoursLeft = Number.isFinite(endsInMs) ? Math.max(0, Math.ceil(endsInMs / (60 * 60 * 1000))) : null;
                    const totals = voteTotals[p.id] ?? { up: 0, down: 0 };
                    const myVote = myVotes[p.id] ?? 0;
                    const inWindow = Number.isFinite(endsInMs) ? endsInMs > 0 : false;
                    const disabledReason =
                      !user ? "Sign in to vote." :
                      (user.id === p.from_user_id || user.id === p.to_user_id) ? "Trade parties can't vote." :
                      !inWindow ? "Voting window has ended." : null;
                    return (
                      <span style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                        <span style={{ fontSize: 12, color: "#666" }}>
                          {hoursLeft != null ? <>League review ends in <strong>{hoursLeft}h</strong></> : <>League review</>}
                        </span>
                        <TradeVoteControls
                          leagueSlug={slug}
                          proposalId={p.id}
                          up={totals.up}
                          down={totals.down}
                          myVote={myVote as -1 | 0 | 1}
                          disabled={!!disabledReason}
                          disabledReason={disabledReason}
                        />
                      </span>
                    );
                  })()}
                  {isCommissioner && <TradeGmActions leagueSlug={slug} proposalId={p.id} />}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pendingTrades.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>Pending trade proposals</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {pendingTrades.map((p) => (
              <li key={p.id} style={{ padding: "12px 0", borderBottom: "1px solid #eee" }}>
                {memberByUserId[p.from_user_id]?.display_name ?? "Unknown"} → {memberByUserId[p.to_user_id]?.display_name ?? "Unknown"}:{" "}
                {p.items.filter((i) => i.direction === "give").map((i) => wrestlerNames[i.wrestler_id] ?? i.wrestler_id).join(", ")}
                {" for "}
                {p.items.filter((i) => i.direction === "receive").map((i) => wrestlerNames[i.wrestler_id] ?? i.wrestler_id).join(", ")}
              </li>
            ))}
          </ul>
        </section>
      )}

      {completedTrades.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>Completed trades</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {completedTrades.slice(0, 15).map((p) => (
              <li key={p.id} style={{ padding: "8px 0", borderBottom: "1px solid #eee", fontSize: 14, color: "#555" }}>
                {memberByUserId[p.from_user_id]?.display_name ?? "Unknown"} ↔ {memberByUserId[p.to_user_id]?.display_name ?? "Unknown"}:{" "}
                {p.items.filter((i) => i.direction === "give").map((i) => wrestlerNames[i.wrestler_id] ?? i.wrestler_id).join(", ")}
                {" for "}
                {p.items.filter((i) => i.direction === "receive").map((i) => wrestlerNames[i.wrestler_id] ?? i.wrestler_id).join(", ")}
                {" — "}
                <span style={{ fontWeight: 600 }}>{tradeStatusLabel(p.status)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rosterActivity.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>Drops & free agent signings</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 14, color: "#555" }}>
            {rosterActivity.map((a) => (
              <li key={a.id} style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>
                {a.activity_type === "drop" && (
                  <>
                    {memberByUserId[a.user_id]?.display_name ?? memberByUserId[a.user_id]?.team_name ?? "Unknown"} dropped {wrestlerNames[a.wrestler_id] ?? a.wrestler_id}
                  </>
                )}
                {a.activity_type === "fa_add" && (
                  <>
                    {memberByUserId[a.user_id]?.display_name ?? memberByUserId[a.user_id]?.team_name ?? "Unknown"} added {wrestlerNames[a.wrestler_id] ?? a.wrestler_id}
                    {a.secondary_wrestler_id && (
                      <> (dropped {wrestlerNames[a.secondary_wrestler_id] ?? a.secondary_wrestler_id})</>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {tradeProposals.length === 0 && rosterActivity.length === 0 && (
        <p style={{ color: "#666" }}>No activity yet.</p>
      )}
    </main>
  );
}
