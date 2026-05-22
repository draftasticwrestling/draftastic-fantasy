import Link from "next/link";
import { notFound } from "next/navigation";
import SeasonTimelineRail from "@/app/components/SeasonTimelineRail";
import { LeagueSeasonBeltBanner } from "@/app/components/LeagueSeasonBeltBanner";
import { getLeagueBySlug } from "@/lib/leagues";
import { getLeagueSeasonBelt, leagueIsSalaryCapFormat, ROAD_TO_SUMMERSLAM_SEASON_SLUG } from "@/lib/leagueStructure";

export const dynamic = "force-dynamic";

export default async function LeaguePathwayPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();
  const isRts = league.season_slug === ROAD_TO_SUMMERSLAM_SEASON_SLUG;
  const isSalaryCap = leagueIsSalaryCapFormat(league);
  if (!isRts && !isSalaryCap) notFound();

  const seasonBelt = getLeagueSeasonBelt(league);

  return (
    <main className="app-page" style={{ paddingTop: 10 }}>
      <p style={{ marginBottom: 12 }}>
        <Link href={`/leagues/${slug}`} className="app-link" style={{ fontWeight: 600 }}>
          ← League
        </Link>
      </p>

      {seasonBelt ? (
        <div
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: 18,
            overflow: "hidden",
            marginBottom: 12,
            background: "var(--color-bg-card)",
          }}
        >
          <LeagueSeasonBeltBanner belt={seasonBelt} variant="full" />
        </div>
      ) : null}

      <SeasonTimelineRail leagueSlug={slug} />
    </main>
  );
}
