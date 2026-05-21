import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import {
  getLeagueBySlug,
  getLeagueMembers,
  getRostersForLeague,
  getRostersForLeagueForWeek,
  type LeagueMember,
} from "@/lib/leagues";
import { getRosterRulesForLeague, leagueIncludesNxt } from "@/lib/leagueStructure";
import {
  getLeagueWeeklyMatchups,
  leagueUsesOwnerMatchupBonuses,
  getXpSeededMemberUserIds,
  getScheduledMatchupsForWeek,
  getWeeksInRange,
  getCurrentWeekStart,
  getSundayOfWeek,
  getPointsByOwnerByWrestlerForWeek,
  getMonthlyBeltBySlugForWeek,
  getPointsByOwnerForLeagueWithBonuses,
} from "@/lib/leagueMatchups";
import { getMatchupWrestlerChampionTitleLineBySlug } from "@/lib/matchupWrestlerCurrentTitles";
import { sumMonthlyBeltPointsForStint } from "@/lib/scoring/rosterStintEventPoints";
import { formatMatchupTotalPts } from "@/lib/formatMatchupTotalPts";
import { factionDisplayName } from "@/lib/factionName";
import { matchupRosterTransactionLines } from "@/lib/formatRosterMovePt";
import { sortMatchupRosterRowsByWeekPointsDesc } from "@/lib/sortMatchupRosterRowsByWeekPoints";
import { MatchupOwnerAvatarRing } from "./MatchupOwnerHeading";
import { MatchupMobileH2hMasthead, type MatchupMobileRosterRow } from "./MatchupMobileH2h";
import { MatchupMobileH2hCollapsible } from "./MatchupMobileH2hCollapsible";
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

type ScoreboardRosterRowLike = {
  wrestlerId?: string;
  name: string;
  points: number;
  eventPts: number;
  monthlyPts: number;
  txnLines: string[];
  championTitles?: string | null;
};

function scoreboardRowsToMobileLineup(rows: ScoreboardRosterRowLike[]): MatchupMobileRosterRow[] {
  return rows.map((r, i) => ({
    slot: i + 1,
    wrestlerId: r.wrestlerId ?? "",
    name: r.name,
    points: r.points,
    eventPts: r.eventPts,
    monthlyPts: r.monthlyPts,
    txnLines: r.txnLines,
    championTitles: r.championTitles ?? null,
  }));
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
    member?: LeagueMember | null;
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
  const m = t.member ?? null;
  return (
    <td
      className="matchups-score-header"
      style={{
        padding: "14px 12px",
        background: isWinner ? "var(--color-success-bg)" : "var(--color-bg-elevated)",
        borderLeft: "1px solid var(--color-border)",
        textAlign: "center",
        verticalAlign: "middle",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            minWidth: 0,
          }}
        >
          <MatchupOwnerAvatarRing member={m} size={48} />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: 6,
              fontWeight: 700,
              fontSize: 15,
              color: "var(--color-text)",
              minWidth: 0,
            }}
          >
            <span>{t.label}</span>
            {isWinner && (
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-success-muted)" }}>W</span>
            )}
          </div>
        </div>
        <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--color-red)", lineHeight: 1.2 }}>
          {formatMatchupTotalPts(t.total)}
        </div>
        {showBreakdown && bonusLine && (
          <div style={{ fontSize: 11, color: "var(--color-text-muted)", maxWidth: "100%" }}>{bonusLine}</div>
        )}
      </div>
    </td>
  );
}

function RosterCell({
  row,
  borderLeft,
  leagueSlug,
  align,
}: {
  row?:
    | {
        name: string;
        points: number;
        eventPts?: number;
        monthlyPts?: number;
        wrestlerId?: string;
        txnLines?: string[];
        championTitles?: string | null;
      }
    | undefined;
  borderLeft?: boolean;
  leagueSlug?: string;
  /** Left: name left, points right (toward center). Right: points left, name right. */
  align: "left" | "right";
}) {
  const name = row?.name ?? "—";
  const wrestlerId = row?.wrestlerId;
  const pts = row?.points ?? 0;
  const monthlyPts = row?.monthlyPts ?? 0;
  const eventPts = row?.eventPts ?? (pts - monthlyPts);
  const txnLines = row?.txnLines ?? [];
  const ptsDisplay =
    wrestlerId != null && wrestlerId !== ""
      ? pts > 0
        ? monthlyPts > 0
          ? `+${eventPts} + ${monthlyPts} belt`
          : `+${pts}`
        : "0"
      : null;
  const nameNode = wrestlerId && leagueSlug ? (
    <Link
      href={`/wrestlers/${encodeURIComponent(wrestlerId)}?league=${encodeURIComponent(leagueSlug)}`}
      className="app-link matchups-roster-name"
      style={{ whiteSpace: "nowrap", fontWeight: 500 }}
    >
      {name}
    </Link>
  ) : (
    <span className="matchups-roster-name" style={{ whiteSpace: "nowrap" }}>
      {name}
    </span>
  );

  const nameBlock = (
    <div style={{ minWidth: 0, textAlign: align === "right" ? "right" : "left" }}>
      <div>{nameNode}</div>
      {row?.championTitles ? (
        <div
          className="matchups-roster-champion-titles"
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: "#b8860b",
            marginTop: 2,
            lineHeight: 1.35,
            whiteSpace: "normal",
          }}
        >
          {row.championTitles}
        </div>
      ) : null}
      {txnLines.length > 0 && (
        <div
          style={{
            fontSize: 10,
            color: "var(--color-text-muted)",
            marginTop: 3,
            lineHeight: 1.35,
          }}
        >
          {txnLines.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}
    </div>
  );

  const ptsNode =
    ptsDisplay != null ? (
      <span
        style={{
          flexShrink: 0,
          fontSize: 12,
          fontWeight: 600,
          color: "var(--color-red)",
          lineHeight: 1.25,
        }}
      >
        {ptsDisplay}
      </span>
    ) : null;

  return (
    <td
      className="matchups-roster-cell"
      style={{
        padding: "6px 12px",
        borderLeft: borderLeft ? "1px solid var(--color-border)" : undefined,
        color: row?.name && row.name !== "—" ? "var(--color-text)" : "var(--color-text-muted)",
        verticalAlign: "top",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 8,
          width: "100%",
          flexDirection: align === "right" ? "row-reverse" : "row",
        }}
      >
        {nameBlock}
        {ptsNode}
      </div>
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
  const ownerBonusRules = leagueUsesOwnerMatchupBonuses(league.league_type ?? null);

  const { supabase, user } = await getServerAuth();
  const [members, matchups] = await Promise.all([
    getLeagueMembers(league.id),
    getLeagueWeeklyMatchups(league.id),
  ]);
  const seededMemberUserIds = await getXpSeededMemberUserIds(
    members.map((m) => m.user_id),
    supabase
  );
  const isMember = user && members.some((m) => m.user_id === user.id);
  if (!isMember) notFound();

  const memberByUserId = Object.fromEntries(members.map((m) => [m.user_id, m]));
  const teamLabel = (m: { team_name?: string | null; display_name?: string | null }) =>
    factionDisplayName(m, "Unknown");

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

  const rosterRules = getRosterRulesForLeague(
    members.length,
    league.season_slug ?? null,
    leagueIncludesNxt(league),
    league.league_type ?? null
  );

  let pointsByOwnerByWrestler: Record<string, Record<string, number>> = {};
  let wrestlerNames: Record<string, string> = {};
  let rosters: Awaited<ReturnType<typeof getRostersForLeague>> = {};
  let monthlyBeltBySlug: Record<string, number> = {};
  let beltWeekEndSunday: string | null = null;
  let championTitleByWrestlerId: Record<string, string | null> = {};
  let seasonPointsByUserId: Record<string, number> = {};
  let wrestlerMeta: Record<string, { image_url?: string | null; brand?: string | null }> = {};
  if (selectedWeekStart) {
    const [pts, weekRosters, monthlyBelt, seasonPts] = await Promise.all([
      getPointsByOwnerByWrestlerForWeek(league.id, selectedWeekStart),
      getRostersForLeagueForWeek(league.id, selectedWeekStart),
      getMonthlyBeltBySlugForWeek(league.id, selectedWeekStart),
      getPointsByOwnerForLeagueWithBonuses(league.id, supabase),
    ]);
    const wrestlerIds = [
      ...new Set(
        Object.values(weekRosters)
          .flat()
          .map((e) => e.wrestler_id)
      ),
    ];
    const wr =
      wrestlerIds.length > 0
        ? await supabase.from("wrestlers").select("id, name, image_url, brand").in("id", wrestlerIds)
        : { data: [] as { id: string; name: string | null; image_url?: string | null; brand?: string | null }[] };
    pointsByOwnerByWrestler = pts;
    monthlyBeltBySlug = monthlyBelt;
    beltWeekEndSunday = getSundayOfWeek(selectedWeekStart);
    wrestlerNames = Object.fromEntries(
      ((wr.data ?? []) as { id: string; name: string | null }[]).map((w) => [w.id, w.name ?? w.id])
    );
    wrestlerMeta = Object.fromEntries(
      ((wr.data ?? []) as { id: string; image_url?: string | null; brand?: string | null }[]).map((w) => [
        w.id,
        { image_url: w.image_url ?? null, brand: w.brand ?? null },
      ])
    );
    championTitleByWrestlerId = await getMatchupWrestlerChampionTitleLineBySlug(wrestlerIds, wrestlerNames);
    rosters = weekRosters;
    seasonPointsByUserId = seasonPts;
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
      ? getScheduledMatchupsForWeek({
          weekStart: selectedWeekStart,
          weekStarts: weeks,
          memberUserIds: members.map((m) => m.user_id),
          seededMemberUserIds,
          maxTeams: league.max_teams ?? null,
          draftStatus: league.draft_status ?? null,
          weeklyResults: matchups,
        })
      : [];

  function totalForUser(userId: string): number {
    if (!matchupForWeek) return 0;
    const eventPts = matchupForWeek.pointsByUserId[userId] ?? 0;
    const winBonus = ownerBonusRules && matchupForWeek.winnerUserId === userId ? 15 : 0;
    const beltBonus =
      ownerBonusRules && matchupForWeek.beltHolderUserId === userId
        ? matchupForWeek.beltRetained
          ? 4
          : 5
        : 0;
    return eventPts + winBonus + beltBonus;
  }

  return (
    <main className="app-page matchups-page" style={{ maxWidth: 720, fontSize: 16, lineHeight: 1.5 }}>
      <p style={{ marginBottom: 24 }}>
        <Link href={`/leagues/${slug}`} className="app-link">
          ← {league.name}
        </Link>
      </p>

      <div className="matchups-page__toolbar">
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
      <p className="matchups-rules-blurb" style={{ color: "var(--color-text-muted)", marginBottom: 24, fontSize: 14 }}>
        {ownerBonusRules ? (
          <>
            Each week (Monday–Sunday) teams face off. Most event points wins the matchup and gets{" "}
            <strong>+15 pts</strong>. Draftastic Championship: <strong>+5</strong> to win the belt,{" "}
            <strong>+4</strong> to retain.
          </>
        ) : (
          <>
            Each week (Monday–Sunday) teams face off. Weekly matchups are scored by event points only, and
            standings are based on win-loss-draw record.
          </>
        )}
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
              const winBonus =
                ownerBonusRules && matchupForWeek?.winnerUserId === uid ? (matchupForWeek?.weeklyWinPoints ?? 15) : 0;
              const beltBonus =
                ownerBonusRules && matchupForWeek?.beltHolderUserId === uid
                  ? (matchupForWeek?.beltRetained ? matchupForWeek?.beltPoints ?? 4 : matchupForWeek?.beltPoints ?? 5)
                  : 0;
              return {
                userId: uid,
                member: memberByUserId[uid] ?? null,
                label: teamLabel(memberByUserId[uid] ?? {}),
                total: totalForUser(uid),
                eventPts,
                winBonus,
                beltBonus,
              };
            });
            const isWinner = (uid: string) => matchupForWeek?.winnerUserId === uid;

            type ScoreboardRosterRow = {
              wrestlerId?: string;
              name: string;
              points: number;
              eventPts: number;
              monthlyPts: number;
              txnLines: string[];
              championTitles?: string | null;
            };
            const rosterByTeam: ScoreboardRosterRow[][] = teamData.map((t) => {
              const entries = (rosters[t.userId] ?? []).slice(0, maxSlots);
              const byWrestler = pointsByOwnerByWrestler[t.userId] ?? {};
              return entries.map((e, i): ScoreboardRosterRow => {
                const eventPts = byWrestler[e.wrestler_id] ?? 0;
                const monthlyPts = beltWeekEndSunday
                  ? sumMonthlyBeltPointsForStint(
                      monthlyBeltBySlug,
                      e.wrestler_id,
                      wrestlerNames[e.wrestler_id],
                      beltWeekEndSunday
                    )
                  : 0;
                const txnLines =
                  selectedWeekStart && beltWeekEndSunday
                    ? matchupRosterTransactionLines(selectedWeekStart, beltWeekEndSunday, e)
                    : [];
                return {
                  wrestlerId: e.wrestler_id,
                  name: wrestlerNames[e.wrestler_id] ?? e.wrestler_id,
                  points: eventPts + monthlyPts,
                  eventPts,
                  monthlyPts,
                  txnLines,
                  championTitles: championTitleByWrestlerId[e.wrestler_id] ?? null,
                };
              });
            });
            while (rosterByTeam.some((r) => r.length < maxSlots)) {
              rosterByTeam.forEach((r) => {
                if (r.length < maxSlots)
                  r.push({
                    name: "—",
                    points: 0,
                    eventPts: 0,
                    monthlyPts: 0,
                    txnLines: [],
                    championTitles: null,
                  });
              });
            }
            const rosterByTeamSorted = rosterByTeam.map((rows) => sortMatchupRosterRowsByWeekPointsDesc(rows));
            const cardShellStyle = {
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-lg)",
              background: "var(--color-bg-card)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              overflow: "hidden" as const,
            };
            const h2hReady = mu.type === "h2h" && teamData[0] && teamData[1];
            const mobileRowsLeft = h2hReady ? scoreboardRowsToMobileLineup(rosterByTeamSorted[0] ?? []) : [];
            const mobileRowsRight = h2hReady ? scoreboardRowsToMobileLineup(rosterByTeamSorted[1] ?? []) : [];

            const scoreboardTable = (
              <table
                className="matchups-scoreboard-table"
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
                      <col style={{ width: "45%" }} />
                      <col style={{ width: 48 }} />
                      <col style={{ width: "45%" }} />
                      <col style={{ width: 40 }} />
                    </>
                  ) : (
                    <>
                      <col style={{ width: "33.33%" }} />
                      <col style={{ width: "33.33%" }} />
                      <col style={{ width: "33.33%" }} />
                      <col style={{ width: 40 }} />
                    </>
                  )}
                </colgroup>
                {mu.type !== "h2h" ? (
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                      <td
                        className="matchups-slot-num"
                        style={{
                          padding: "14px 12px",
                          background: "var(--color-bg-elevated)",
                          borderRight: "1px solid var(--color-border)",
                          verticalAlign: "middle",
                          fontWeight: 600,
                          fontSize: 12,
                          color: "var(--color-text-muted)",
                          textAlign: "center",
                        }}
                      >
                        #
                      </td>
                      {teamData.map((t) => (
                        <ScoreHeaderCell key={t.userId} t={t} isWinner={isWinner(t.userId)} />
                      ))}
                      <td
                        className="matchups-slot-num"
                        style={{
                          padding: "14px 12px",
                          background: "var(--color-bg-elevated)",
                          borderLeft: "1px solid var(--color-border)",
                          verticalAlign: "middle",
                          fontWeight: 600,
                          fontSize: 12,
                          color: "var(--color-text-muted)",
                          textAlign: "center",
                        }}
                      >
                        #
                      </td>
                    </tr>
                  </thead>
                ) : null}
                <tbody>
                  {Array.from({ length: maxSlots }, (_, rowIdx) => (
                    <tr
                      key={rowIdx}
                      style={{
                        background: rowIdx % 2 === 0 ? "#fff" : "#f8f9fa",
                        borderTop: "1px solid var(--color-border)",
                      }}
                    >
                      <td
                        className="matchups-slot-num"
                        style={{ padding: "6px 12px", color: "var(--color-text-muted)", borderRight: "1px solid var(--color-border)" }}
                      >
                        {rowIdx + 1}
                      </td>
                      {mu.type === "h2h" ? (
                        <>
                          <RosterCell row={rosterByTeamSorted[0]?.[rowIdx]} borderLeft leagueSlug={slug} align="left" />
                          <td
                            className="matchups-vs-cell"
                            aria-hidden
                            style={{ borderLeft: "1px solid var(--color-border)", borderRight: "1px solid var(--color-border)" }}
                          />
                          <RosterCell row={rosterByTeamSorted[1]?.[rowIdx]} borderLeft leagueSlug={slug} align="right" />
                        </>
                      ) : (
                        teamData.map((t, colIdx) => (
                          <RosterCell
                            key={t.userId}
                            row={rosterByTeamSorted[colIdx]?.[rowIdx]}
                            borderLeft
                            leagueSlug={slug}
                            align={colIdx === teamData.length - 1 ? "right" : "left"}
                          />
                        ))
                      )}
                      <td
                        className="matchups-slot-num"
                        style={{
                          padding: "6px 12px",
                          color: "var(--color-text-muted)",
                          borderLeft: "1px solid var(--color-border)",
                          textAlign: "center",
                        }}
                      >
                        {rowIdx + 1}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );

            return (
              <section key={idx} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {h2hReady ? (
                  <div className="scoreboard-card scoreboard-card--h2h" style={cardShellStyle}>
                    <div className="matchups-scoreboard-h2h-masthead">
                      <MatchupMobileH2hMasthead
                        teamA={{
                          userId: teamData[0]!.userId,
                          label: teamData[0]!.label,
                          member: teamData[0]!.member,
                          total: teamData[0]!.total,
                          eventPts: teamData[0]!.eventPts,
                          winBonus: teamData[0]!.winBonus,
                          beltBonus: teamData[0]!.beltBonus,
                          isWinner: isWinner(teamData[0]!.userId),
                          isBeltHolder: matchupForWeek?.beltHolderUserId === teamData[0]!.userId,
                          seasonTotalPts: seasonPointsByUserId[teamData[0]!.userId] ?? 0,
                        }}
                        teamB={{
                          userId: teamData[1]!.userId,
                          label: teamData[1]!.label,
                          member: teamData[1]!.member,
                          total: teamData[1]!.total,
                          eventPts: teamData[1]!.eventPts,
                          winBonus: teamData[1]!.winBonus,
                          beltBonus: teamData[1]!.beltBonus,
                          isWinner: isWinner(teamData[1]!.userId),
                          isBeltHolder: matchupForWeek?.beltHolderUserId === teamData[1]!.userId,
                          seasonTotalPts: seasonPointsByUserId[teamData[1]!.userId] ?? 0,
                        }}
                      />
                    </div>
                    <div className="matchup-h2h-mobile-lineup-only">
                      <MatchupMobileH2hCollapsible
                        matchupKey={`${slug}-${selectedWeekStart}-${idx}`}
                        maxSlots={maxSlots}
                        rowsLeft={mobileRowsLeft}
                        rowsRight={mobileRowsRight}
                        leagueSlug={slug}
                        wrestlerMeta={wrestlerMeta}
                      />
                    </div>
                    <div className="matchups-scoreboard-table-wrap matchup-roster-desktop-wrap">{scoreboardTable}</div>
                  </div>
                ) : (
                  <div className="scoreboard-card scoreboard-card--multi" style={cardShellStyle}>
                    <div className="matchups-scoreboard-table-wrap">{scoreboardTable}</div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
