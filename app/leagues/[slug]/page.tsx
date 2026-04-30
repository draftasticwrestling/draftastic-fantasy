import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import { getLeagueBySlug, getLeagueMembers, getRostersForLeague } from "@/lib/leagues";
import { getIsSiteAdmin } from "@/lib/auth/siteAdmin";
import {
  getPointsByOwnerForLeagueWithBonuses,
} from "@/lib/leagueMatchups";
import { getRosterRulesForLeague, ROAD_TO_SUMMERSLAM_SEASON_SLUG } from "@/lib/leagueStructure";
import { pleDefaultHref } from "@/lib/pleLeagueMenu";
import { getSeasonBySlug } from "@/lib/leagueSeasons";
import { getTradeProposalsForLeague, getLeagueRosterActivity, processTradeTimerDeadlines } from "@/lib/leagueOwner";
import { formatRecipientRosterCutsLine } from "@/lib/tradeDisplay";
import { InviteSuccessModalTrigger } from "../InviteSuccessModalTrigger";
import { LeagueStandingsTable } from "./LeagueStandingsTable";
import { LeagueHomeMobileLeagueView } from "./LeagueHomeMobileLeagueView";
import { TradeProposalRespond } from "./team/TradeProposalRespond";
import SeasonTimelineRail from "@/app/components/SeasonTimelineRail";
import { ManagerAvatar } from "@/app/components/ManagerAvatar";
import { MyFactionAvatarEditor } from "./MyFactionAvatarEditor";
import { MyFactionCatchphraseBlock } from "./MyFactionCatchphraseBlock";
import { resolvedManagerAvatarUrl } from "@/lib/managerAvatarBucket";
import { factionDisplayName, truncateFactionDisplay } from "@/lib/factionName";
import { getLeagueEventDayViewerSection } from "@/lib/league/getLeagueEventDayViewerSection";
import { LeagueEventDayRosterCard } from "./LeagueEventDayRosterCard";
import { isPastEndOfDayPst } from "@/lib/pstCivilTime";
import SeasonCompletePlacementModal from "./SeasonCompletePlacementModal";
import { AdminOwnerPerspectiveSwitcher } from "./AdminOwnerPerspectiveSwitcher";

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

const supabaseOrigin =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ??
  "https://qvbqxietcmweltxoonvh.supabase.co";
const ROAD_TO_SUMMERSLAM_BANNER_URL = `${supabaseOrigin}/storage/v1/object/public/Banners/Road%20to%20SummerSlam.png`;

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
  let wrestlersResult: { id: string; name: string | null; gender: string | null; image_url: string | null }[] = [];

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

    const { supabase, user: currentUser } = await getServerAuth();

    const [membersData, rostersData, wrestlersData, pointsByOwner, isSiteAdminViewer] = await Promise.all([
      getLeagueMembers(league.id),
      getRostersForLeague(league.id),
      (async () => {
        // Column is "Status" (capital S) in DB; avoid .or("status...")
        const result = await supabase
          .from("wrestlers")
          .select("id, name, gender, image_url")
          .order("name", { ascending: true });
        return (result.data ?? []) as {
          id: string;
          name: string | null;
          gender: string | null;
          image_url: string | null;
        }[];
      })(),
      getPointsByOwnerForLeagueWithBonuses(league.id),
      getIsSiteAdmin(),
    ]);
    members = membersData;
    rosters = rostersData;
    wrestlersResult = wrestlersData;
    const pointsByUserId = pointsByOwner ?? {};

    const rosterRules = getRosterRulesForLeague(members.length, league.season_slug ?? null);
    const membersByPoints = [...members].sort(
      (a, b) => (pointsByUserId[b.user_id] ?? 0) - (pointsByUserId[a.user_id] ?? 0)
    );
    const seasonSubtitle =
      (league.season_slug && (getSeasonBySlug(league.season_slug)?.name ?? league.season_slug)) || null;

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
    // Internal-admin preview path can load a league even when viewer is not a member.
    // In that case, force-enable owner POV tools for support review.
    const showAdminOwnerPerspectiveTools = isSiteAdminViewer || !currentUserMember;
    const commissionerMember = members.find((m) => m.role === "commissioner");
    const creatorLabel = factionDisplayName(commissionerMember, "GM");
    const maxTeams = league.max_teams ?? 12;
    const leagueNotFull = members.length < maxTeams;
    const showAlert = isCommissioner && leagueNotFull;
    const showPrepareForDraft = (league.draft_status ?? "not_started") === "not_started";

    const myTeamName = factionDisplayName(currentUserMember, "My Faction");
    const myManagerName = truncateFactionDisplay(
      currentUserMember?.display_name?.trim() || "Manager"
    );
    const pendingTradesForMe = currentUser
      ? tradeProposals.filter((p) => p.status === "pending" && p.to_user_id === currentUser.id)
      : [];

    const seasonEndYmd = (league.end_date ?? "").slice(0, 10);
    const seasonComplete = Boolean(seasonEndYmd && isPastEndOfDayPst(seasonEndYmd));
    const currentPlacement = currentUser
      ? Math.max(1, membersByPoints.findIndex((m) => m.user_id === currentUser.id) + 1)
      : 0;
    const showSeasonCompleteModal = Boolean(
      currentUser &&
        seasonComplete &&
        currentPlacement > 0 &&
        membersByPoints.length > 0
    );

    const eventDaySection =
      currentUserMember && currentUser
        ? await getLeagueEventDayViewerSection(supabase, league, currentUser.id, rosters, wrestlersResult)
        : null;

    return (
    <>
    <main className="lm-dashboard lm-league-home">
      {showSeasonCompleteModal ? (
        <SeasonCompletePlacementModal
          leagueSlug={slug}
          seasonEndYmd={seasonEndYmd}
          placement={currentPlacement}
          totalMembers={membersByPoints.length}
        />
      ) : null}
      <Link href="/leagues" className="lm-dashboard-back lm-league-home-back">← My leagues</Link>

      <LeagueHomeMobileLeagueView
        leagueSlug={slug}
        leagueName={league.name}
        seasonSubtitle={seasonSubtitle}
        seasonSlug={league.season_slug ?? null}
        isCommissioner={isCommissioner}
        members={membersByPoints}
        pointsByUserId={pointsByUserId}
        currentUserId={currentUser?.id ?? null}
      />

      <div className="lm-league-page-desktop">
      <div className="lm-layout">
        {/* Left sidebar: My Faction + Quick Links */}
        <aside className="lm-sidebar">
          <div className="lm-card lm-card--my-faction">
            <h2 className="lm-card-title">My Faction</h2>
            {currentUser && currentUserMember ? (
              <MyFactionAvatarEditor
                leagueSlug={slug}
                initialLeagueAvatarUrl={currentUserMember.manager_avatar_url ?? null}
                initialProfileAvatarUrl={currentUserMember.avatar_url ?? null}
                fallbackLetter={
                  (factionDisplayName(currentUserMember, "M").trim().charAt(0) || "?").toUpperCase()
                }
              />
            ) : (
              <div
                className={`lm-myteam-avatar${
                  currentUserMember && resolvedManagerAvatarUrl(currentUserMember)?.trim()
                    ? " lm-myteam-avatar--image"
                    : ""
                }`}
                aria-hidden
              >
                <ManagerAvatar
                  avatarUrl={currentUserMember ? resolvedManagerAvatarUrl(currentUserMember) : null}
                  fallbackLetter={
                    (factionDisplayName(currentUserMember, "M").trim().charAt(0) || "?").toUpperCase()
                  }
                  size={168}
                  radius="var(--radius)"
                  alt=""
                  variant="sidebar"
                />
              </div>
            )}
            <p className="lm-myteam-name">{myTeamName}</p>
            <p className="lm-myteam-manager">{myManagerName}</p>
            {currentUser && currentUserMember ? (
              <MyFactionCatchphraseBlock
                leagueSlug={slug}
                initialCatchphrase={currentUserMember.manager_catchphrase?.trim() ?? ""}
              />
            ) : null}
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
          <div className="lm-card lm-card--quick-links">
            <h2 className="lm-card-title">Quick Links</h2>
            <ul className="lm-quick-links">
              <li><Link href="/how-it-works"><span className="lm-quick-link-icon">☰</span> Rules</Link></li>
              <li>
                <Link href={pleDefaultHref(slug, league.season_slug ?? null)}>
                  <span className="lm-quick-link-icon">🏟</span>{" "}
                  {(league.season_slug ?? null) === ROAD_TO_SUMMERSLAM_SEASON_SLUG ? "PLEs" : "Next PLE"}
                </Link>
              </li>
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
              <Link href={currentUser ? `/leagues/${slug}/team/${encodeURIComponent(currentUser.id)}` : `/leagues/${slug}/team`}>My Faction</Link>
              <span className="lm-subnav-sep">|</span>
              <Link href={`/leagues/${slug}/standings`}>Standings</Link>
              <span className="lm-subnav-sep">|</span>
              <Link href={pleDefaultHref(slug, league.season_slug ?? null)}>
                {(league.season_slug ?? null) === ROAD_TO_SUMMERSLAM_SEASON_SLUG ? "PLEs" : "Next PLE"}
              </Link>
              <span className="lm-subnav-sep">|</span>
              <Link href={`/leagues/${slug}/draft`}>Draft</Link>
            </nav>
            <p className="lm-league-meta">
              <span>GM: {creatorLabel}</span>
              <span>Format: {formatLeagueType(league.league_type)}</span>
              <span>Factions: {members.length}{maxTeams ? ` / ${maxTeams}` : ""}</span>
            </p>
            {showAdminOwnerPerspectiveTools ? (
              <AdminOwnerPerspectiveSwitcher
                leagueSlug={slug}
                members={members.map((m) => ({
                  user_id: m.user_id,
                  display_name: m.display_name ?? null,
                  team_name: m.team_name ?? null,
                  role: m.role,
                }))}
              />
            ) : null}
            {showAlert && (
              <div className="lm-alert" role="alert">
                {leagueNotFull ? "Your league is not full." : null}
              </div>
            )}
            {isCommissioner && (
              <div className="lm-actions">
                <InviteSuccessModalTrigger
                  show={showInviteModal}
                  leagueId={league.id}
                  leagueName={league.name}
                  leagueSlug={slug}
                  joinCode={league.join_code ?? null}
                  showInviteButton
                />
                {showPrepareForDraft && (
                  <Link href={`/leagues/${slug}/draft`} className="lm-btn-secondary">
                    Prepare for your draft
                  </Link>
                )}
                <Link href={`/leagues/${slug}/proposals`} className="lm-btn-secondary">
                  Pending proposals
                </Link>
              </div>
            )}
            {!isCommissioner && showPrepareForDraft && (
              <div className="lm-actions">
                <Link href={`/leagues/${slug}/draft`} className="lm-btn-secondary">
                  Prepare for your draft
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

          {eventDaySection ? (
            <LeagueEventDayRosterCard
              todayLabelEt={eventDaySection.todayLabelEt}
              items={eventDaySection.items}
              wrestlerRows={eventDaySection.wrestlerRows}
            />
          ) : null}

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
                        {factionDisplayName(memberByUserId[p.from_user_id], "Unknown")}{" "}
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

          {/* Standings */}
          <div className="lm-card">
            <p className="lm-league-meta" style={{ marginBottom: 12 }}>
              Click a faction to see that manager’s roster and points.
            </p>
            <LeagueStandingsTable
              members={membersByPoints}
              pointsByUserId={pointsByUserId}
              leagueSlug={slug}
            />
          </div>

          {/* Two-column: GM Note + Recent Activity */}
          <div className="lm-main-grid">
            <div className="lm-card">
              <h2 className="lm-card-title">
                GM&apos;s Note
                {isCommissioner && <Link href={`/leagues/${slug}/lm-note`} className="lm-card-link">Edit GM Note</Link>}
              </h2>
              <p className="lm-note-text">
                {league?.manager_note?.trim() || "Welcome to your Draftastic Fantasy league. Your GM can post a note to the entire league and it will appear here."}
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
                          {factionDisplayName(memberByUserId[item.from_user_id], "Unknown")} ↔ {factionDisplayName(memberByUserId[item.to_user_id], "Unknown")}:{" "}
                          {item.items.filter((i) => i.direction === "give").map((i) => wrestlerNames[i.wrestler_id] ?? i.wrestler_id).join(", ")}
                          {" for "}
                          {item.items.filter((i) => i.direction === "receive").map((i) => wrestlerNames[i.wrestler_id] ?? i.wrestler_id).join(", ")}
                          {(() => {
                            const dropIds = (item.to_user_drop_ids ?? []).map((x) => String(x).trim()).filter(Boolean);
                            const toName = factionDisplayName(memberByUserId[item.to_user_id], "Recipient");
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
                          {factionDisplayName(memberByUserId[item.user_id], "Unknown")} dropped {wrestlerNames[item.wrestler_id] ?? item.wrestler_id}
                        </>
                      )}
                      {item.type === "fa_add" && (
                        <>
                          {factionDisplayName(memberByUserId[item.user_id], "Unknown")} added {wrestlerNames[item.wrestler_id] ?? item.wrestler_id}
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

        </div>

        <aside className="lm-season-rail" aria-label="League season timeline">
          {league.season_slug === "road-to-summerslam" && (
            <div className="lm-season-rail-banner">
              <Image
                src={ROAD_TO_SUMMERSLAM_BANNER_URL}
                alt="Road to SummerSlam"
                width={560}
                height={120}
                className="lm-season-rail-banner-img"
                sizes="(max-width: 900px) 100vw, 280px"
              />
            </div>
          )}
          <SeasonTimelineRail leagueSlug={slug} />
        </aside>
      </div>
      </div>
    </main>
    </>
    );
  } catch {
    return fallback;
  }
}
