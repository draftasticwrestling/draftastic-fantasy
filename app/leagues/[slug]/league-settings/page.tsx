import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeagueBySlug, getLeagueMembers } from "@/lib/leagues";
import { BasicSettingsSection } from "./BasicSettingsSection";
import { DraftSettingsSection } from "./DraftSettingsSection";
import { LeagueTypeSection } from "./LeagueTypeSection";
import { RemoveOwnerSection } from "./RemoveOwnerSection";
import { DeleteLeagueSection } from "./DeleteLeagueSection";

export const metadata = {
  title: "League Settings — Draftastic Fantasy",
  description: "League configuration and draft settings",
};

export const dynamic = "force-dynamic";

export default async function LeagueSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const isCommissioner = league.role === "commissioner";
  const members = isCommissioner ? await getLeagueMembers(league.id) : [];

  const draftType = league.draft_type ?? (league.draft_style as "snake" | "linear" | undefined) ?? "autopick";
  const draftTypeLabel =
    draftType === "offline"
      ? "Offline"
      : draftType === "autopick"
        ? "Autopick"
        : draftType === "linear" || draftType === "snake"
          ? "Autopick (legacy)"
          : String(draftType);
  const leagueType = league.league_type ?? null;
  const maxTeams = league.max_teams ?? null;
  const autoReactivate = league.auto_reactivate ?? false;

  return (
    <main className="app-page" style={{ maxWidth: 720, margin: "0 auto" }}>
      <p style={{ marginBottom: 24 }}>
        <Link href={`/leagues/${slug}`} className="app-link" style={{ fontWeight: 600 }}>
          ← {league.name}
        </Link>
      </p>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 8 }}>League Settings</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 32 }}>
        Configure your league. Only the GM can change these settings.
      </p>

      {isCommissioner ? (
        <>
          <BasicSettingsSection
            key={`basic-${slug}-${maxTeams ?? ""}-${league.name}-${autoReactivate}`}
            leagueSlug={slug}
            leagueName={league.name}
            maxTeams={maxTeams}
            autoReactivate={autoReactivate}
          />
          <LeagueTypeSection leagueSlug={slug} leagueType={leagueType} />
          <DraftSettingsSection leagueSlug={slug} draftType={draftType} />
          {(league.draft_status !== "in_progress" &&
            league.draft_status !== "completed" &&
            league.draft_status !== "ready_for_review") && (
            <RemoveOwnerSection leagueSlug={slug} members={members} />
          )}
          <DeleteLeagueSection leagueSlug={slug} leagueName={league.name} />
        </>
      ) : (
        <>
          <section aria-labelledby="basic-settings-heading" style={{ marginBottom: 32 }}>
            <h2 id="basic-settings-heading" style={{ fontSize: "1.25rem", marginBottom: 12 }}>
              Basic Settings
            </h2>
            <p style={{ color: "var(--color-text-muted)" }}>
              League: <strong>{league.name}</strong>. Factions: {maxTeams ?? "—"}. Auto-reactivate: {autoReactivate ? "Yes" : "No"}.
            </p>
          </section>
          <section aria-labelledby="league-type-heading" style={{ marginBottom: 32 }}>
            <h2 id="league-type-heading" style={{ fontSize: "1.25rem", marginBottom: 12 }}>
              League Type
            </h2>
            <p style={{ color: "var(--color-text-muted)" }}>
              {leagueType === "season_overall" ? "Total Season Points" : leagueType === "head_to_head" ? "Head to Head Points" : leagueType ?? "—"}
            </p>
          </section>
          <section aria-labelledby="draft-settings-heading" style={{ marginBottom: 32 }}>
            <h2 id="draft-settings-heading" style={{ fontSize: "1.25rem", marginBottom: 12 }}>
              Draft
            </h2>
            <p style={{ color: "var(--color-text-muted)" }}>
              Only the GM can change draft settings. Current draft type: <strong>{draftTypeLabel}</strong>. On-site autopick uses snake
              pick order; the GM randomizes round-1 order once on the Draft tab before the beta draft window.
            </p>
          </section>
        </>
      )}
    </main>
  );
}
