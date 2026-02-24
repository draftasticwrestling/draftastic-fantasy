import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLeagueBySlug, getLeagueMembers, getRostersForLeagueForWeek } from "@/lib/leagues";
import { getRosterRulesForLeague } from "@/lib/leagueStructure";
import {
  getLeagueWeeklyMatchups,
  getMatchupsForWeek,
  getSundayOfWeek,
  getPointsByOwnerByWrestlerForWeek,
} from "@/lib/leagueMatchups";

type Props = { params: Promise<{ slug: string; weekStart: string }> };

export const dynamic = "force-dynamic";

function formatWeekRange(weekStart: string, weekEnd: string): string {
  const fmt = (s: string) => {
    const d = new Date(s + "T12:00:00Z");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };
  return `${fmt(weekStart)} – ${fmt(weekEnd)}`;
}

export default async function LeagueMatchupDetailPage({ params }: Props) {
  const { slug, weekStart } = await params;
  const weekStartDecoded = decodeURIComponent(weekStart);
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [members, matchups, rosters, pointsByOwnerByWrestler, wrestlersRows] = await Promise.all([
    getLeagueMembers(league.id),
    getLeagueWeeklyMatchups(league.id),
    getRostersForLeagueForWeek(league.id, weekStartDecoded),
    getPointsByOwnerByWrestlerForWeek(league.id, weekStartDecoded),
    supabase.from("wrestlers").select("id, name").order("name", { ascending: true }),
  ]);
  const isMember = user && members.some((m) => m.user_id === user.id);
  if (!isMember) notFound();
  const matchup = matchups.find((m) => m.weekStart === weekStartDecoded);
  if (!matchup) notFound();
  const weekMatchup = matchup;

  const weekEnd = getSundayOfWeek(weekStartDecoded);
  const memberByUserId = Object.fromEntries(members.map((m) => [m.user_id, m]));
  const teamLabel = (m: { team_name?: string | null; display_name?: string | null }) =>
    (m.team_name?.trim() || m.display_name?.trim() || "Unknown").trim() || "Unknown";
  const wrestlerNames: Record<string, string> = Object.fromEntries(
    (wrestlersRows.data ?? []).map((w) => [w.id, w.name ?? w.id])
  );
  const rosterRules = getRosterRulesForLeague(members.length);
  const maxSlots = rosterRules?.rosterSize ?? 12;

  const weekMatchups = getMatchupsForWeek(
    members.map((m) => m.user_id),
    members.length
  );

  function totalForUser(userId: string): number {
    const eventPts = weekMatchup.pointsByUserId[userId] ?? 0;
    const winBonus = weekMatchup.winnerUserId === userId ? 15 : 0;
    const beltBonus =
      weekMatchup.beltHolderUserId === userId ? (weekMatchup.beltRetained ? 4 : 5) : 0;
    return eventPts + winBonus + beltBonus;
  }

  return (
    <main
      className="app-page"
      style={{ maxWidth: 960, fontSize: 16, lineHeight: 1.5, minHeight: "100vh" }}
    >
      <p style={{ marginBottom: 20 }}>
        <Link
          href={`/leagues/${slug}/matchups?week=${encodeURIComponent(weekStartDecoded)}`}
          className="app-link"
          style={{ fontWeight: 500 }}
        >
          ← Scoreboard
        </Link>
        {" · "}
        <Link href={`/leagues/${slug}`} className="app-link" style={{ fontWeight: 500 }}>
          {league.name}
        </Link>
      </p>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--color-text)", margin: "0 0 4px 0" }}>
          Matchup {matchups.findIndex((m) => m.weekStart === weekStartDecoded) + 1} ({formatWeekRange(weekStartDecoded, weekEnd)})
        </h1>
        <div style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
          Week runs Monday–Sunday. Event points + weekly win (+15) and belt (+5/+4) bonuses.
        </div>
      </div>

      {weekMatchups.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>No matchups this week.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {weekMatchups.map((mu, matchupIdx) => {
            const teamData = mu.userIds.map((uid) => {
              const member = memberByUserId[uid];
              const entries = (rosters[uid] ?? []).slice(0, maxSlots);
              const byWrestler = pointsByOwnerByWrestler[uid] ?? {};
              const rosterRows = entries.map((e, i) => ({
                slot: i + 1,
                wrestlerId: e.wrestler_id,
                name: wrestlerNames[e.wrestler_id] ?? e.wrestler_id,
                points: byWrestler[e.wrestler_id] ?? 0,
              }));
              while (rosterRows.length < maxSlots) {
                rosterRows.push({
                  slot: rosterRows.length + 1,
                  wrestlerId: "",
                  name: "—",
                  points: 0,
                });
              }
              return {
                userId: uid,
                member,
                label: member ? teamLabel(member) : "Unknown",
                total: totalForUser(uid),
                isWinner: weekMatchup.winnerUserId === uid,
                isBeltHolder: weekMatchup.beltHolderUserId === uid,
                rosterRows,
              };
            });

            return (
              <section
                key={matchupIdx}
                className={`matchup-detail-card ${mu.type === "triple" ? "matchup-detail-card--triple" : ""}`}
                style={{
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-lg)",
                  overflow: "hidden",
                  background: "var(--color-bg-card)",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                }}
              >
                {/* Header: team names + totals side by side (stacks on mobile for triple) */}
                <div
                  className="matchup-detail-header"
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      mu.type === "triple"
                        ? "1fr 1fr 1fr"
                        : "1fr auto 1fr",
                    gap: 16,
                    alignItems: "center",
                    padding: "20px 20px 16px",
                    borderBottom: "1px solid var(--color-border)",
                    background: "var(--color-bg-elevated)",
                  }}
                >
                  {mu.type === "h2h" ? (
                    <>
                      <TeamHeaderBlock data={teamData[0]!} />
                      <div
                        style={{
                          textAlign: "center",
                          fontSize: 14,
                          fontWeight: 800,
                          color: "var(--color-text-muted)",
                          letterSpacing: "0.08em",
                        }}
                      >
                        VS
                      </div>
                      <TeamHeaderBlock data={teamData[1]!} />
                    </>
                  ) : (
                    teamData.map((t) => <TeamHeaderBlock key={t.userId} data={t} />)
                  )}
                </div>

                {/* Roster breakdown table */}
                <div
                  className="matchup-roster-table-wrap"
                  style={{
                    overflowX: "auto",
                    padding: 16,
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 14,
                    }}
                  >
                    <thead>
                      <tr>
                        <th
                          style={{
                            padding: "8px 12px",
                            textAlign: "left",
                            fontWeight: 600,
                            color: "var(--color-text-muted)",
                            background: "#f0f2f5",
                            width: 48,
                          }}
                        >
                          #
                        </th>
                        {teamData.map((t) => (
                          <th
                            key={t.userId}
                            style={{
                              padding: "8px 12px",
                              textAlign: "left",
                              fontWeight: 600,
                              color: "var(--color-text)",
                              background: "#f0f2f5",
                              borderLeft: "1px solid var(--color-border)",
                            }}
                          >
                            {t.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: maxSlots }, (_, rowIdx) => (
                        <tr
                          key={rowIdx}
                          style={{
                            background: rowIdx % 2 === 0 ? "#fff" : "#f8f9fa",
                          }}
                        >
                          <td
                            style={{
                              padding: "8px 12px",
                              color: "var(--color-text-muted)",
                              borderBottom: "1px solid var(--color-border)",
                            }}
                          >
                            {rowIdx + 1}
                          </td>
                          {teamData.map((t) => {
                            const row = t.rosterRows[rowIdx];
                            return (
                              <td
                                key={t.userId}
                                style={{
                                  padding: "8px 12px",
                                  borderLeft: "1px solid var(--color-border)",
                                  borderBottom: "1px solid var(--color-border)",
                                  color: row?.wrestlerId ? "var(--color-text)" : "var(--color-text-muted)",
                                }}
                              >
                                <span style={{ display: "block" }}>{row?.name ?? "—"}</span>
                                {row?.wrestlerId && (
                                  <span
                                    style={{
                                      fontSize: 12,
                                      fontWeight: 600,
                                      color: "var(--color-red)",
                                    }}
                                  >
                                    {row.points > 0 ? `+${row.points}` : "0"}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}

      <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 24, lineHeight: 1.5 }}>
        Event points = roster wrestlers’ points from matches this week. Winner gets +15; Draftastic
        Championship: +5 (win) or +4 (retain).
      </p>
    </main>
  );
}

function TeamHeaderBlock({
  data,
}: {
  data: {
    label: string;
    total: number;
    isWinner: boolean;
    isBeltHolder: boolean;
  };
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 4,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--color-text)" }}>
          {data.label}
        </span>
        {data.isWinner && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--color-success-muted)",
              background: "var(--color-success-bg)",
              padding: "2px 6px",
              borderRadius: 4,
            }}
          >
            Winner
          </span>
        )}
        {data.isBeltHolder && !data.isWinner && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--color-blue)",
              background: "var(--color-blue-bg)",
              padding: "2px 6px",
              borderRadius: 4,
            }}
          >
            Belt
          </span>
        )}
      </div>
      <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--color-red)", lineHeight: 1.2 }}>
        {data.total}
        <span style={{ fontSize: "0.5em", fontWeight: 600, color: "var(--color-text-dim)", marginLeft: 2 }}>
          pts
        </span>
      </div>
    </div>
  );
}
