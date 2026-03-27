import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLeagueBySlug, getLeagueMembers } from "@/lib/leagues";
import {
  getTradeProposalsForLeague,
  getLeagueRosterActivity,
  getTradeVoteTotals,
  getMyTradeVotes,
  processTradeTimerDeadlines,
} from "@/lib/leagueOwner";
import { formatRecipientRosterCutsLine } from "@/lib/tradeDisplay";
import { TradeGmActions } from "./TradeGmActions";
import { TradeVoteControls } from "./TradeVoteControls";
import { factionDisplayName } from "@/lib/factionName";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

function tradeStatusLabel(status: string): string {
  switch (status) {
    case "gm_approved":
      return "Approved";
    case "accepted":
      return "Approved";
    case "gm_rejected":
      return "Declined";
    case "rejected":
      return "Cancelled";
    case "cancelled":
      return "Cancelled";
    case "expired":
      return "Expired";
    default: return status;
  }
}

function tradeStatusColor(status: string): string {
  switch (status) {
    case "gm_approved":
    case "accepted":
      return "var(--color-success)";
    case "gm_rejected":
    case "rejected":
    case "cancelled":
    case "expired":
      return "var(--color-red)";
    default:
      return "inherit";
  }
}

function formatTradeTimestamp(ts?: string | null): string | null {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTradeDateForDisplay(p: {
  created_at: string;
  responded_at?: string | null;
  accepted_at?: string | null;
  gm_responded_at?: string | null;
  executed_at?: string | null;
  cancelled_at?: string | null;
  expired_at?: string | null;
}): string | null {
  return (
    formatTradeTimestamp(p.executed_at) ??
    formatTradeTimestamp(p.cancelled_at) ??
    formatTradeTimestamp(p.expired_at) ??
    formatTradeTimestamp(p.gm_responded_at) ??
    formatTradeTimestamp(p.responded_at) ??
    formatTradeTimestamp(p.accepted_at) ??
    formatTradeTimestamp(p.created_at)
  );
}

export default async function ProposalsPage({ params }: Props) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  await processTradeTimerDeadlines();

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
    p.status === "accepted" ||
    p.status === "rejected" ||
    p.status === "gm_approved" ||
    p.status === "gm_rejected" ||
    p.status === "cancelled" ||
    p.status === "expired"
  );
  // Prefer membership role, but fall back to commissioner_id to avoid role mismatches.
  const isCommissioner =
    league.role === "commissioner" || (!!user && league.commissioner_id === user.id);

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
        Trades (pending and completed) and roster moves. When both managers agree, the GM must approve the trade. Drops and free agent pickups are first come, first serve.
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
              <li
                key={p.id}
                id={`proposal-${p.id}`}
                style={{ padding: "12px 0", borderBottom: "1px solid #eee" }}
              >
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
                  const acceptedAtFormatted = formatTradeTimestamp(acceptedAt) ?? getTradeDateForDisplay(p);
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ fontSize: 14, color: "#1f2937" }}>
                        {factionDisplayName(memberByUserId[p.from_user_id], "Unknown")} ↔ {factionDisplayName(memberByUserId[p.to_user_id], "Unknown")}:{" "}
                        {p.items.filter((i) => i.direction === "give").map((i) => wrestlerNames[i.wrestler_id] ?? i.wrestler_id).join(", ")}
                        {" for "}
                        {p.items.filter((i) => i.direction === "receive").map((i) => wrestlerNames[i.wrestler_id] ?? i.wrestler_id).join(", ")}
                        {(() => {
                          const dropIds = (p.to_user_drop_ids ?? []).map((x) => String(x).trim()).filter(Boolean);
                          const toName = factionDisplayName(memberByUserId[p.to_user_id], "Unknown");
                          const line = formatRecipientRosterCutsLine(
                            toName,
                            dropIds.map((id) => wrestlerNames[id] ?? id)
                          );
                          return line ? (
                            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{line}</div>
                          ) : null;
                        })()}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12, color: "var(--color-warning)", fontWeight: 700 }}>
                            Awaiting GM approval
                          </span>
                          <span style={{ fontSize: 12, color: "#6b7280" }}>
                            {hoursLeft != null ? <>Review ends in <strong>{hoursLeft}h</strong></> : <>League review</>}
                          </span>
                          <span style={{ fontSize: 12, color: "#6b7280" }}>
                            {acceptedAtFormatted ? <>Accepted <strong>{acceptedAtFormatted}</strong></> : <>Accepted</>}
                          </span>
                        </div>
                        {isCommissioner && <TradeGmActions leagueSlug={slug} proposalId={p.id} />}
                      </div>

                      <TradeVoteControls
                        leagueSlug={slug}
                        proposalId={p.id}
                        up={totals.up}
                        down={totals.down}
                        myVote={myVote as -1 | 0 | 1}
                        disabled={!!disabledReason}
                        disabledReason={disabledReason}
                      />
                    </div>
                  );
                })()}
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
                <div style={{ fontSize: 14, color: "#555" }}>
                  {factionDisplayName(memberByUserId[p.from_user_id], "Unknown")} → {factionDisplayName(memberByUserId[p.to_user_id], "Unknown")}:{" "}
                  {p.items.filter((i) => i.direction === "give").map((i) => wrestlerNames[i.wrestler_id] ?? i.wrestler_id).join(", ")}
                  {" for "}
                  {p.items.filter((i) => i.direction === "receive").map((i) => wrestlerNames[i.wrestler_id] ?? i.wrestler_id).join(", ")}
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: "rgba(100,116,139,0.95)" }}>
                  {getTradeDateForDisplay(p) ? <>Proposed: <strong>{getTradeDateForDisplay(p)}</strong></> : <>Proposed</>}
                </div>
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
              <li key={p.id} style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>
                <div style={{ fontSize: 14, color: "#555" }}>
                  {factionDisplayName(memberByUserId[p.from_user_id], "Unknown")} ↔ {factionDisplayName(memberByUserId[p.to_user_id], "Unknown")}:{" "}
                  {p.items.filter((i) => i.direction === "give").map((i) => wrestlerNames[i.wrestler_id] ?? i.wrestler_id).join(", ")}
                  {" for "}
                  {p.items.filter((i) => i.direction === "receive").map((i) => wrestlerNames[i.wrestler_id] ?? i.wrestler_id).join(", ")}
                  {" — "}
                  <span style={{ fontWeight: 700, color: tradeStatusColor(p.status) }}>{tradeStatusLabel(p.status)}</span>
                  {(() => {
                    const dropIds = (p.to_user_drop_ids ?? []).map((x) => String(x).trim()).filter(Boolean);
                    const toName = factionDisplayName(memberByUserId[p.to_user_id], "Unknown");
                    const line = formatRecipientRosterCutsLine(
                      toName,
                      dropIds.map((id) => wrestlerNames[id] ?? id)
                    );
                    return line ? (
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{line}</div>
                    ) : null;
                  })()}
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: "rgba(100,116,139,0.95)" }}>
                  {getTradeDateForDisplay(p) ? <>{getTradeDateForDisplay(p)}</> : <>Date unavailable</>}
                </div>
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
                    {factionDisplayName(memberByUserId[a.user_id], "Unknown")} dropped {wrestlerNames[a.wrestler_id] ?? a.wrestler_id}
                  </>
                )}
                {a.activity_type === "fa_add" && (
                  <>
                    {factionDisplayName(memberByUserId[a.user_id], "Unknown")} added {wrestlerNames[a.wrestler_id] ?? a.wrestler_id}
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
