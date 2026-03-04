import { notFound } from "next/navigation";
import { getLeagueBySlug, getLeagueMembers } from "@/lib/leagues";
import { getDraftPicksHistory } from "@/lib/leagueDraft";
import { getSeasonBySlug } from "@/lib/leagueSeasons";
import { DraftHistoryView } from "./DraftHistoryView";

export const metadata = {
  title: "Draft History — Draftastic Fantasy",
  description: "View draft results by year or season, full draft or by team.",
};

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

/**
 * Build label for the current league's draft for display in the year/season selector.
 * When we support multiple draft runs per league (e.g. league_draft_runs table), we'd list them here.
 */
function getCurrentDraftLabel(league: {
  season_slug?: string | null;
  start_date?: string | null;
  draft_date?: string | null;
  created_at?: string;
}): string {
  const year =
    league.start_date?.slice(0, 4) ||
    league.draft_date?.slice(0, 4) ||
    league.created_at?.slice(0, 4) ||
    new Date().getFullYear().toString();
  const season = league.season_slug ? getSeasonBySlug(league.season_slug) : null;
  if (season) return `${year} ${season.name}`;
  return year;
}

export default async function DraftHistoryPage({ params }: Props) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const [members, picks] = await Promise.all([
    getLeagueMembers(league.id),
    getDraftPicksHistory(league.id),
  ]);

  const draftLabel = getCurrentDraftLabel(league);
  const draftId = "current";
  const draftOptions = [{ id: draftId, label: draftLabel }];

  const memberRows = members.map((m) => ({
    user_id: m.user_id,
    display_name: m.display_name ?? null,
    team_name: m.team_name ?? null,
  }));

  return (
    <main className="app-page" style={{ padding: "2rem 1rem" }}>
      <DraftHistoryView
        leagueSlug={slug}
        leagueName={league.name}
        draftOptions={draftOptions}
        picks={picks}
        members={memberRows}
      />
    </main>
  );
}
