import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeagueBySlug, getLeagueMembers } from "@/lib/leagues";
import {
  computeMatchupWltByUserId,
  getLeagueWeeklyMatchups,
  getPointsByOwnerForLeagueWithBonuses,
  getScheduledMatchupsForWeek,
  getWeeksInRange,
  getXpSeededMemberUserIds,
} from "@/lib/leagueMatchups";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import { getXpDisplayByUserIds } from "@/lib/xp/getXpDisplayByUserIds";
import { LeagueMobileStandingsTable } from "../LeagueMobileStandingsTable";
import { LeagueStandingsTable } from "../LeagueStandingsTable";

export const revalidate = 120;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) return { title: "Standings — Draftastic Fantasy" };
  return {
    title: `Standings — ${league.name} — Draftastic Fantasy`,
    description: "League standings",
  };
}

export default async function StandingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const [members, pointsByOwner, weeklyMatchups] = await Promise.all([
    getLeagueMembers(league.id),
    getPointsByOwnerForLeagueWithBonuses(league.id),
    getLeagueWeeklyMatchups(league.id),
  ]);
  const { user } = await getServerAuth();
  const pointsByUserId = pointsByOwner ?? {};
  const isHeadToHeadRecordStandings = (league.league_type ?? null) === "head_to_head";
  const weekStarts = getWeeksInRange((league.draft_date || league.start_date) ?? "", league.end_date ?? "");
  const seededMemberUserIds = await getXpSeededMemberUserIds(members.map((m) => m.user_id));
  const wltByUserId = isHeadToHeadRecordStandings
    ? computeMatchupWltByUserId(
        league.league_type ?? null,
        members.map((m) => m.user_id),
        weeklyMatchups,
        {
          matchupResolver: (week) =>
            getScheduledMatchupsForWeek({
              weekStart: week.weekStart,
              weekStarts,
              memberUserIds: members.map((m) => m.user_id),
              seededMemberUserIds,
              maxTeams: league.max_teams ?? null,
              draftStatus: league.draft_status ?? null,
              weeklyResults: weeklyMatchups,
            }),
        }
      )
    : {};
  const membersByPoints = [...members].sort((a, b) => {
    if (isHeadToHeadRecordStandings) {
      const wa = wltByUserId[a.user_id] ?? { w: 0, l: 0, t: 0 };
      const wb = wltByUserId[b.user_id] ?? { w: 0, l: 0, t: 0 };
      if (wb.w !== wa.w) return wb.w - wa.w;
      if (wa.l !== wb.l) return wa.l - wb.l;
      if (wb.t !== wa.t) return wb.t - wa.t;
    }
    return (pointsByUserId[b.user_id] ?? 0) - (pointsByUserId[a.user_id] ?? 0);
  });
  const xpByUserId = await getXpDisplayByUserIds(membersByPoints.map((m) => m.user_id));

  return (
    <main className="app-page">
      <div className="league-standings-mobile-only" style={{ paddingTop: 10 }}>
        <p style={{ marginBottom: 14 }}>
          <Link href={`/leagues/${slug}`} className="app-link">
            ← League
          </Link>
        </p>
        <h1 style={{ fontSize: "1.35rem", marginBottom: 8, color: "var(--color-text)" }}>Standings</h1>
        <div style={{ marginTop: 8 }}>
          <LeagueMobileStandingsTable
            members={membersByPoints}
            pointsByUserId={pointsByUserId}
            recordByUserId={wltByUserId}
            showRecordOnly={isHeadToHeadRecordStandings}
            leagueSlug={slug}
            currentUserId={user?.id ?? null}
            xpByUserId={xpByUserId}
          />
        </div>
      </div>

      <div className="league-standings-desktop-only">
        <p style={{ marginBottom: 24 }}>
          <Link href={`/leagues/${slug}`} className="app-link">
            ← {league.name}
          </Link>
        </p>
        <h1
          style={{
            fontSize: "1.8rem",
            marginBottom: 4,
            color: "#f9fafb",
            letterSpacing: 0.4,
          }}
        >
          Standings
        </h1>
        <p style={{ marginBottom: 20, color: "rgba(249,250,251,0.7)", fontSize: 14 }}>
          Click a team to view their full roster card grid and detailed points.
        </p>
        <div style={{ marginTop: 12 }}>
          <LeagueStandingsTable
            members={membersByPoints}
            pointsByUserId={pointsByUserId}
            recordByUserId={wltByUserId}
            showRecordOnly={isHeadToHeadRecordStandings}
            leagueSlug={slug}
            xpByUserId={xpByUserId}
          />
        </div>
      </div>
    </main>
  );
}
