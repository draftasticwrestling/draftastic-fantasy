import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLeagueBySlug, getLeagueMembers, getRostersForLeague, getRostersForLeagueForWeek } from "@/lib/leagues";
import { getRosterRulesForLeague } from "@/lib/leagueStructure";
import {
  getLeagueWeeklyMatchups,
  getMatchupsForWeek,
  getWeeksInRange,
  getCurrentWeekStart,
  getSundayOfWeek,
  getPointsByOwnerByWrestlerForWeek,
} from "@/lib/leagueMatchups";
import { MatchupWeekSelector } from "./MatchupWeekSelector";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ week?: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  try {
    const { slug } = await params;
    const league = await getLeagueBySlug(slug);
    if (!league) return { title: "Matchups — Draftastic Fantasy" };
    return {
      title: `Matchups — ${league.name} — Draftastic Fantasy`,
      description: `Head-to-head weekly matchups and Draftastic Championship for ${league.name}`,
    };
  } catch {
    return { title: "Matchups — Draftastic Fantasy" };
  }
}

function formatWeekRangeShort(weekStart: string, weekEnd: string): string {
  const fmt = (s: string) => {
    const d = new Date(s + "T12:00:00Z");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  return `${fmt(weekStart)} – ${fmt(weekEnd)}`;
}

function ScoreHeaderCell({
  t,
  isWinner,
}: {
  t: {
    label: string;
    total: number;
    userId: string;
    eventPts?: number;
    winBonus?: number;
    beltBonus?: number;
  };
  isWinner: boolean;
}) {
  const { eventPts = 0, winBonus = 0, beltBonus = 0 } = t;
  const showBreakdown = isWinner;
  const parts: string[] = [];
  if (showBreakdown) parts.push(`${eventPts} event`);
  if (showBreakdown && winBonus > 0) parts.push(`+${winBonus} win`);
  if (showBreakdown && beltBonus > 0) parts.push(`+${beltBonus} belt`);
  const bonusLine = parts.join(" · ");
  return (
    <td
      style={{
        padding: "14px 12px",
        background: isWinner ? "var(--color-success-bg)" : "var(--color-bg-elevated)",
        borderLeft: "1px solid var(--color-border)",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 15, color: "var(--color-text)", marginBottom: 4 }}>
        {t.label}
        {isWinner && (
          <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: "var(--color-success-muted)" }}>W</span>
        )}
      </div>
      <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--color-red)" }}>{t.total}</div>
      {showBreakdown && bonusLine && (
        <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>{bonusLine}</div>
      )}
    </td>
  );
}

function RosterCell({
  row,
  borderLeft,
}: {
  row?: { name: string; points: number } | undefined;
  borderLeft?: boolean;
}) {
  const name = row?.name ?? "—";
  const pts = row?.points ?? 0;
  return (
    <td
      style={{
        padding: "6px 12px",
        borderLeft: borderLeft ? "1px solid var(--color-border)" : undefined,
        color: row?.name && row.name !== "—" ? "var(--color-text)" : "var(--color-text-muted)",
      }}
    >
      <span style={{ whiteSpace: "nowrap" }}>
        {name}
        {pts > 0 && (
          <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 600, color: "var(--color-red)" }}>+{pts}</span>
        )}
      </span>
    </td>
  );
}


export default async function LeagueMatchupsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { week: weekParam } = await searchParams;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const leagueStart = (league.draft_date || league.start_date) ?? "";
  const leagueEnd = league.end_date ?? "";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [members, matchups] = await Promise.all([
    getLeagueMembers(league.id),
    getLeagueWeeklyMatchups(league.id),
  ]);
  const isMember = user && members.some((m) => m.user_id === user.id);
  if (!isMember) notFound();

  const memberByUserId = Object.fromEntries(members.map((m) => [m.user_id, m]));
  const teamLabel = (m: { team_name?: string | null; display_name?: string | null }) =>
    (m.team_name?.trim() || m.display_name?.trim() || "Unknown").trim() || "Unknown";

  const weeks = leagueStart && leagueEnd ? getWeeksInRange(leagueStart, leagueEnd) : [];
  const currentWeek = getCurrentWeekStart(leagueStart, leagueEnd);
  const selectedWeekStart =
    weekParam && weeks.includes(weekParam)
      ? weekParam
      : currentWeek && weeks.includes(currentWeek)
        ? currentWeek
        : weeks[0] ?? null;

  const weekOptions = weeks.map((ws, idx) => ({
    weekStart: ws,
    weekEnd: getSundayOfWeek(ws),
    label: formatWeekRangeShort(ws, getSundayOfWeek(ws)),
    weekNumber: idx + 1,
  }));

  const rosterRules = getRosterRulesForLeague(members.length);

  let pointsByOwnerByWrestler: Record<string, Record<string, number>> = {};
  let wrestlerNames: Record<string, string> = {};
  let rosters: Awaited<ReturnType<typeof getRostersForLeague>> = {};
  if (selectedWeekStart) {
    const [pts, wr, weekRosters] = await Promise.all([
      getPointsByOwnerByWrestlerForWeek(league.id, selectedWeekStart),
      supabase.from("wrestlers").select("id, name").order("name", { ascending: true }),
      getRostersForLeagueForWeek(league.id, selectedWeekStart),
    ]);
    pointsByOwnerByWrestler = pts;
    wrestlerNames = Object.fromEntries(
      ((wr.data ?? []) as { id: string; name: string | null }[]).map((w) => [w.id, w.name ?? w.id])
    );
    rosters = weekRosters;
  } else {
    rosters = await getRostersForLeague(league.id);
  }

  const maxRosterLen = Math.max(0, ...Object.values(rosters).map((a) => a.length));
  const maxSlots = Math.max(rosterRules?.rosterSize ?? 12, maxRosterLen);

  const matchupForWeek = selectedWeekStart
    ? matchups.find((m) => m.weekStart === selectedWeekStart)
    : null;
  const weekMatchups =
    selectedWeekStart && members.length >= 3
      ? getMatchupsForWeek(
          members.map((m) => m.user_id),
          members.length
        )
      : [];

  function totalForUser(userId: string): number {
    if (!matchupForWeek) return 0;
    const eventPts = matchupForWeek.pointsByUserId[userId] ?? 0;
    const winBonus = matchupForWeek.winnerUserId === userId ? 15 : 0;
    const beltBonus =
      matchupForWeek.beltHolderUserId === userId
        ? matchupForWeek.beltRetained
          ? 4
          : 5
        : 0;
    return eventPts + winBonus + beltBonus;
  }

  return (
    <main className="app-page" style={{ maxWidth: 720, fontSize: 16, lineHeight: 1.5 }}>
      <p style={{ marginBottom: 24 }}>
        <Link href={`/leagues/${slug}`} className="app-link">
          ← {league.name}
        </Link>
      </p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 8,
        }}
      >
        <h1 style={{ fontSize: "1.5rem", margin: 0, color: "var(--color-text)", fontWeight: 700 }}>
          Scoreboard
        </h1>
        {weekOptions.length > 0 && selectedWeekStart && (
          <MatchupWeekSelector
            weeks={weekOptions}
            selectedWeekStart={selectedWeekStart}
            slug={slug}
          />
        )}
      </div>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 24, fontSize: 14 }}>
        Each week (Monday–Sunday) teams face off. Most event points wins the matchup and gets{" "}
        <strong>+15 pts</strong>. Draftastic Championship: <strong>+5</strong> to win the belt,{" "}
        <strong>+4</strong> to retain.
      </p>

      {matchups.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>
          No weeks in the league date range yet. Set draft date and end date for the league.
        </p>
      ) : !selectedWeekStart ? (
        <p style={{ color: "var(--color-text-muted)" }}>Select a week above.</p>
      ) : (
        <div className="scoreboard-cards" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {weekMatchups.map((mu, idx) => {
            const teamData = mu.userIds.map((uid) => {
              const eventPts = matchupForWeek?.pointsByUserId[uid] ?? 0;
              const winBonus = matchupForWeek?.winnerUserId === uid ? (matchupForWeek?.weeklyWinPoints ?? 15) : 0;
              const beltBonus =
                matchupForWeek?.beltHolderUserId === uid
                  ? (matchupForWeek?.beltRetained ? matchupForWeek?.beltPoints ?? 4 : matchupForWeek?.beltPoints ?? 5)
                  : 0;
              return {
                userId: uid,
                label: teamLabel(memberByUserId[uid] ?? {}),
                total: totalForUser(uid),
                eventPts,
                winBonus,
                beltBonus,
              };
            });
            const isWinner = (uid: string) => matchupForWeek?.winnerUserId === uid;

            const rosterByTeam = teamData.map((t) => {
              const entries = (rosters[t.userId] ?? []).slice(0, maxSlots);
              const byWrestler = pointsByOwnerByWrestler[t.userId] ?? {};
              return entries.map((e, i) => ({
                name: wrestlerNames[e.wrestler_id] ?? e.wrestler_id,
                points: byWrestler[e.wrestler_id] ?? 0,
              }));
            });
            while (rosterByTeam.some((r) => r.length < maxSlots)) {
              rosterByTeam.forEach((r) => {
                if (r.length < maxSlots) r.push({ name: "—", points: 0 });
              });
            }

            return (
              <section key={idx} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                <Link
                  href={`/leagues/${slug}/matchups/${encodeURIComponent(selectedWeekStart!)}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                  className="scoreboard-card-link"
                >
                  <div
                    className="scoreboard-card"
                    style={{
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-lg)",
                      background: "var(--color-bg-card)",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                      overflow: "hidden",
                    }}
                  >
                    {/* Single table so score row and roster columns stay aligned */}
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 13,
                        tableLayout: "fixed",
                      }}
                    >
                      <colgroup>
                        <col style={{ width: 40 }} />
                        {mu.type === "h2h" ? (
                          <>
                            <col style={{ width: "47%" }} />
                            <col style={{ width: 48 }} />
                            <col style={{ width: "47%" }} />
                          </>
                        ) : (
                          <>
                            <col style={{ width: "33.33%" }} />
                            <col style={{ width: "33.33%" }} />
                            <col style={{ width: "33.33%" }} />
                          </>
                        )}
                      </colgroup>
                      <thead>
                        {/* Score row: team name + total in same columns as roster */}
                        <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                          <td style={{ padding: "14px 12px", background: "var(--color-bg-elevated)", borderRight: "1px solid var(--color-border)" }} />
                          {mu.type === "h2h" ? (
                            <>
                              <ScoreHeaderCell t={teamData[0]!} isWinner={isWinner(teamData[0]!.userId)} />
                              <td
                                style={{
                                  padding: "14px 8px",
                                  background: "var(--color-bg-elevated)",
                                  borderLeft: "1px solid var(--color-border)",
                                  borderRight: "1px solid var(--color-border)",
                                  textAlign: "center",
                                  fontSize: 12,
                                  fontWeight: 800,
                                  color: "var(--color-text-muted)",
                                  letterSpacing: "0.05em",
                                }}
                              >
                                VS
                              </td>
                              <ScoreHeaderCell t={teamData[1]!} isWinner={isWinner(teamData[1]!.userId)} />
                            </>
                          ) : (
                            teamData.map((t) => (
                              <ScoreHeaderCell
                                key={t.userId}
                                t={t}
                                isWinner={isWinner(t.userId)}
                              />
                            ))
                          )}
                        </tr>
                        <tr style={{ background: "#f0f2f5" }}>
                          <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "var(--color-text-muted)", borderRight: "1px solid var(--color-border)" }}>
                            #
                          </th>
                          {mu.type === "h2h"
                            ? [
                                <th key={teamData[0]!.userId} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "var(--color-text)", borderLeft: "1px solid var(--color-border)" }}>{teamData[0]!.label}</th>,
                                <th key="vs" style={{ padding: 0, borderLeft: "1px solid var(--color-border)" }} />,
                                <th key={teamData[1]!.userId} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "var(--color-text)", borderLeft: "1px solid var(--color-border)" }}>{teamData[1]!.label}</th>,
                              ]
                            : teamData.map((t) => (
                                <th
                                  key={t.userId}
                                  style={{
                                    padding: "8px 12px",
                                    textAlign: "left",
                                    fontWeight: 600,
                                    color: "var(--color-text)",
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
                              borderTop: "1px solid var(--color-border)",
                            }}
                          >
                            <td style={{ padding: "6px 12px", color: "var(--color-text-muted)", borderRight: "1px solid var(--color-border)" }}>
                              {rowIdx + 1}
                            </td>
                            {mu.type === "h2h" ? (
                              <>
                                <RosterCell row={rosterByTeam[0]?.[rowIdx]} borderLeft />
                                <td style={{ borderLeft: "1px solid var(--color-border)", borderRight: "1px solid var(--color-border)" }} />
                                <RosterCell row={rosterByTeam[1]?.[rowIdx]} borderLeft />
                              </>
                            ) : (
                              teamData.map((t, colIdx) => (
                                <RosterCell
                                  key={t.userId}
                                  row={rosterByTeam[colIdx]?.[rowIdx]}
                                  borderLeft
                                />
                              ))
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Link>
                <p style={{ marginTop: 8, marginBottom: 0, fontSize: 12, color: "var(--color-text-muted)" }}>
                  <Link href={`/leagues/${slug}/matchups/${encodeURIComponent(selectedWeekStart!)}`} className="app-link">
                    View full matchup details →
                  </Link>
                </p>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
