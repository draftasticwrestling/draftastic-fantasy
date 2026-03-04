import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeagueBySlug, getLeagueMembers } from "@/lib/leagues";
import { EditTeamNameForm } from "../team/EditTeamNameForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) return { title: "Edit Team Info — Draftastic Fantasy" };
  return {
    title: `Edit Team Info — ${league.name} — Draftastic Fantasy`,
    description: "Edit your team details",
  };
}

export default async function EditTeamInfoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const members = await getLeagueMembers(league.id);
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const member = members.find((m) => m.user_id === user.id);
  if (!member) notFound();

  const currentTeamName = member.team_name?.trim() ?? "";

  return (
    <main className="app-page">
      <p style={{ marginBottom: 24 }}>
        <Link href={`/leagues/${slug}`} className="app-link">
          ← {league.name}
        </Link>
      </p>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 8, color: "var(--color-text)" }}>
        Edit Team Info
      </h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 24 }}>
        Choose a team name for this league. It will appear in standings, matchups, and on your roster.
      </p>
      <EditTeamNameForm leagueSlug={slug} initialTeamName={currentTeamName} />

      <section
        aria-labelledby="edit-team-auto-draft-heading"
        style={{
          marginTop: 24,
          padding: "16px 18px",
          background: "var(--color-bg-elevated)",
          borderRadius: "var(--radius)",
          border: "1px solid var(--color-border)",
        }}
      >
        <h2 id="edit-team-auto-draft-heading" style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 8, color: "var(--color-text)" }}>
          Auto-draft settings
        </h2>
        <p style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 12 }}>
          If the pick clock runs out, your pick is made automatically using your priority list and strategy.
        </p>
        <Link
          href={`/leagues/${slug}/draft/preferences`}
          className="app-link"
          style={{ fontWeight: 600 }}
        >
          Set or edit your auto-draft preferences →
        </Link>
      </section>
    </main>
  );
}
