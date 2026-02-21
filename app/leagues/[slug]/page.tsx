import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLeagueBySlug, getLeagueMembers, getRostersForLeague, getPointsByOwnerForLeague } from "@/lib/leagues";
import { getRosterRulesForLeague } from "@/lib/leagueStructure";
import { getSeasonBySlug } from "@/lib/leagueSeasons";
import { InviteButton } from "../InviteButton";
import { RostersSection } from "./RostersSection";

type Props = { params: Promise<{ slug: string }> };

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

export default async function LeagueDetailPage({ params }: Props) {
  let slug: string;
  try {
    const resolved = await params;
    slug = resolved.slug;
  } catch {
    return (
      <main style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 640, margin: "0 auto" }}>
        <p style={{ marginBottom: 24 }}>
          <Link href="/leagues" style={{ color: "#1a73e8", textDecoration: "none" }}>← My leagues</Link>
        </p>
        <h1 style={{ fontSize: "1.25rem", marginBottom: 16 }}>Something went wrong</h1>
        <Link href="/leagues" style={{ color: "#1a73e8", textDecoration: "none" }}>Back to My leagues</Link>
      </main>
    );
  }

  let league: Awaited<ReturnType<typeof getLeagueBySlug>>;
  let members: Awaited<ReturnType<typeof getLeagueMembers>> = [];
  let rosters: Awaited<ReturnType<typeof getRostersForLeague>> = {};
  let wrestlersResult: { id: string; name: string | null; gender: string | null }[] = [];

  const fallback = (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 640, margin: "0 auto" }}>
      <p style={{ marginBottom: 24 }}>
        <Link href="/leagues" style={{ color: "#1a73e8", textDecoration: "none" }}>← My leagues</Link>
      </p>
      <h1 style={{ fontSize: "1.25rem", marginBottom: 16 }}>Something went wrong</h1>
      <p style={{ color: "#666", marginBottom: 16 }}>
        We couldn’t load this league. You may need to sign in, or the league may not exist.
      </p>
      <Link href="/leagues" style={{ color: "#1a73e8", textDecoration: "none" }}>Back to My leagues</Link>
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
      getPointsByOwnerForLeague(league.id),
    ]);
    members = membersData;
    rosters = rostersData;
    wrestlersResult = wrestlersData;
    const pointsByUserId = pointsByOwner ?? {};

    const rosterRules = getRosterRulesForLeague(members.length);
    const membersByPoints = [...members].sort(
      (a, b) => (pointsByUserId[b.user_id] ?? 0) - (pointsByUserId[a.user_id] ?? 0)
    );

    return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: 24,
        maxWidth: 640,
        margin: "0 auto",
        fontSize: 16,
        lineHeight: 1.5,
      }}
    >
      <p style={{ marginBottom: 24 }}>
        <Link href="/leagues" style={{ color: "#1a73e8", textDecoration: "none" }}>
          ← My leagues
        </Link>
      </p>
      <h1 style={{ marginBottom: 8, fontSize: "1.5rem" }}>{league.name}</h1>
      {(league.start_date || league.end_date) && (
        <p style={{ color: "#555", marginBottom: 8 }}>
          {league.start_date && league.end_date
            ? `${league.start_date} – ${league.end_date}`
            : league.start_date || league.end_date}
        </p>
      )}
      {league.season_slug && (
        <p style={{ color: "#555", marginBottom: 8, fontSize: 14 }}>
          Season: {getSeasonBySlug(league.season_slug)?.name ?? league.season_slug}
          {league.draft_date && ` · Draft: ${league.draft_date} (points from first event after draft)`}
        </p>
      )}
      <p style={{ marginBottom: 16, fontSize: 14, color: "#666" }}>
        {league.role === "commissioner" ? "You are the commissioner." : "Member."}
        {" "}
        {currentUser && (
          <Link href={`/leagues/${slug}/team/${encodeURIComponent(currentUser.id)}`} style={{ color: "#1a73e8" }}>
            My team →
          </Link>
        )}
        {!currentUser && (
          <Link href={`/leagues/${slug}/team`} style={{ color: "#1a73e8" }}>
            My team →
          </Link>
        )}
      </p>

      {league.role === "commissioner" && (
        <div style={{ marginBottom: 24, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <InviteButton leagueId={league.id} leagueName={league.name} />
          <Link
            href={`/leagues/${slug}/proposals`}
            style={{
              padding: "8px 16px",
              background: "#333",
              color: "#fff",
              textDecoration: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Pending proposals
          </Link>
        </div>
      )}

      <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>Teams</h2>
      <p style={{ fontSize: 14, color: "#666", marginBottom: 12 }}>
        Click a team to see that owner’s roster and points.
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, marginBottom: 24 }}>
        {membersByPoints.map((m) => {
          const teamLabel = (m.team_name?.trim() || m.display_name?.trim() || "Unknown").trim() || "Unknown";
          const pts = pointsByUserId[m.user_id] ?? 0;
          return (
            <li
              key={m.id}
              style={{
                padding: "10px 0",
                borderBottom: "1px solid #eee",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <Link
                href={`/leagues/${slug}/team/${encodeURIComponent(m.user_id)}`}
                style={{ color: "#1a73e8", textDecoration: "none", fontWeight: 500 }}
              >
                {teamLabel}
              </Link>
              <span style={{ fontWeight: 600, color: "#c00", flexShrink: 0 }}>
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
        isCommissioner={league.role === "commissioner"}
        rosterRules={rosterRules}
        teamCount={members.length}
      />
    </main>
    );
  } catch {
    return fallback;
  }
}
