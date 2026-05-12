import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import {
  getLeagueBySlug,
  getLeagueMembers,
  getRostersForLeagueForWeek,
  type LeagueMember,
} from "@/lib/leagues";
import { getRosterRulesForLeague } from "@/lib/leagueStructure";
import {
  getLeagueWeeklyMatchups,
  leagueUsesOwnerMatchupBonuses,
  getXpSeededMemberUserIds,
  getScheduledMatchupsForWeek,
  getWeeksInRange,
  getSundayOfWeek,
  getPointsByOwnerByWrestlerForWeek,
  getMonthlyBeltBySlugForWeek,
} from "@/lib/leagueMatchups";
import { sumMonthlyBeltPointsForStint } from "@/lib/scoring/rosterStintEventPoints";
import { factionDisplayName } from "@/lib/factionName";
import { matchupRosterTransactionLines } from "@/lib/formatRosterMovePt";
import { MatchupOwnerAvatarRing } from "../MatchupOwnerHeading";

type Props = { params: Promise<{ slug: string; weekStart: string }> };

export const dynamic = "force-dynamic";

type MatchupDetailRosterRow = {
  slot: number;
  wrestlerId: string;
  name: string;
  points: number;
  eventPts: number;
  monthlyPts: number;
  txnLines: string[];
};

function MatchupDetailRosterSlot({
  row,
  leagueSlug,
  align,
}: {
  row: MatchupDetailRosterRow | undefined;
  leagueSlug: string;
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

  const nameNode =
    wrestlerId && wrestlerId !== "" ? (
      <Link
        href={`/wrestlers/${encodeURIComponent(wrestlerId)}?league=${encodeURIComponent(leagueSlug)}`}
        className="app-link matchups-roster-name"
        style={{ fontWeight: 500 }}
      >
        {name}
      </Link>
    ) : (
      <span className="matchups-roster-name">{name}</span>
    );

  const nameBlock = (
    <div style={{ minWidth: 0, textAlign: align === "right" ? "right" : "left" }}>
      <div>{nameNode}</div>
      {txnLines.length > 0 && (
        <div
          style={{
            fontSize: 11,
            color: "var(--color-text-muted)",
            marginTop: 2,
            lineHeight: 1.35,
          }}
        >
          {txnLines.map((line, li) => (
            <span key={li} style={{ display: "block" }}>
              {line}
            </span>
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
  );
}

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

  const { supabase, user } = await getServerAuth();
  const [members, matchups, rosters, pointsByOwnerByWrestler, monthlyBeltBySlug] = await Promise.all([
    getLeagueMembers(league.id),
    getLeagueWeeklyMatchups(league.id),
    getRostersForLeagueForWeek(league.id, weekStartDecoded),
    getPointsByOwnerByWrestlerForWeek(league.id, weekStartDecoded),
    getMonthlyBeltBySlugForWeek(league.id, weekStartDecoded),
  ]);
  const seededMemberUserIds = await getXpSeededMemberUserIds(
    members.map((m) => m.user_id),
    supabase
  );
  const wrestlerIds = [
    ...new Set(
      Object.values(rosters)
        .flat()
        .map((e) => e.wrestler_id)
    ),
  ];
  const wrestlersRows =
    wrestlerIds.length > 0
      ? await supabase.from("wrestlers").select("id, name").in("id", wrestlerIds)
      : { data: [] as { id: string; name: string | null }[] };
  const isMember = user && members.some((m) => m.user_id === user.id);
  if (!isMember) notFound();
  const matchup = matchups.find((m) => m.weekStart === weekStartDecoded);
  if (!matchup) notFound();
  const weekMatchup = matchup;

  const weekEnd = getSundayOfWeek(weekStartDecoded);
  const ownerBonusRules = leagueUsesOwnerMatchupBonuses(league.league_type ?? null);
  const memberByUserId = Object.fromEntries(members.map((m) => [m.user_id, m]));
  const teamLabel = (m: { team_name?: string | null; display_name?: string | null }) =>
    factionDisplayName(m, "Unknown");
  const wrestlerNames: Record<string, string> = Object.fromEntries(
    (wrestlersRows.data ?? []).map((w) => [w.id, w.name ?? w.id])
  );
  const rosterRules = getRosterRulesForLeague(
    members.length,
    league.season_slug ?? null,
    Boolean(league.include_nxt),
    league.league_type ?? null
  );
  const maxRosterLen = Math.max(0, ...Object.values(rosters).map((a) => a.length));
  const maxSlots = Math.max(rosterRules?.rosterSize ?? 12, maxRosterLen);

  const leagueStart = (league.draft_date || league.start_date) ?? "";
  const leagueEnd = league.end_date ?? "";
  const weekStarts = leagueStart && leagueEnd ? getWeeksInRange(leagueStart, leagueEnd) : [];
  const weekMatchups = getScheduledMatchupsForWeek({
    weekStart: weekStartDecoded,
    weekStarts,
    memberUserIds: members.map((m) => m.user_id),
    seededMemberUserIds,
    maxTeams: league.max_teams ?? null,
    draftStatus: league.draft_status ?? null,
    weeklyResults: matchups,
  });

  function totalForUser(userId: string): number {
    const eventPts = weekMatchup.pointsByUserId[userId] ?? 0;
    const winBonus = ownerBonusRules && weekMatchup.winnerUserId === userId ? 15 : 0;
    const beltBonus =
      ownerBonusRules && weekMatchup.beltHolderUserId === userId ? (weekMatchup.beltRetained ? 4 : 5) : 0;
    return eventPts + winBonus + beltBonus;
  }

  return (
    <main
      className="app-page matchups-detail-page"
      style={{ maxWidth: 960, fontSize: 16, lineHeight: 1.5, minHeight: "100vh" }}
    >
      <p className="matchups-detail-breadcrumb" style={{ marginBottom: 20 }}>
        <Link
          href={`/leagues/${slug}/matchups?week=${encodeURIComponent(weekStartDecoded)}`}
          className="app-link"
          style={{ fontWeight: 500 }}
        >
          ← Scoreboard
        </Link>
        <span className="matchups-detail-bc-sep" aria-hidden>
          {" "}
          ·{" "}
        </span>
        <Link href={`/leagues/${slug}`} className="app-link" style={{ fontWeight: 500 }}>
          {league.name}
        </Link>
      </p>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--color-text)", margin: "0 0 4px 0" }}>
          Matchup {matchups.findIndex((m) => m.weekStart === weekStartDecoded) + 1} ({formatWeekRange(weekStartDecoded, weekEnd)})
        </h1>
        <div style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
          {ownerBonusRules
            ? "Week runs Monday–Sunday. Event points + weekly win (+15) and belt (+5/+4) bonuses."
            : "Week runs Monday–Sunday. Matchups use event points only (no owner bonus points)."}
          {ownerBonusRules &&
            (league.league_type === "head_to_head" || league.league_type === "combo" || league.league_type == null) &&
            " Weekly title-hold (belt) points are included once that Sunday has ended in PT (Los Angeles time)."}
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
              const rosterRows = entries.map((e, idx) => {
                const txnLines = matchupRosterTransactionLines(weekStartDecoded, weekEnd, e);
                const eventPts = byWrestler[e.wrestler_id] ?? 0;
                const monthlyPts = sumMonthlyBeltPointsForStint(
                  monthlyBeltBySlug,
                  e.wrestler_id,
                  wrestlerNames[e.wrestler_id],
                  weekEnd
                );
                return {
                  slot: idx + 1,
                  wrestlerId: e.wrestler_id,
                  name: wrestlerNames[e.wrestler_id] ?? e.wrestler_id,
                  points: eventPts + monthlyPts,
                  eventPts,
                  monthlyPts,
                  txnLines,
                };
              });
              while (rosterRows.length < maxSlots) {
                rosterRows.push({
                  slot: rosterRows.length + 1,
                  wrestlerId: "",
                  name: "—",
                  points: 0,
                  eventPts: 0,
                  monthlyPts: 0,
                  txnLines: [],
                });
              }
              return {
                userId: uid,
                member: member ?? null,
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
                    justifyItems: "center",
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

                {/* Roster breakdown table (horizontal scroll on mobile so columns aren't squished) */}
                <div
                  className="matchup-roster-table-wrap"
                  style={{
                    overflowX: "auto",
                    WebkitOverflowScrolling: "touch",
                    padding: 16,
                  }}
                >
                  <table
                    className="matchup-roster-table"
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 14,
                      minWidth: 48 + 48 + 120 * teamData.length,
                      borderTop: "1px solid var(--color-border)",
                    }}
                  >
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
                              borderRight: "1px solid var(--color-border)",
                              textAlign: "center",
                              fontWeight: 600,
                              width: 48,
                              minWidth: 48,
                            }}
                          >
                            {rowIdx + 1}
                          </td>
                          {teamData.map((t, colIdx) => {
                            const row = t.rosterRows[rowIdx];
                            const align: "left" | "right" = colIdx === teamData.length - 1 ? "right" : "left";
                            return (
                              <td
                                key={t.userId}
                                className="matchup-roster-td-team"
                                style={{
                                  padding: "8px 12px",
                                  borderLeft: "1px solid var(--color-border)",
                                  borderBottom: "1px solid var(--color-border)",
                                  color: row?.wrestlerId ? "var(--color-text)" : "var(--color-text-muted)",
                                  minWidth: 120,
                                }}
                              >
                                <MatchupDetailRosterSlot row={row} leagueSlug={slug} align={align} />
                              </td>
                            );
                          })}
                          <td
                            style={{
                              padding: "8px 12px",
                              color: "var(--color-text-muted)",
                              borderBottom: "1px solid var(--color-border)",
                              borderLeft: "1px solid var(--color-border)",
                              textAlign: "center",
                              fontWeight: 600,
                              width: 48,
                              minWidth: 48,
                            }}
                          >
                            {rowIdx + 1}
                          </td>
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
      {((league.league_type ?? null) === "head_to_head" ||
        (league.league_type ?? null) === "combo" ||
        league.league_type == null) && (
        <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 12, lineHeight: 1.5 }}>
          <strong>Free agents:</strong> Each Mon–Sun week you may make two FA adds. Times are shown in{" "}
          <strong>PT</strong>. For a show on the same calendar day as the pickup, that wrestler can score that show’s
          points only if the add was logged <strong>by 5:00 PM PT</strong> (adds after 4:59 PM PT wait until the next
          event). Drops during the week are shown with time when available.
        </p>
      )}
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
    member: LeagueMember | null;
  };
}) {
  return (
    <div
      style={{
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 8,
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
        <MatchupOwnerAvatarRing member={data.member} size={54} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--color-text)" }}>{data.label}</span>
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
