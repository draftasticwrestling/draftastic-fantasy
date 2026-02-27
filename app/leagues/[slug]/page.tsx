import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLeagueBySlug, getLeagueMembers, getRostersForLeague } from "@/lib/leagues";
import { getPointsByOwnerForLeagueWithBonuses } from "@/lib/leagueMatchups";
import { getRosterRulesForLeague } from "@/lib/leagueStructure";
import { getSeasonBySlug } from "@/lib/leagueSeasons";
import { InviteSuccessModalTrigger } from "../InviteSuccessModalTrigger";
import { RostersSection } from "./RostersSection";

function formatLeagueType(type: string | null | undefined): string {
  if (!type) return "Standard";
  switch (type) {
    case "season_overall": return "Season Overall";
    case "head_to_head": return "Head-to-Head";
    case "combo": return "Combo (H2H + Overall)";
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

    const supabase = await createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    const [membersData, rostersData, wrestlersData, pointsByOwner] = await Promise.all([
      getLeagueMembers(league.id),
      getRostersForLeague(league.id),
      (async () => {
        const supabase = await createClient();
        const { data } = await supabase
          .from("wrestlers")
          .select("id, name, gender")
          .order("name", { ascending: true });
        return (data ?? []) as { id: string; name: string | null; gender: string | null }[];
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

    const isCommissioner = league.role === "commissioner";
    const currentUserMember = currentUser ? members.find((m) => m.user_id === currentUser.id) : null;
    const commissionerMember = members.find((m) => m.role === "commissioner");
    const creatorLabel = commissionerMember?.display_name?.trim() || commissionerMember?.team_name?.trim() || "Commissioner";
    const maxTeams = league.max_teams ?? 12;
    const leagueNotFull = members.length < maxTeams;
    const draftNotScheduled = !league.draft_status || league.draft_status === "not_started";
    const showAlert = isCommissioner && (leagueNotFull || draftNotScheduled);

    const myTeamName = (currentUserMember?.team_name?.trim() || currentUserMember?.display_name?.trim() || "My Team").trim() || "My Team";
    const myManagerName = currentUserMember?.display_name?.trim() || "Manager";

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
              <li><Link href={`/leagues/${slug}/draft`}><span className="lm-quick-link-icon">⚙</span> Draft</Link></li>
              <li><Link href={`/leagues/${slug}`}><span className="lm-quick-link-icon">👤</span> Wrestlers</Link></li>
              <li><Link href="/"><span className="lm-quick-link-icon">⌂</span> Home</Link></li>
            </ul>
          </div>
        </aside>

        <div className="lm-main">
          {/* Top card: League name, subnav, meta, alert, actions */}
          <div className="lm-card lm-league-card">
            <h1 className="lm-card-title" style={{ fontSize: "1.35rem", marginBottom: 8 }}>{league.name}</h1>
            <nav className="lm-subnav" aria-label="League sections">
              <Link href={`/leagues/${slug}`}>League</Link>
              <span className="lm-subnav-sep">|</span>
              <Link href={currentUser ? `/leagues/${slug}/team/${encodeURIComponent(currentUser.id)}` : `/leagues/${slug}/team`}>Roster</Link>
              <span className="lm-subnav-sep">|</span>
              <Link href={`/leagues/${slug}/matchups`}>Matchup</Link>
              <span className="lm-subnav-sep">|</span>
              <Link href={`/leagues/${slug}`}>Rosters</Link>
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
                {league.draft_date && ` · Draft: ${league.draft_date}`}
              </p>
            )}
          </div>

          {/* Two-column: League Manager Note + Recent Activity */}
          <div className="lm-main-grid">
            <div className="lm-card">
              <h2 className="lm-card-title">
                League Manager&apos;s Note
                {isCommissioner && <Link href={`/leagues/${slug}`} className="lm-card-link">Edit LM Note</Link>}
              </h2>
              <p className="lm-note-text">
                Welcome to your Draftastic Fantasy league. Your League Manager can post a note to the entire league and it will appear here.
              </p>
            </div>
            <div className="lm-card">
              <h2 className="lm-card-title">
                Recent Activity
                <Link href={`/leagues/${slug}/proposals`} className="lm-card-link">Proposals</Link>
              </h2>
              <p className="lm-activity-empty">No Recent Activity</p>
              <p className="lm-activity-footer">
                <Link href={`/leagues/${slug}/proposals`}>See Full Recent Activity</Link>
              </p>
            </div>
          </div>

          {/* Teams list + Rosters section (same as before) */}
          <div className="lm-card">
            <h2 className="lm-card-title">Teams</h2>
            <p className="lm-league-meta" style={{ marginBottom: 12 }}>
              Click a team to see that owner’s roster and points.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px", borderTop: "1px solid var(--color-border)" }}>
              {membersByPoints.map((m) => {
                const teamLabel = (m.team_name?.trim() || m.display_name?.trim() || "Unknown").trim() || "Unknown";
                const pts = pointsByUserId[m.user_id] ?? 0;
                return (
                  <li
                    key={m.id}
                    style={{
                      padding: "10px 0",
                      borderBottom: "1px solid var(--color-border-light)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 16,
                    }}
                  >
                    <Link
                      href={`/leagues/${slug}/team/${encodeURIComponent(m.user_id)}`}
                      style={{ color: "var(--color-blue)", textDecoration: "none", fontWeight: 500 }}
                    >
                      {teamLabel}
                    </Link>
                    <span style={{ fontWeight: 600, color: "var(--color-red)", flexShrink: 0 }}>
                      {pts} pts
                    </span>
                  </li>
                );
              })}
            </ul>
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
