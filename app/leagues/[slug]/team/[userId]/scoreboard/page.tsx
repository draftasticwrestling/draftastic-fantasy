import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLeagueBySlug, getLeagueMembers } from "@/lib/leagues";
import { factionDisplayName } from "@/lib/factionName";
import { getTeamScoringAudit } from "@/lib/teamScoring";

type Props = {
  params: Promise<{ slug: string; userId: string }>;
};

export const dynamic = "force-dynamic";

export default async function TeamScoreboardPage({ params }: Props) {
  const { slug, userId } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const members = await getLeagueMembers(league.id);
  const isMember = members.some((m) => m.user_id === user.id);
  if (!isMember) notFound();

  const teamMember = members.find((m) => m.user_id === userId);
  if (!teamMember) notFound();

  const teamLabel = factionDisplayName(teamMember, "Faction");
  const audit = await getTeamScoringAudit(league.id, userId);

  const wrestlerIds = [...new Set(audit.ledgerRows.map((r) => r.wrestlerId).concat(audit.formerStints.map((s) => s.wrestlerId)))];
  const { data: wrestlers } = wrestlerIds.length
    ? await supabase.from("wrestlers").select("id, name").in("id", wrestlerIds)
    : { data: [] as Array<{ id: string; name: string | null }> };
  const wrestlerName = Object.fromEntries((wrestlers ?? []).map((w) => [w.id, w.name ?? w.id]));

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 980, margin: "0 auto" }}>
      <p style={{ marginBottom: 16 }}>
        <Link href={`/leagues/${slug}/team/${encodeURIComponent(userId)}`} style={{ color: "#1a73e8", textDecoration: "none" }}>
          ← Back to {teamLabel}
        </Link>
      </p>
      <h1 style={{ margin: "0 0 8px", fontSize: "1.6rem" }}>Faction Scoreboard</h1>
      <p style={{ margin: "0 0 18px", color: "#4b5563" }}>
        {teamLabel} total: <strong>{audit.teamTotal} pts</strong>
      </p>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: "1.05rem", marginBottom: 10 }}>Points by wrestler (faction-attributed)</h2>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {Object.entries(audit.totalsByWrestler)
            .sort((a, b) => b[1].total - a[1].total)
            .map(([wid, p]) => (
              <li
                key={wid}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: "1px solid #eee",
                  fontSize: 14,
                }}
              >
                <span style={{ color: "#1f2937", fontWeight: 600 }}>{wrestlerName[wid] ?? wid}</span>
                <span style={{ color: "#374151" }}>
                  {p.total} pts <span style={{ color: "#6b7280" }}>(R/S {p.rsPoints}, PLE {p.plePoints}, Belt {p.beltPoints})</span>
                </span>
              </li>
            ))}
          {Object.keys(audit.totalsByWrestler).length === 0 && (
            <li style={{ color: "#6b7280", padding: "8px 0" }}>No scored points yet.</li>
          )}
        </ul>
      </section>

      <section>
        <h2 style={{ fontSize: "1.05rem", marginBottom: 10 }}>Point-by-point ledger</h2>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: 0, marginBottom: 12 }}>
          Raw and SmackDown and PLE event contributions, plus end-of-month title-holder bonuses (dated on the last day
          of the month, e.g. 2026-03-31).
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f3f4f6", textAlign: "left" }}>
                <th style={{ padding: "8px 10px", borderBottom: "1px solid #e5e7eb" }}>Date</th>
                <th style={{ padding: "8px 10px", borderBottom: "1px solid #e5e7eb" }}>Event</th>
                <th style={{ padding: "8px 10px", borderBottom: "1px solid #e5e7eb" }}>Wrestler</th>
                <th style={{ padding: "8px 10px", borderBottom: "1px solid #e5e7eb" }}>How</th>
                <th style={{ padding: "8px 10px", borderBottom: "1px solid #e5e7eb", textAlign: "right" }}>Pts</th>
              </tr>
            </thead>
            <tbody>
              {audit.ledgerRows.map((row, idx) => (
                <tr key={`${row.eventId}-${row.wrestlerId}-${idx}`}>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap", color: "#475569" }}>
                    {row.eventDate}
                  </td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", color: "#1f2937" }}>
                    {row.eventName}
                  </td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", color: "#1f2937", fontWeight: 600 }}>
                    {wrestlerName[row.wrestlerId] ?? row.wrestlerId}
                  </td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", color: "#475569" }}>
                    {row.details.length > 0 ? row.details.join("; ") : `R/S ${row.rsPoints}, PLE ${row.plePoints}, Belt ${row.beltPoints}`}
                  </td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", textAlign: "right", fontWeight: 700, color: "#111827" }}>
                    {row.points}
                  </td>
                </tr>
              ))}
              {audit.ledgerRows.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: "10px", color: "#6b7280" }}>
                    No scored events yet for this faction.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
