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
import { appendRecipientCutsToDescription } from "@/lib/tradeDisplay";

export const revalidate = 120;

type RosterChangeRow = {
  date: string;
  type: "Trade" | "Release" | "Free Agent";
  teams: string;
  description: string;
  status: string;
  sortKey: string;
};

function teamLabel(m: { team_name?: string | null; display_name?: string | null }): string {
  return factionDisplayName(m, "Unknown");
}

function tradeStatusLabel(status: string): string {
  switch (status) {
    case "gm_approved":
    case "accepted":
      return "Approved";
    case "gm_rejected":
      return "Declined";
    case "rejected":
      return "Cancelled";
    case "awaiting_gm_approval":
      return "Accepted — awaiting GM approval";
    default:
      return "Pending";
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) return { title: "Roster Changes — Draftastic Fantasy" };
  return {
    title: `Roster Changes — ${league.name} — Draftastic Fantasy`,
    description: "League roster changes: trades, releases, and free agent signings",
  };
}

export default async function RosterChangesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const [members, tradeProposals, releaseProposals, faProposals, activity] = await Promise.all([
    getLeagueMembers(league.id),
    getTradeProposalsForLeague(league.id),
    getReleaseProposalsForLeague(league.id),
    getFreeAgentProposalsForLeague(league.id),
    getLeagueRosterActivity(league.id, 200),
  ]);

  const memberByUserId = Object.fromEntries(members.map((m) => [m.user_id, m]));
  const { supabase } = await getServerAuth();
  const { data: wrestlers } = await supabase.from("wrestlers").select("id, name");
  const wrestlerName: Record<string, string> = Object.fromEntries(
    (wrestlers ?? []).map((w: { id: string; name: string | null }) => [w.id, w.name ?? w.id])
  );

  const rows: RosterChangeRow[] = [];

  // All trades in the league
  for (const p of tradeProposals as TradeProposal[]) {
    const fromLabel = teamLabel(memberByUserId[p.from_user_id] ?? {});
    const toLabel = teamLabel(memberByUserId[p.to_user_id] ?? {});
    const give = (p.items ?? [])
      .filter((i) => i.direction === "give")
      .map((i) => wrestlerName[i.wrestler_id] ?? i.wrestler_id);
    const receive = (p.items ?? [])
      .filter((i) => i.direction === "receive")
      .map((i) => wrestlerName[i.wrestler_id] ?? i.wrestler_id);
    const giveStr = give.length ? give.join(", ") : "—";
    const receiveStr = receive.length ? receive.join(", ") : "—";
    const dropNames = (p.to_user_drop_ids ?? [])
      .map((x) => String(x).trim())
      .filter(Boolean)
      .map((id) => wrestlerName[id] ?? id);
    const baseDesc = `${fromLabel} traded ${giveStr} to ${toLabel} for ${receiveStr}`;
    rows.push({
      date: p.created_at,
      type: "Trade",
      teams: `${fromLabel} ↔ ${toLabel}`,
      description: appendRecipientCutsToDescription(baseDesc, toLabel, dropNames),
      status: tradeStatusLabel(p.status),
      sortKey: p.created_at,
    });
  }

  // All releases in the league
  for (const p of releaseProposals as ReleaseProposal[]) {
    // Approved releases are reflected in league_activity; show only pending/rejected here.
    if (p.status === "approved") continue;
    const team = teamLabel(memberByUserId[p.user_id] ?? {});
    const name = wrestlerName[p.wrestler_id] ?? p.wrestler_id;
    rows.push({
      date: p.created_at,
      type: "Release",
      teams: team,
      description: `Released ${name}`,
      status: p.status === "approved" ? "Approved" : p.status === "rejected" ? "Rejected" : "Pending",
      sortKey: p.created_at,
    });
  }

  // All free agent signings in the league
  for (const p of faProposals as FreeAgentProposal[]) {
    // Approved FA adds are reflected in league_activity; show only pending/rejected here.
    if (p.status === "approved") continue;
    const team = teamLabel(memberByUserId[p.user_id] ?? {});
    const addName = wrestlerName[p.wrestler_id] ?? p.wrestler_id;
    const dropStr = p.drop_wrestler_id
      ? ` (dropped ${wrestlerName[p.drop_wrestler_id] ?? p.drop_wrestler_id})`
      : "";
    rows.push({
      date: p.created_at,
      type: "Free Agent",
      teams: team,
      description: `Added ${addName}${dropStr}`,
      status: p.status === "approved" ? "Approved" : p.status === "rejected" ? "Rejected" : "Pending",
      sortKey: p.created_at,
    });
  }

  // Completed drops and free-agent adds from league_activity (including historical approved proposals and instant moves).
  for (const a of activity as LeagueRosterActivityItem[]) {
    const team = teamLabel(memberByUserId[a.user_id] ?? {});
    if (a.activity_type === "drop") {
      const name = wrestlerName[a.wrestler_id] ?? a.wrestler_id;
      rows.push({
        date: a.created_at,
        type: "Release",
        teams: team,
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
        teams: team,
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
    <main className="app-page">
      <p style={{ marginBottom: 24 }}>
        <Link href={`/leagues/${slug}`} className="app-link">
          ← {league.name}
        </Link>
      </p>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 8, color: "var(--color-text)" }}>
        Roster Changes
      </h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 24 }}>
        All trades, releases, and free agent signings for the league.
      </p>

      {rows.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>No roster changes yet.</p>
      ) : (
        <div className="roster-changes-table-wrap" style={{ overflowX: "auto" }}>
          <table
            className="roster-changes-table"
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}
          >
            <thead>
              <tr style={{ borderBottom: "2px solid var(--color-border)" }}>
                <th
                  style={{
                    padding: "10px 12px",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "var(--color-text-muted)",
                  }}
                >
                  Date
                </th>
                <th
                  style={{
                    padding: "10px 12px",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "var(--color-text-muted)",
                  }}
                >
                  Type
                </th>
                <th
                  style={{
                    padding: "10px 12px",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "var(--color-text-muted)",
                  }}
                >
                  Team(s)
                </th>
                <th
                  style={{
                    padding: "10px 12px",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "var(--color-text-muted)",
                  }}
                >
                  Description
                </th>
                <th
                  style={{
                    padding: "10px 12px",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "var(--color-text-muted)",
                  }}
                >
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={`${r.type}-${r.date}-${r.teams}-${i}`}
                  style={{
                    borderBottom: "1px solid var(--color-border-light)",
                    background: i % 2 === 0 ? undefined : "var(--color-bg-elevated)",
                  }}
                >
                  <td
                    style={{
                      padding: "10px 12px",
                      color: "var(--color-text-muted)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatDate(r.date)}
                  </td>
                  <td style={{ padding: "10px 12px" }}>{r.type}</td>
                  <td style={{ padding: "10px 12px" }}>{r.teams}</td>
                  <td style={{ padding: "10px 12px" }}>{r.description}</td>
                  <td style={{ padding: "10px 12px", fontWeight: 500 }}>
                    {r.status === "Pending" && (
                      <span style={{ color: "var(--color-text-muted)" }}>Pending</span>
                    )}
                    {(r.status === "Accepted" || r.status === "Approved") && (
                      <span style={{ color: "var(--color-success-muted)" }}>{r.status}</span>
                    )}
                    {r.status === "Rejected" && (
                      <span style={{ color: "var(--color-text-dim)" }}>Rejected</span>
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
