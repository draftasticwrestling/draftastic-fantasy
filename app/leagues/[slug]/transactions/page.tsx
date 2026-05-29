import { factionDisplayName } from "@/lib/factionName";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import { getLeagueBySlug, getLeagueMembers } from "@/lib/leagues";
import {
  getTradeProposalsForLeague,
  getReleaseProposalsForLeague,
  getFreeAgentProposalsForLeague,
  type TradeProposal,
  type ReleaseProposal,
  type FreeAgentProposal,
  getLeagueRosterActivity,
  type LeagueRosterActivityItem,
} from "@/lib/leagueOwner";
import {
  formatUserTradeProposalDescription,
  getTradeProposalStatusDisplay,
} from "@/lib/tradeDisplay";
import { SimpleStatusSpan, TradeProposalStatusSpan } from "@/app/components/ProposalStatusSpan";

export const revalidate = 600;

type TransactionRow = {
  date: string;
  type: "Trade" | "Release" | "Free Agent";
  description: string;
  status: string;
  sortKey: string;
  tradeStatus?: string;
};

function teamLabel(m: { team_name?: string | null; display_name?: string | null }): string {
  return factionDisplayName(m, "Unknown");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) return { title: "Transactions — Draftastic Fantasy" };
  return {
    title: `Transactions — ${league.name} — Draftastic Fantasy`,
    description: "League transactions",
  };
}

export default async function TransactionsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const { supabase, user: currentUser } = await getServerAuth();
  if (!currentUser) notFound();

  const [members, tradeProposals, releaseProposals, faProposals, activity] = await Promise.all([
    getLeagueMembers(league.id),
    getTradeProposalsForLeague(league.id),
    getReleaseProposalsForLeague(league.id),
    getFreeAgentProposalsForLeague(league.id),
    getLeagueRosterActivity(league.id, 200),
  ]);

  const memberByUserId = Object.fromEntries(members.map((m) => [m.user_id, m]));
  const { data: wrestlers } = await supabase.from("wrestlers").select("id, name");
  const wrestlerName: Record<string, string> = Object.fromEntries(
    (wrestlers ?? []).map((w: { id: string; name: string | null }) => [w.id, w.name ?? w.id])
  );

  const rows: TransactionRow[] = [];

  // Trades involving current user (as sender or receiver)
  for (const p of tradeProposals as TradeProposal[]) {
    if (p.from_user_id !== currentUser.id && p.to_user_id !== currentUser.id) continue;
    const fromLabel = teamLabel(memberByUserId[p.from_user_id] ?? {});
    const toLabel = teamLabel(memberByUserId[p.to_user_id] ?? {});
    const give = (p.items ?? []).filter((i) => i.direction === "give").map((i) => wrestlerName[i.wrestler_id] ?? i.wrestler_id);
    const receive = (p.items ?? []).filter((i) => i.direction === "receive").map((i) => wrestlerName[i.wrestler_id] ?? i.wrestler_id);
    const giveStr = give.length ? give.join(", ") : "—";
    const receiveStr = receive.length ? receive.join(", ") : "—";
    const dropNames = (p.to_user_drop_ids ?? [])
      .map((x) => String(x).trim())
      .filter(Boolean)
      .map((id) => wrestlerName[id] ?? id);
    const { label: statusLabel } = getTradeProposalStatusDisplay(p.status);
    rows.push({
      date: p.created_at,
      type: "Trade",
      description: formatUserTradeProposalDescription({
        status: p.status,
        fromLabel,
        toLabel,
        giveStr,
        receiveStr,
        dropNames,
        viewerUserId: currentUser.id,
        fromUserId: p.from_user_id,
        toUserId: p.to_user_id,
      }),
      status: statusLabel,
      tradeStatus: p.status,
      sortKey: p.created_at,
    });
  }

  // Releases by current user
  for (const p of releaseProposals as ReleaseProposal[]) {
    if (p.user_id !== currentUser.id) continue;
    const name = wrestlerName[p.wrestler_id] ?? p.wrestler_id;
    const statusDisplay = p.status === "approved" ? "Approved" : p.status === "rejected" ? "Rejected" : "Pending";
    rows.push({
      date: p.created_at,
      type: "Release",
      description: `Released ${name}`,
      status: statusDisplay,
      sortKey: p.created_at,
    });
  }

  // Free agent signings by current user
  for (const p of faProposals as FreeAgentProposal[]) {
    if (p.user_id !== currentUser.id) continue;
    const addName = wrestlerName[p.wrestler_id] ?? p.wrestler_id;
    const dropStr = p.drop_wrestler_id
      ? ` (dropped ${wrestlerName[p.drop_wrestler_id] ?? p.drop_wrestler_id})`
      : "";
    const statusDisplay = p.status === "approved" ? "Approved" : p.status === "rejected" ? "Rejected" : "Pending";
    rows.push({
      date: p.created_at,
      type: "Free Agent",
      description: `Added ${addName}${dropStr}`,
      status: statusDisplay,
      sortKey: p.created_at,
    });
  }

  // Drops and FA adds from league_activity for this user (including instant moves and backfilled approved proposals).
  for (const a of activity as LeagueRosterActivityItem[]) {
    if (a.user_id !== currentUser.id) continue;
    if (a.activity_type === "drop") {
      const name = wrestlerName[a.wrestler_id] ?? a.wrestler_id;
      rows.push({
        date: a.created_at,
        type: "Release",
        description: `Released ${name}`,
        status: "Approved",
        sortKey: a.created_at,
      });
    } else if (a.activity_type === "fa_add") {
      const addName = wrestlerName[a.wrestler_id] ?? a.wrestler_id;
      const dropStr = a.secondary_wrestler_id
        ? ` (dropped ${wrestlerName[a.secondary_wrestler_id] ?? a.secondary_wrestler_id})`
        : "";
      rows.push({
        date: a.created_at,
        type: "Free Agent",
        description: `Added ${addName}${dropStr}`,
        status: "Approved",
        sortKey: a.created_at,
      });
    }
  }

  rows.sort((a, b) => (b.sortKey > a.sortKey ? 1 : -1));

  function formatDate(iso: string): string {
    const d = iso.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    const [y, m, day] = d.split("-");
    const month = new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-US", { month: "short" });
    return `${month} ${day}, ${y}`;
  }

  return (
    <main className="app-page" style={{ paddingTop: 10 }}>
      <p style={{ marginBottom: 14 }}>
        <Link href={`/leagues/${slug}`} className="app-link">
          ← League
        </Link>
      </p>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 8, color: "var(--color-text)" }}>
        Transactions
      </h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 24 }}>
        Trades, releases, and free agent signings for your faction.
      </p>

      {rows.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>No transactions yet.</p>
      ) : (
        <div className="transactions-table-wrap" style={{ overflowX: "auto" }}>
          <table className="transactions-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--color-border)" }}>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "var(--color-text-muted)" }}>
                  Date
                </th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "var(--color-text-muted)" }}>
                  Type
                </th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "var(--color-text-muted)" }}>
                  Description
                </th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "var(--color-text-muted)" }}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={`${r.type}-${r.date}-${i}`}
                  style={{
                    borderBottom: "1px solid var(--color-border-light)",
                    background: i % 2 === 0 ? undefined : "var(--color-bg-elevated)",
                  }}
                >
                  <td style={{ padding: "10px 12px", color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>
                    {formatDate(r.date)}
                  </td>
                  <td style={{ padding: "10px 12px" }}>{r.type}</td>
                  <td style={{ padding: "10px 12px" }}>{r.description}</td>
                  <td style={{ padding: "10px 12px" }}>
                    {r.type === "Trade" && r.tradeStatus ? (
                      <TradeProposalStatusSpan status={r.tradeStatus} />
                    ) : (
                      <SimpleStatusSpan
                        label={r.status}
                        tone={
                          r.status === "Approved"
                            ? "approved"
                            : r.status === "Rejected"
                              ? "rejected"
                              : r.status === "Pending"
                                ? "pending"
                                : "neutral"
                        }
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
