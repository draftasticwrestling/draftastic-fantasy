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
    </main>
  );
}
