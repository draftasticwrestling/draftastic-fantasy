import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLeagueBySlug, getLeagueMembers } from "@/lib/leagues";
import { getTradeProposalsForLeague, getLeagueRosterActivity } from "@/lib/leagueOwner";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function ProposalsPage({ params }: Props) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

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
    const supabase = await createClient();
    const { data: wrestlers } = await supabase
      .from("wrestlers")
      .select("id, name");
    wrestlerNames = Object.fromEntries((wrestlers ?? []).map((w: { id: string; name: string | null }) => [w.id, w.name ?? w.id]));
  } catch {
    // Tables may not exist
  }

  const pendingTrades = tradeProposals.filter((p) => p.status === "pending");
  const completedTrades = tradeProposals.filter((p) => p.status === "accepted" || p.status === "rejected");

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 640, margin: "0 auto" }}>
      <p style={{ marginBottom: 24 }}>
        <Link href={`/leagues/${slug}`} style={{ color: "#1a73e8", textDecoration: "none" }}>
          ← {league.name}
        </Link>
      </p>
      <h1 style={{ marginBottom: 8, fontSize: "1.5rem" }}>Recent Activity</h1>
      <p style={{ color: "#555", marginBottom: 24 }}>
        Trades (pending and completed) and roster moves. Only trades require approval; drops and free agent pickups are first come, first serve.
      </p>

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
                <span style={{ fontWeight: 600 }}>{p.status}</span>
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
