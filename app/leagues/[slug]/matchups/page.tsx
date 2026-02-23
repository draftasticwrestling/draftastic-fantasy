import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLeagueBySlug, getLeagueMembers } from "@/lib/leagues";
import {
  getLeagueWeeklyMatchups,
  getMatchupsForWeek,
  getWeeksInRange,
  getCurrentWeekStart,
  getSundayOfWeek,
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

function TeamScoreBlock({
  team,
  isWinner,
}: {
  team: { label: string; total: number; userId: string };
  isWinner: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        flexWrap: "wrap",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            color: "var(--color-text)",
            fontSize: 14,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {team.label}
          {isWinner && (
            <span
              style={{
                marginLeft: 6,
                fontSize: 11,
                fontWeight: 700,
                color: "var(--color-success-muted)",
              }}
            >
              W
            </span>
          )}
        </div>
      </div>
      <span
        style={{
          fontWeight: 800,
          fontSize: "1.25rem",
          color: "var(--color-red)",
          flexShrink: 0,
        }}
      >
        {team.total}
      </span>
    </div>
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
        <div className="scoreboard-cards" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {weekMatchups.map((mu, idx) => {
            const teamData = mu.userIds.map((uid) => ({
              userId: uid,
              label: teamLabel(memberByUserId[uid] ?? {}),
              total: totalForUser(uid),
            }));
            const isWinner = (uid: string) =>
              matchupForWeek?.winnerUserId === uid;
            return (
              <Link
                key={idx}
                href={`/leagues/${slug}/matchups/${encodeURIComponent(selectedWeekStart)}`}
                style={{ textDecoration: "none", color: "inherit" }}
                className="scoreboard-card-link"
              >
                <div
                  className="scoreboard-card"
                  style={{
                    padding: 16,
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-lg)",
                    background: "var(--color-bg-card)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: mu.type === "triple" ? "1fr 1fr 1fr" : "1fr auto 1fr",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    {mu.type === "h2h" ? (
                      <>
                        <TeamScoreBlock team={teamData[0]!} isWinner={isWinner(teamData[0]!.userId)} />
                        <div
                          style={{
                            textAlign: "center",
                            fontSize: 12,
                            fontWeight: 700,
                            color: "var(--color-text-muted)",
                            letterSpacing: "0.05em",
                          }}
                        >
                          VS
                        </div>
                        <TeamScoreBlock team={teamData[1]!} isWinner={isWinner(teamData[1]!.userId)} />
                      </>
                    ) : (
                      teamData.map((t) => (
                        <TeamScoreBlock
                          key={t.userId}
                          team={t}
                          isWinner={isWinner(t.userId)}
                        />
                      ))
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
