import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeagueBySlug } from "@/lib/leagues";
import { BasicSettingsSection } from "./BasicSettingsSection";
import { DraftSettingsSection } from "./DraftSettingsSection";
import { LeagueTypeSection } from "./LeagueTypeSection";
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

  const draftType = league.draft_type ?? (league.draft_style as "snake" | "linear" | undefined) ?? "snake";
  const timePerPickSeconds = league.time_per_pick_seconds ?? 120;
  const draftOrderMethod = league.draft_order_method ?? "random_one_hour_before";
  const draftDate = league.draft_date ?? null;
  const leagueType = league.league_type ?? null;
  const maxTeams = league.max_teams ?? null;
  const autoReactivate = league.auto_reactivate ?? false;
  const isCommissioner = league.role === "commissioner";

  return (
    <main className="app-page" style={{ maxWidth: 720, margin: "0 auto" }}>
      <p style={{ marginBottom: 24 }}>
        <Link href={`/leagues/${slug}`} className="app-link" style={{ fontWeight: 600 }}>
          ← {league.name}
        </Link>
      </p>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 8 }}>League Settings</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 32 }}>
        Configure your league. Only the commissioner can change these settings.
      </p>

      {isCommissioner ? (
        <>
          <BasicSettingsSection
            leagueSlug={slug}
            leagueName={league.name}
            maxTeams={maxTeams}
            autoReactivate={autoReactivate}
          />
          <LeagueTypeSection leagueSlug={slug} leagueType={leagueType} />
          <DraftSettingsSection
            leagueSlug={slug}
            draftType={draftType}
            timePerPickSeconds={timePerPickSeconds}
            draftOrderMethod={draftOrderMethod}
            draftDate={draftDate}
          />
          <DeleteLeagueSection leagueSlug={slug} leagueName={league.name} />
        </>
      ) : (
        <>
          <section aria-labelledby="basic-settings-heading" style={{ marginBottom: 32 }}>
            <h2 id="basic-settings-heading" style={{ fontSize: "1.25rem", marginBottom: 12 }}>
              Basic Settings
            </h2>
            <p style={{ color: "var(--color-text-muted)" }}>
              League: <strong>{league.name}</strong>. Teams: {maxTeams ?? "—"}. Auto-reactivate: {autoReactivate ? "Yes" : "No"}.
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
              Only the league commissioner can change draft settings. Current settings:{" "}
              <strong>{draftType}</strong> draft, {timePerPickSeconds === 60 ? "1 minute" : `${timePerPickSeconds} seconds`} per pick,
              {draftOrderMethod === "manual_by_gm" ? " order set by General Manager" : " order randomized one hour before draft"}.
              {draftDate && ` Draft date: ${draftDate}.`}
            </p>
          </section>
        </>
      )}
    </main>
  );
}
