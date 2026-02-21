import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLeagueBySlug, getLeagueMembers, getRostersForLeague } from "@/lib/leagues";
import {
  getTradeProposalsForLeague,
  getReleaseProposalsForLeague,
  getFreeAgentProposalsForLeague,
} from "@/lib/leagueOwner";
import { ProposalsActions } from "./ProposalsActions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function ProposalsPage({ params }: Props) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();
  if (league.role !== "commissioner") notFound();

  const members = await getLeagueMembers(league.id);
  const rosters = await getRostersForLeague(league.id);
  const memberByUserId = Object.fromEntries(members.map((m) => [m.user_id, m]));

  let tradeProposals: Awaited<ReturnType<typeof getTradeProposalsForLeague>> = [];
  let releaseProposals: Awaited<ReturnType<typeof getReleaseProposalsForLeague>> = [];
  let faProposals: Awaited<ReturnType<typeof getFreeAgentProposalsForLeague>> = [];
  let wrestlerNames: Record<string, string> = {};

  try {
    [tradeProposals, releaseProposals, faProposals] = await Promise.all([
      getTradeProposalsForLeague(league.id),
      getReleaseProposalsForLeague(league.id),
      getFreeAgentProposalsForLeague(league.id),
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
  const pendingReleases = releaseProposals.filter((p) => p.status === "pending");
  const pendingFa = faProposals.filter((p) => p.status === "pending");

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 640, margin: "0 auto" }}>
      <p style={{ marginBottom: 24 }}>
        <Link href={`/leagues/${slug}`} style={{ color: "#1a73e8", textDecoration: "none" }}>
          ← {league.name}
        </Link>
      </p>
      <h1 style={{ marginBottom: 8, fontSize: "1.5rem" }}>Pending proposals</h1>
      <p style={{ color: "#555", marginBottom: 24 }}>
        Approve or reject owner requests. Trade proposals are accepted or rejected by the other owner.
      </p>

      {pendingReleases.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>Release requests</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {pendingReleases.map((p) => (
              <li key={p.id} style={{ padding: "12px 0", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span>
                  {memberByUserId[p.user_id]?.display_name?.trim() ?? "Unknown"} wants to release{" "}
                  <strong>{wrestlerNames[p.wrestler_id] ?? p.wrestler_id}</strong>
                </span>
                <ProposalsActions type="release" proposalId={p.id} slug={slug} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {pendingFa.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>Free agent signings</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {pendingFa.map((p) => (
              <li key={p.id} style={{ padding: "12px 0", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span>
                  {memberByUserId[p.user_id]?.display_name?.trim() ?? "Unknown"} wants to add{" "}
                  <strong>{wrestlerNames[p.wrestler_id] ?? p.wrestler_id}</strong>
                  {p.drop_wrestler_id && ` (drop ${wrestlerNames[p.drop_wrestler_id] ?? p.drop_wrestler_id})`}
                </span>
                <ProposalsActions type="fa" proposalId={p.id} slug={slug} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {pendingTrades.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>Trade proposals</h2>
          <p style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>
            The owner who received the proposal can accept or reject from their team page.
          </p>
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

      {pendingReleases.length === 0 && pendingFa.length === 0 && pendingTrades.length === 0 && (
        <p style={{ color: "#666" }}>No pending proposals.</p>
      )}
    </main>
  );
}
