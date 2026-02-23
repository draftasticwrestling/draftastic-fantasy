import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLeagueBySlug, getLeagueMembers, getRostersForLeague } from "@/lib/leagues";
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

  const rosters = await getRostersForLeague(league.id);
  const rosterRules = getRosterRulesForLeague(members.length);
  const maxSlots = rosterRules?.rosterSize ?? 12;

  let pointsByOwnerByWrestler: Record<string, Record<string, number>> = {};
  let wrestlerNames: Record<string, string> = {};
  if (selectedWeekStart) {
    const [pts, wr] = await Promise.all([
      getPointsByOwnerByWrestlerForWeek(league.id, selectedWeekStart),
      supabase.from("wrestlers").select("id, name").order("name", { ascending: true }),
    ]);
    pointsByOwnerByWrestler = pts;
    wrestlerNames = Object.fromEntries(
      ((wr.data ?? []) as { id: string; name: string | null }[]).map((w) => [w.id, w.name ?? w.id])
    );
  }

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
            const teamData = mu.userIds.map((uid) => ({
              userId: uid,
              label: teamLabel(memberByUserId[uid] ?? {}),
              total: totalForUser(uid),
            }));
            const isWinner = (uid: string) => matchupForWeek?.winnerUserId === uid;

            return (
              <section key={idx} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
                      <thead>
                        <tr style={{ background: "#f0f2f5" }}>
                          <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "var(--color-text)" }}>
                            Team
                          </th>
                          <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "var(--color-text)", width: 80 }}>
                            Score
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamData.map((t) => (
                          <tr
                            key={t.userId}
                            style={{
                              borderTop: "1px solid var(--color-border)",
                              background: isWinner(t.userId) ? "var(--color-success-bg)" : undefined,
                            }}
                          >
                            <td style={{ padding: "12px 16px", color: "var(--color-text)", fontWeight: 500 }}>
                              {t.label}
                              {isWinner(t.userId) && (
                                <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: "var(--color-success-muted)" }}>
                                  W
                                </span>
                              )}
                            </td>
                            <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, color: "var(--color-red)" }}>
                              {t.total}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Link>

                <div
                  style={{
                    padding: 12,
                    background: "var(--color-bg-elevated)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius)",
                    fontSize: 14,
                  }}
                >
                  <div style={{ fontWeight: 600, color: "var(--color-text-muted)", marginBottom: 10 }}>
                    How the score happened
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {teamData.map((t) => {
                      const entries = (rosters[t.userId] ?? []).slice(0, maxSlots);
                      const byWrestler = pointsByOwnerByWrestler[t.userId] ?? {};
                      const rows = entries.map((e, i) => ({
                        name: wrestlerNames[e.wrestler_id] ?? e.wrestler_id,
                        points: byWrestler[e.wrestler_id] ?? 0,
                      }));
                      return (
                        <div key={t.userId}>
                          <div style={{ fontWeight: 600, color: "var(--color-text)", marginBottom: 4 }}>
                            {t.label}
                          </div>
                          {rows.length === 0 ? (
                            <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>No wrestlers on roster</div>
                          ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                              <tbody>
                                {rows.map((r, i) => (
                                  <tr key={i} style={{ borderBottom: "1px solid var(--color-border-light)" }}>
                                    <td style={{ padding: "4px 0", color: "var(--color-text)" }}>{r.name}</td>
                                    <td style={{ padding: "4px 0", textAlign: "right", fontWeight: 600, color: "var(--color-red)" }}>
                                      +{r.points}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p style={{ marginTop: 12, marginBottom: 0, fontSize: 12, color: "var(--color-text-muted)" }}>
                    <Link href={`/leagues/${slug}/matchups/${encodeURIComponent(selectedWeekStart!)}`} className="app-link">
                      View full matchup details →
                    </Link>
                  </p>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
