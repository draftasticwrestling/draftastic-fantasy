import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import { getLeagueBySlug, getLeagueMembers } from "@/lib/leagues";
import { leagueUsesSalaryCap } from "@/lib/leagueStructure";
import {
  getTradeProposalsForLeague,
  getTradeVoteTotals,
  processTradeTimerDeadlines,
} from "@/lib/leagueOwner";
import { factionDisplayName } from "@/lib/factionName";
import { GmToolsNav } from "../league-settings/GmToolsNav";
import { GmAwaitingTradeApprovals } from "../GmAwaitingTradeApprovals";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) return { title: "Pending Transactions — Draftastic Fantasy" };
  return {
    title: `Pending Transactions — ${league.name} — Draftastic Fantasy`,
    description: "Review and approve or decline pending trades for the league.",
  };
}

export default async function PendingTransactionsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();
  if (leagueUsesSalaryCap(league.league_type)) notFound();

  const { supabase, user } = await getServerAuth();
  const isCommissioner =
    league.role === "commissioner" || (!!user && league.commissioner_id === user.id);
  if (!isCommissioner) notFound();

  await processTradeTimerDeadlines();

  const [members, tradeProposals] = await Promise.all([
    getLeagueMembers(league.id),
    getTradeProposalsForLeague(league.id),
  ]);
  const memberByUserId = Object.fromEntries(members.map((m) => [m.user_id, m]));

  const { data: wrestlers } = await supabase.from("wrestlers").select("id, name");
  const wrestlerNames = Object.fromEntries(
    (wrestlers ?? []).map((w: { id: string; name: string | null }) => [w.id, w.name ?? w.id])
  );

  const awaitingGmTrades = tradeProposals.filter((p) => p.status === "awaiting_gm_approval");
  const pendingOwnerTrades = tradeProposals.filter((p) => p.status === "pending");

  const awaitingIds = awaitingGmTrades.map((p) => p.id);
  const emptyTotals: Record<string, { up: number; down: number }> = {};
  const [voteTotals] = await Promise.all([
    awaitingIds.length ? getTradeVoteTotals(awaitingIds) : Promise.resolve(emptyTotals),
  ]);

  return (
    <main className="app-page" style={{ maxWidth: 720, margin: "0 auto", paddingTop: 10 }}>
      <p style={{ marginBottom: 14 }}>
        <Link href={`/leagues/${slug}`} className="app-link" style={{ fontWeight: 600 }}>
          ← League
        </Link>
      </p>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 8, color: "var(--color-text)" }}>
        Pending Transactions
      </h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 24, maxWidth: 560, lineHeight: 1.5 }}>
        Review trades after both managers have agreed. Approve or reject each trade within 48 hours — if
        you take no action, the trade completes automatically.
      </p>

      <GmToolsNav leagueSlug={slug} />

      {awaitingGmTrades.length > 0 ? (
        <GmAwaitingTradeApprovals
          leagueSlug={slug}
          trades={awaitingGmTrades}
          memberByUserId={memberByUserId}
          wrestlerNames={wrestlerNames}
          voteTotals={voteTotals}
          variant="gm-tools"
        />
      ) : (
        <p style={{ color: "var(--color-text-muted)", marginBottom: 28, fontStyle: "italic" }}>
          Nothing awaiting your approval. When both managers accept a trade, it will appear here.
        </p>
      )}

      {pendingOwnerTrades.length > 0 ? (
        <section>
          <h2 style={{ fontSize: "1.1rem", marginBottom: 8, color: "var(--color-text)" }}>
            Trades waiting on managers
          </h2>
          <p
            style={{
              color: "var(--color-text-muted)",
              marginTop: 0,
              marginBottom: 12,
              maxWidth: 560,
              lineHeight: 1.5,
            }}
          >
            These proposals are still pending acceptance from one or both owners. You can act once both
            sides agree.
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {pendingOwnerTrades.map((p) => (
              <li
                key={p.id}
                style={{
                  padding: "12px 0",
                  borderBottom: "1px solid var(--color-border-light)",
                  fontSize: 14,
                  color: "var(--color-text)",
                }}
              >
                {factionDisplayName(memberByUserId[p.from_user_id], "Unknown")} →{" "}
                {factionDisplayName(memberByUserId[p.to_user_id], "Unknown")}:{" "}
                {p.items
                  .filter((i) => i.direction === "give")
                  .map((i) => wrestlerNames[i.wrestler_id] ?? i.wrestler_id)
                  .join(", ")}{" "}
                for{" "}
                {p.items
                  .filter((i) => i.direction === "receive")
                  .map((i) => wrestlerNames[i.wrestler_id] ?? i.wrestler_id)
                  .join(", ")}
                <span
                  style={{
                    display: "block",
                    marginTop: 4,
                    fontSize: 12,
                    color: "var(--color-text-muted)",
                  }}
                >
                  Pending owner response
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
