import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeagueBySlug, getLeagueMembers } from "@/lib/leagues";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import { EditTeamNameForm } from "../team/EditTeamNameForm";
import { EditManagerCatchphraseForm } from "../team/EditManagerCatchphraseForm";
import { LeagueManagerAvatarField } from "../team/LeagueManagerAvatarField";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) return { title: "Edit Faction Info — Draftastic Fantasy" };
  return {
    title: `Edit Faction Info — ${league.name} — Draftastic Fantasy`,
    description: "Edit your faction details",
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
  const { user } = await getServerAuth();
  if (!user) notFound();

  const member = members.find((m) => m.user_id === user.id);
  if (!member) notFound();

  const currentTeamName = member.team_name?.trim() ?? "";
  const currentCatchphrase = member.manager_catchphrase?.trim() ?? "";

  return (
    <main className="app-page" style={{ paddingTop: 10 }}>
      <p style={{ marginBottom: 14 }}>
        <Link href={`/leagues/${slug}`} className="app-link">
          ← League
        </Link>
      </p>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 8, color: "var(--color-text)" }}>
        Edit Faction Info
      </h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 24 }}>
        Set your faction name for this league (up to 25 characters). It appears in standings, matchups, and on your roster.
        If you skip a custom name, we show your profile name (shortened if it&apos;s very long). You can set a
        league-specific manager photo and catchphrase below; otherwise we use your default from{" "}
        <Link href="/account" className="app-link">
          Account
        </Link>{" "}
        for your photo.
      </p>
      <LeagueManagerAvatarField
        leagueSlug={slug}
        initialLeagueAvatarUrl={member.manager_avatar_url ?? null}
        initialProfileAvatarUrl={member.avatar_url ?? null}
        displayNameForInitial={member.display_name ?? ""}
      />
      <EditTeamNameForm leagueSlug={slug} initialTeamName={currentTeamName} />
      <EditManagerCatchphraseForm leagueSlug={slug} initialCatchphrase={currentCatchphrase} />

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
