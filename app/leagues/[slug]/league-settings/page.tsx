import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeagueBySlug, getLeagueMembers } from "@/lib/leagues";
import { BasicSettingsSection } from "./BasicSettingsSection";
import { DraftSettingsSection } from "./DraftSettingsSection";
import { LeagueTypeSection } from "./LeagueTypeSection";
import { IncludeNxtSection } from "./IncludeNxtSection";
import { RemoveOwnerSection } from "./RemoveOwnerSection";
import { DeleteLeagueSection } from "./DeleteLeagueSection";
import { GmToolsNav } from "./GmToolsNav";
import { getIsSiteAdmin } from "@/lib/auth/siteAdmin";

const OFFLINE_DRAFT_SHEET_EXPORT_URL =
  "https://docs.google.com/spreadsheets/d/19v4VhgG0kYhHr1HGbAPb29flqIPxeNgY/export?format=xlsx";

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
  const isSiteAdmin = await getIsSiteAdmin();
  const includeNxt = Boolean((league as { include_nxt?: boolean | null }).include_nxt);
  const teamCountOptions = !isSiteAdmin
    ? [3, 4, 5, 6]
    : [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
  const members = isCommissioner ? await getLeagueMembers(league.id) : [];

  const draftType = league.draft_type ?? (league.draft_style as "snake" | "linear" | undefined) ?? "autopick";
  const isPublicLeague = String(league.visibility_type ?? "").toLowerCase() === "public";
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
    <main className="app-page" style={{ maxWidth: 720, margin: "0 auto", paddingTop: 10 }}>
      <p style={{ marginBottom: 14 }}>
        <Link href={`/leagues/${slug}`} className="app-link" style={{ fontWeight: 600 }}>
          ← League
        </Link>
      </p>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 8 }}>League Settings</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 32 }}>
        Configure your league. Only the GM can change these settings.
      </p>

      {isCommissioner ? (
        <>
          <GmToolsNav leagueSlug={slug} />
          <BasicSettingsSection
            key={`basic-${slug}-${maxTeams ?? ""}-${league.name}-${autoReactivate}`}
            leagueSlug={slug}
            leagueName={league.name}
            maxTeams={maxTeams}
            autoReactivate={autoReactivate}
            visibilityType={league.visibility_type}
            teamCountOptions={teamCountOptions}
          />
          <LeagueTypeSection leagueSlug={slug} leagueType={leagueType} isSiteAdmin={isSiteAdmin} />
          {isSiteAdmin && leagueType === "head_to_head" ? (
            <IncludeNxtSection
              key={`nxt-${slug}-${includeNxt ? "1" : "0"}`}
              leagueSlug={slug}
              includeNxt={includeNxt}
            />
          ) : null}
          <DraftSettingsSection leagueSlug={slug} draftType={draftType} isPublicLeague={isPublicLeague} />
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
            <p style={{ color: "var(--color-text-muted)", marginTop: 10 }}>
              Offline resources:{" "}
              <a href={OFFLINE_DRAFT_SHEET_EXPORT_URL} className="app-link">
                Download Offline Draft Tracker (Excel)
              </a>
              {" · "}
              <Link href="/how-it-works/offline-draft" className="app-link">
                Offline Draft How-To
              </Link>
            </p>
          </section>
        </>
      )}
    </main>
  );
}
