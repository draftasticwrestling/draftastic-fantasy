import Link from "next/link";
import { Fragment } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLeagueBySlug, getLeagueMembers } from "@/lib/leagues";
import { getLeagueWeeklyMatchups, getSundayOfWeek } from "@/lib/leagueMatchups";

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
  const { slug, weekStart: weekStartParam } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [members, matchups] = await Promise.all([
    getLeagueMembers(league.id),
    getLeagueWeeklyMatchups(league.id),
  ]);
  const isMember = user && members.some((m) => m.user_id === user.id);
  if (!isMember) notFound();

  const weekStart = decodeURIComponent(weekStartParam);
  const matchup = matchups.find((m) => m.weekStart === weekStart);
  if (!matchup) notFound();

  const weekEnd = getSundayOfWeek(weekStart);
  const teamLabel = (m: { team_name?: string | null; display_name?: string | null }) =>
    (m.team_name?.trim() || m.display_name?.trim() || "Unknown").trim() || "Unknown";

  const sorted = [...members].sort(
    (a, b) => {
      const aPts = (matchup.pointsByUserId[a.user_id] ?? 0) + (matchup.winnerUserId === a.user_id ? 15 : 0) + (matchup.beltHolderUserId === a.user_id ? (matchup.beltRetained ? 4 : 5) : 0);
      const bPts = (matchup.pointsByUserId[b.user_id] ?? 0) + (matchup.winnerUserId === b.user_id ? 15 : 0) + (matchup.beltHolderUserId === b.user_id ? (matchup.beltRetained ? 4 : 5) : 0);
      return bPts - aPts;
    }
  );

  const teamData = sorted.map((m) => {
    const eventPts = matchup.pointsByUserId[m.user_id] ?? 0;
    const isWinner = matchup.winnerUserId === m.user_id;
    const isBeltHolder = matchup.beltHolderUserId === m.user_id;
    const winBonus = isWinner ? 15 : 0;
    const beltBonus = isBeltHolder ? (matchup.beltRetained ? 4 : 5) : 0;
    const totalPts = eventPts + winBonus + beltBonus;
    const breakdown: { label: string; value: number }[] = [{ label: "Event", value: eventPts }];
    if (winBonus) breakdown.push({ label: "Weekly win", value: winBonus });
    if (beltBonus) breakdown.push({ label: matchup.beltRetained ? "Belt retain" : "Belt win", value: beltBonus });
    return { member: m, eventPts, winBonus, beltBonus, totalPts, breakdown, isWinner, isBeltHolder };
  });

  const isHeadToHead = teamData.length === 2;
  const matchupLabel = teamData.length === 2 ? "Head to head" : teamData.length === 3 ? "Triple threat" : `${teamData.length}-team matchup`;

  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: "24px 16px",
        maxWidth: 900,
        margin: "0 auto",
        fontSize: 16,
        lineHeight: 1.5,
        background: "#f5f6f8",
        minHeight: "100vh",
      }}
    >
      <p style={{ marginBottom: 20 }}>
        <Link href={`/leagues/${slug}/matchups`} style={{ color: "#6001d3", textDecoration: "none", fontWeight: 500 }}>
          ← Matchups
        </Link>
        {" · "}
        <Link href={`/leagues/${slug}`} style={{ color: "#6001d3", textDecoration: "none", fontWeight: 500 }}>
          {league.name}
        </Link>
      </p>

      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          overflow: "hidden",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #e8eaed",
            background: "linear-gradient(180deg, #fafafa 0%, #fff 100%)",
          }}
        >
          <div style={{ fontSize: 12, color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
            {matchupLabel}
          </div>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#202124", margin: 0 }}>
            {formatWeekRange(weekStart, weekEnd)}
          </h1>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isHeadToHead ? "1fr auto 1fr" : "repeat(auto-fill, minmax(200px, 1fr))",
            gap: isHeadToHead ? 0 : 16,
            padding: isHeadToHead ? 0 : 20,
            alignItems: "stretch",
          }}
        >
          {teamData.map((t, idx) => (
            <Fragment key={t.member.user_id}>
              {isHeadToHead && idx === 1 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 16px",
                    background: "#fafafa",
                    borderLeft: "1px solid #e8eaed",
                    borderRight: "1px solid #e8eaed",
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#9aa0a6", letterSpacing: "0.1em" }}>
                    VS
                  </span>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: isHeadToHead ? 24 : 20,
                  background: t.isWinner ? "linear-gradient(180deg, #e8f5e9 0%, #fff 100%)" : "#fff",
                  borderRight: isHeadToHead && idx === 0 ? "1px solid #e8eaed" : "none",
                  borderLeft: isHeadToHead && idx === 1 ? "1px solid #e8eaed" : "none",
                  position: "relative",
                  border: !isHeadToHead ? "1px solid #e8eaed" : undefined,
                  borderRadius: !isHeadToHead ? 10 : 0,
                  boxShadow: !isHeadToHead ? "0 1px 3px rgba(0,0,0,0.06)" : undefined,
                }}
              >
                {t.isWinner && (
                  <div
                    style={{
                      position: "absolute",
                      top: 12,
                      right: 12,
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#0d7d0d",
                      background: "#c8e6c9",
                      padding: "4px 8px",
                      borderRadius: 6,
                    }}
                  >
                    Winner
                  </div>
                )}
                {t.isBeltHolder && !t.isWinner && (
                  <div
                    style={{
                      position: "absolute",
                      top: 12,
                      right: 12,
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#1565c0",
                      background: "#e3f2fd",
                      padding: "4px 8px",
                      borderRadius: 6,
                    }}
                  >
                    Belt
                  </div>
                )}
                <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "#202124", marginBottom: 12, paddingRight: t.isWinner || t.isBeltHolder ? 80 : 0 }}>
                  {teamLabel(t.member)}
                </div>
                <div style={{ fontSize: "2rem", fontWeight: 800, color: "#6001d3", lineHeight: 1.2, marginBottom: 12 }}>
                  {t.totalPts}
                  <span style={{ fontSize: "0.6em", fontWeight: 600, color: "#5f6368", marginLeft: 2 }}>pts</span>
                </div>
                <div style={{ fontSize: 12, color: "#5f6368", marginTop: "auto" }}>
                  {t.breakdown.map((b) => (
                    <div key={b.label} style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 2 }}>
                      <span>{b.label}</span>
                      <span style={{ fontWeight: 600, color: "#202124" }}>+{b.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Fragment>
          ))}
        </div>
      </div>

      <p style={{ fontSize: 13, color: "#5f6368", margin: 0, lineHeight: 1.5 }}>
        Event points = your roster’s wrestlers from matches this week. Winner gets +15; Draftastic Championship belt: +5 (win) or +4 (retain). These are added to your league total.
      </p>

      {!matchup.winnerUserId && (
        <p style={{ marginTop: 16, color: "#5f6368", fontSize: 14 }}>
          No winner this week (no events in range or tie).
        </p>
      )}
    </main>
  );
}
