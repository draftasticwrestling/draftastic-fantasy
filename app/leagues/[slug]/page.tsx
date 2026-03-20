import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLeagueBySlug, getLeagueMembers, getRostersForLeague } from "@/lib/leagues";
import { getPointsByOwnerForLeagueWithBonuses } from "@/lib/leagueMatchups";
import { getRosterRulesForLeague } from "@/lib/leagueStructure";
import { getSeasonBySlug } from "@/lib/leagueSeasons";
import { getTradeProposalsForLeague, getLeagueRosterActivity, processTradeTimerDeadlines } from "@/lib/leagueOwner";
import { formatRecipientRosterCutsLine } from "@/lib/tradeDisplay";
import { InviteSuccessModalTrigger } from "../InviteSuccessModalTrigger";
import { LeagueStandingsTable } from "./LeagueStandingsTable";
import { RostersSection } from "./RostersSection";
import { TradeProposalRespond } from "./team/TradeProposalRespond";

function formatLeagueType(type: string | null | undefined): string {
  if (!type) return "Standard";
  switch (type) {
    case "season_overall": return "Total Season Points";
    case "head_to_head": return "Head-to-Head";
    case "combo": return "Combo League (H2H+Total Season Points)";
    case "legacy": return "Legacy";
    default: return type;
  }
}

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  try {
    const { slug } = await params;
    const league = await getLeagueBySlug(slug);
    if (!league) return { title: "Private League — Draftastic Fantasy" };
    return {
      title: `${league.name} — Draftastic Fantasy`,
      description: `Private League (MVL): ${league.name} — season-only rosters`,
    };
  } catch {
    return { title: "Private League — Draftastic Fantasy" };
  }
}

export default async function LeagueDetailPage({ params, searchParams }: Props) {
  let slug: string;
  let showInviteModal = false;
  try {
    const resolved = await params;
    slug = resolved.slug;
    const search = searchParams ? await searchParams : {};
    showInviteModal = search?.invite === "1";
  } catch {
    return (
      <main className="app-page">
        <p style={{ marginBottom: 24 }}>
          <Link href="/leagues" className="app-link">← My leagues</Link>
        </p>
        <h1 style={{ fontSize: "1.25rem", marginBottom: 16, color: "var(--color-text)" }}>Something went wrong</h1>
        <Link href="/leagues" className="app-link">Back to My leagues</Link>
      </main>
    );
  }

  let league: Awaited<ReturnType<typeof getLeagueBySlug>>;
  let members: Awaited<ReturnType<typeof getLeagueMembers>> = [];
  let rosters: Awaited<ReturnType<typeof getRostersForLeague>> = {};
  let wrestlersResult: { id: string; name: string | null; gender: string | null }[] = [];

  const fallback = (
    <main className="app-page">
      <p style={{ marginBottom: 24 }}>
        <Link href="/leagues" className="app-link">← My leagues</Link>
      </p>
      <h1 style={{ fontSize: "1.25rem", marginBottom: 16, color: "var(--color-text)" }}>Something went wrong</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 16 }}>
        We couldn’t load this league. You may need to sign in, or the league may not exist.
      </p>
      <Link href="/leagues" className="app-link">Back to My leagues</Link>
    </main>
  );

  try {
    league = await getLeagueBySlug(slug);
    if (!league) notFound();

    await processTradeTimerDeadlines();

    const supabase = await createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    const [membersData, rostersData, wrestlersData, pointsByOwner] = await Promise.all([
      getLeagueMembers(league.id),
      getRostersForLeague(league.id),
      (async () => {
        const supabase = await createClient();
        // Column is "Status" (capital S) in DB; avoid .or("status...")
        const result = await supabase
          .from("wrestlers")
          .select("id, name, gender")
          .order("name", { ascending: true });
        return (result.data ?? []) as { id: string; name: string | null; gender: string | null }[];
      })(),
      getPointsByOwnerForLeagueWithBonuses(league.id),
    ]);
    members = membersData;
    rosters = rostersData;
    wrestlersResult = wrestlersData;
    const pointsByUserId = pointsByOwner ?? {};

    const rosterRules = getRosterRulesForLeague(members.length);
    const membersByPoints = [...members].sort(
      (a, b) => (pointsByUserId[b.user_id] ?? 0) - (pointsByUserId[a.user_id] ?? 0)
    );

    let tradeProposals: Awaited<ReturnType<typeof getTradeProposalsForLeague>> = [];
    let rosterActivity: Awaited<ReturnType<typeof getLeagueRosterActivity>> = [];
    let wrestlerNames: Record<string, string> = {};
    try {
      [tradeProposals, rosterActivity] = await Promise.all([
        getTradeProposalsForLeague(league.id),
        getLeagueRosterActivity(league.id, 30),
      ]);
      const { data: wrestlers } = await supabase.from("wrestlers").select("id, name");
      wrestlerNames = Object.fromEntries((wrestlers ?? []).map((w: { id: string; name: string | null }) => [w.id, w.name ?? w.id]));
    } catch {
      // Tables may not exist
    }
    const memberByUserId = Object.fromEntries(members.map((m) => [m.user_id, m]));
    type FeedItem =
      | {
          type: "trade";
          id: string;
          created_at: string;
          from_user_id: string;
          to_user_id: string;
          status: string;
          items: { wrestler_id: string; direction: string }[];
          to_user_drop_ids: string[] | null | undefined;
        }
      | { type: "drop"; id: string; created_at: string; user_id: string; wrestler_id: string }
      | { type: "fa_add"; id: string; created_at: string; user_id: string; wrestler_id: string; secondary_wrestler_id: string | null };
    const feedItems: FeedItem[] = [
      ...tradeProposals.map((p) => ({
        type: "trade" as const,
        id: p.id,
        created_at: p.created_at,
        from_user_id: p.from_user_id,
        to_user_id: p.to_user_id,
        status: p.status,
        items: p.items,
        to_user_drop_ids: p.to_user_drop_ids,
      })),
      ...rosterActivity.map((a) => ({ type: a.activity_type as "drop" | "fa_add", id: a.id, created_at: a.created_at, user_id: a.user_id, wrestler_id: a.wrestler_id, secondary_wrestler_id: a.secondary_wrestler_id })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 12);

    const isCommissioner = league.role === "commissioner";
    const currentUserMember = currentUser ? members.find((m) => m.user_id === currentUser.id) : null;
    const commissionerMember = members.find((m) => m.role === "commissioner");
    const creatorLabel = commissionerMember?.display_name?.trim() || commissionerMember?.team_name?.trim() || "Commissioner";
    const maxTeams = league.max_teams ?? 12;
    const leagueNotFull = members.length < maxTeams;
    const hasDraftDate = !!(league.draft_date && String(league.draft_date).trim().slice(0, 10));
    const draftNotScheduled =
      (!league.draft_status || league.draft_status === "not_started") && !hasDraftDate;
    const showAlert = isCommissioner && (leagueNotFull || draftNotScheduled);

    const myTeamName = (currentUserMember?.team_name?.trim() || currentUserMember?.display_name?.trim() || "My Team").trim() || "My Team";
    const myManagerName = currentUserMember?.display_name?.trim() || "Manager";

    const pendingTradesForMe = currentUser
      ? tradeProposals.filter((p) => p.status === "pending" && p.to_user_id === currentUser.id)
      : [];

    return (
    <>
      {isCommissioner && showInviteModal && (
        <InviteSuccessModalTrigger
          show
          leagueId={league.id}
          leagueName={league.name}
          leagueSlug={slug}
        />
      )}
    <main className="lm-dashboard">
      <Link href="/leagues" className="lm-dashboard-back">← My leagues</Link>

      <div className="lm-layout">
        {/* Left sidebar: My Team + Quick Links */}
        <aside className="lm-sidebar">
          <div className="lm-card">
            <h2 className="lm-card-title">My Team</h2>
            <div className="lm-myteam-avatar" aria-hidden>🏆</div>
            <p className="lm-myteam-name">{myTeamName}</p>
            <p className="lm-myteam-manager">{myManagerName}</p>
            {currentUser ? (
              <Link href={`/leagues/${slug}/team/${encodeURIComponent(currentUser.id)}`} className="lm-card-title lm-card-link">
                View Roster
              </Link>
            ) : (
              <Link href={`/leagues/${slug}/team`} className="lm-card-title lm-card-link">
                View Roster
              </Link>
            )}
          </div>
          <div className="lm-card">
            <h2 className="lm-card-title">Quick Links</h2>
            <ul className="lm-quick-links">
              <li><Link href="/how-it-works"><span className="lm-quick-link-icon">☰</span> Rules</Link></li>
              <li><Link href={`/leagues/${slug}/ple/wrestlemania`}><span className="lm-quick-link-icon">🏟</span> WrestleMania</Link></li>
              <li><Link href={`/leagues/${slug}/draft`}><span className="lm-quick-link-icon">⚙</span> Draft</Link></li>
              <li><Link href={`/leagues/${slug}/wrestlers/league-leaders`}><span className="lm-quick-link-icon">👤</span> Wrestlers</Link></li>
              <li><Link href="/"><span className="lm-quick-link-icon">⌂</span> Home</Link></li>
            </ul>
          </div>
        </aside>

        <div className="lm-main">
          {/* Top card: League name, subnav, meta, alert, actions */}
          <div className="lm-card lm-league-card">
            <h1 className="lm-card-title" style={{ fontSize: "1.35rem", marginBottom: 8 }}>{league.name}</h1>
            <nav className="lm-subnav" aria-label="League sections">
              <Link href={currentUser ? `/leagues/${slug}/team/${encodeURIComponent(currentUser.id)}` : `/leagues/${slug}/team`}>My Roster</Link>
              <span className="lm-subnav-sep">|</span>
              <Link href={`/leagues/${slug}/standings`}>Standings</Link>
              <span className="lm-subnav-sep">|</span>
              <Link href={`/leagues/${slug}/ple/wrestlemania`}>Next PLE</Link>
              <span className="lm-subnav-sep">|</span>
              <Link href={`/leagues/${slug}/draft`}>Draft</Link>
            </nav>
            <p className="lm-league-meta">
              <span>Creator: {creatorLabel}</span>
              <span>Format: {formatLeagueType(league.league_type)}</span>
              <span>Teams: {members.length}{maxTeams ? ` / ${maxTeams}` : ""}</span>
            </p>
            {showAlert && (
              <div className="lm-alert" role="alert">
                {leagueNotFull && draftNotScheduled
                  ? "Your league is not full and your draft has not been scheduled."
                  : leagueNotFull
                    ? "Your league is not full."
                    : "Your draft has not been scheduled."}
              </div>
            )}
            {isCommissioner && (
              <div className="lm-actions">
                <InviteSuccessModalTrigger
                  show={showInviteModal}
                  leagueId={league.id}
                  leagueName={league.name}
                  leagueSlug={slug}
                  showInviteButton
                />
                <Link href={`/leagues/${slug}/draft`} className="lm-btn-secondary">
                  Schedule Your Draft
                </Link>
                <Link href={`/leagues/${slug}/proposals`} className="lm-btn-secondary">
                  Pending proposals
                </Link>
              </div>
            )}

            {league.start_date || league.end_date ? (
              <p className="lm-league-meta" style={{ marginTop: 12, marginBottom: 0 }}>
                {league.start_date && league.end_date
                  ? `${league.start_date} – ${league.end_date}`
                  : league.start_date || league.end_date}
              </p>
            ) : null}
            {league.season_slug && (
              <p className="lm-league-meta" style={{ marginTop: 4, marginBottom: 0 }}>
                Season: {getSeasonBySlug(league.season_slug)?.name ?? league.season_slug}
                {league.draft_date && (
                  <>
                    {" · Draft: "}
                    {league.draft_date}
                    {league.draft_time && (() => {
                      const t = String(league.draft_time).trim();
                      const [h, m] = t.split(":").map(Number);
                      if (Number.isNaN(h)) return null;
                      const hour = h % 12 || 12;
                      const ampm = h < 12 ? "AM" : "PM";
                      const min = Number.isNaN(m) ? 0 : m;
                      return ` at ${hour}:${String(min).padStart(2, "0")} ${ampm}`;
                    })()}
                  </>
                )}
              </p>
            )}
          </div>

          {pendingTradesForMe.length > 0 && currentUser && (
            <div
              className="lm-card"
              style={{
                marginBottom: 24,
                padding: 16,
                borderRadius: 16,
                background: "linear-gradient(180deg, rgba(34,197,94,0.14) 0%, rgba(34,197,94,0.06) 100%)",
                border: "1px solid rgba(34,197,94,0.35)",
              }}
            >
              <h2 className="lm-card-title" style={{ marginBottom: 12 }}>
                Trade proposals for you
              </h2>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {pendingTradesForMe.map((p) => {
                  const rosterSize = rosterRules?.rosterSize ?? (rosters[currentUser.id]?.length ?? 0);
                  const myRosterEntries = rosters[currentUser.id] ?? [];
                  const myRosterIds = myRosterEntries.map((e) => e.wrestler_id);
                  const giveCount = p.items.filter((i) => i.direction === "give").length; // recipient receives
                  const receiveCount = p.items.filter((i) => i.direction === "receive").length; // recipient gives
                  const delta = giveCount - receiveCount;
                  const requiredDropCount = Math.max(0, myRosterIds.length + delta - rosterSize);
                  const outgoing = new Set(p.items.filter((i) => i.direction === "receive").map((i) => i.wrestler_id));
                  const dropChoices = myRosterIds
                    .filter((id) => !outgoing.has(id))
                    .map((id) => ({ id, name: wrestlerNames[id] ?? id }));

                  return (
                    <li
                      key={p.id}
                      style={{
                        padding: "12px 0",
                        borderBottom: "1px solid var(--color-border-light)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <span style={{ flex: 1, minWidth: 260 }}>
                        {memberByUserId[p.from_user_id]?.display_name?.trim() ??
                          memberByUserId[p.from_user_id]?.team_name?.trim() ??
                          "Unknown"}{" "}
                        proposes: you give{" "}
                        {p.items
                          .filter((i) => i.direction === "receive")
                          .map((i) => wrestlerNames[i.wrestler_id] ?? i.wrestler_id)
                          .join(", ")}{" "}
                        and receive{" "}
                        {p.items
                          .filter((i) => i.direction === "give")
                          .map((i) => wrestlerNames[i.wrestler_id] ?? i.wrestler_id)
                          .join(", ")}
                      </span>
                      <TradeProposalRespond
                        leagueSlug={slug}
                        proposalId={p.id}
                        proposalFromUserId={p.from_user_id}
                        requiredDropCount={requiredDropCount}
                        dropChoices={dropChoices}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Two-column: League Manager Note + Recent Activity */}
          <div className="lm-main-grid">
            <div className="lm-card">
              <h2 className="lm-card-title">
                League Manager&apos;s Note
                {isCommissioner && <Link href={`/leagues/${slug}/lm-note`} className="lm-card-link">Edit LM Note</Link>}
              </h2>
              <p className="lm-note-text">
                {league?.manager_note?.trim() || "Welcome to your Draftastic Fantasy league. Your League Manager can post a note to the entire league and it will appear here."}
              </p>
            </div>
            <div className="lm-card">
              <h2 className="lm-card-title">
                Recent Activity
                <Link href={`/leagues/${slug}/proposals`} className="lm-card-link">Activity</Link>
              </h2>
              {feedItems.length === 0 ? (
                <p className="lm-activity-empty">No Recent Activity</p>
              ) : (
                <ul className="lm-activity-list" style={{ listStyle: "none", padding: 0, margin: "0 0 12px", fontSize: 14 }}>
                  {feedItems.map((item) => (
                    <li key={`${item.type}-${item.id}`} style={{ padding: "6px 0", borderBottom: "1px solid var(--color-border-light)" }}>
                      {item.type === "trade" && (
                        <>
                          {memberByUserId[item.from_user_id]?.display_name?.trim() ?? "Unknown"} ↔ {memberByUserId[item.to_user_id]?.display_name?.trim() ?? "Unknown"}:{" "}
                          {item.items.filter((i) => i.direction === "give").map((i) => wrestlerNames[i.wrestler_id] ?? i.wrestler_id).join(", ")}
                          {" for "}
                          {item.items.filter((i) => i.direction === "receive").map((i) => wrestlerNames[i.wrestler_id] ?? i.wrestler_id).join(", ")}
                          {(() => {
                            const dropIds = (item.to_user_drop_ids ?? []).map((x) => String(x).trim()).filter(Boolean);
                            const toName =
                              memberByUserId[item.to_user_id]?.display_name?.trim() ??
                              memberByUserId[item.to_user_id]?.team_name?.trim() ??
                              "Recipient";
                            const cuts =
                              dropIds.length > 0
                                ? formatRecipientRosterCutsLine(
                                    toName,
                                    dropIds.map((id) => wrestlerNames[id] ?? id)
                                  )
                                : null;
                            return cuts ? (
                              <span style={{ display: "block", marginTop: 4, fontSize: 12, color: "var(--color-text-muted)" }}>
                                {cuts}
                              </span>
                            ) : null;
                          })()}
                          {(item.status === "gm_approved" || item.status === "accepted") && (
                            <span style={{ marginLeft: 8, fontSize: 13, color: "var(--color-success)", fontWeight: 600 }}>✓ Approved</span>
                          )}
                          {item.status === "pending" && (
                            <span style={{ marginLeft: 8, fontSize: 13, color: "#6b7280", fontWeight: 600 }}>Pending</span>
                          )}
                          {item.status === "gm_rejected" && (
                            <span style={{ marginLeft: 8, fontSize: 13, color: "var(--color-red)", fontWeight: 600 }}>Rejected by GM</span>
                          )}
                          {item.status === "cancelled" && (
                            <span style={{ marginLeft: 8, fontSize: 13, color: "var(--color-red)", fontWeight: 600 }}>Cancelled</span>
                          )}
                          {item.status === "expired" && (
                            <span style={{ marginLeft: 8, fontSize: 13, color: "var(--color-red)", fontWeight: 600 }}>Expired</span>
                          )}
                          {item.status === "rejected" && (
                            <span style={{ marginLeft: 8, fontSize: 13, color: "var(--color-red)", fontWeight: 600 }}>Cancelled</span>
                          )}
                          {item.status === "awaiting_gm_approval" && (
                            <>
                              <span style={{ marginLeft: 8, fontSize: 13, color: "var(--color-warning)", fontWeight: 600 }}>Awaiting GM approval</span>
                              <Link
                                href={`/leagues/${slug}/proposals#proposal-${item.id}`}
                                style={{
                                  marginLeft: 10,
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: "var(--color-warning)",
                                  textDecoration: "none",
                                  border: "1px solid var(--color-warning)",
                                  borderRadius: 999,
                                  padding: "3px 10px",
                                  display: "inline-block",
                                }}
                              >
                                Vote
                              </Link>
                            </>
                          )}
                        </>
                      )}
                      {item.type === "drop" && (
                        <>
                          {memberByUserId[item.user_id]?.display_name?.trim() ?? memberByUserId[item.user_id]?.team_name?.trim() ?? "Unknown"} dropped {wrestlerNames[item.wrestler_id] ?? item.wrestler_id}
                        </>
                      )}
                      {item.type === "fa_add" && (
                        <>
                          {memberByUserId[item.user_id]?.display_name?.trim() ?? memberByUserId[item.user_id]?.team_name?.trim() ?? "Unknown"} added {wrestlerNames[item.wrestler_id] ?? item.wrestler_id}
                          {item.secondary_wrestler_id && (
                            <> (dropped {wrestlerNames[item.secondary_wrestler_id] ?? item.secondary_wrestler_id})</>
                          )}
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <p className="lm-activity-footer">
                <Link href={`/leagues/${slug}/proposals`}>See Full Recent Activity</Link>
              </p>
            </div>
          </div>

          {/* Teams / Standings (same look as standings page) + Rosters section */}
          <div className="lm-card">
            <p className="lm-league-meta" style={{ marginBottom: 12 }}>
              Click a team to see that owner’s roster and points.
            </p>
            <LeagueStandingsTable
              members={membersByPoints}
              pointsByUserId={pointsByUserId}
              leagueSlug={slug}
            />
            <RostersSection
              leagueId={league.id}
              leagueSlug={slug}
              members={members}
              rosters={rosters}
              wrestlers={wrestlersResult}
              isCommissioner={isCommissioner}
              rosterRules={rosterRules}
              teamCount={members.length}
            />
          </div>
        </div>
      </div>
    </main>
    </>
    );
  } catch {
    return fallback;
  }
}
