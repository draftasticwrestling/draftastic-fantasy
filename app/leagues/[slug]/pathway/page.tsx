import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import SeasonTimelineRail from "@/app/components/SeasonTimelineRail";
import { getLeagueBySlug } from "@/lib/leagues";
import { ROAD_TO_SUMMERSLAM_SEASON_SLUG } from "@/lib/leagueStructure";

const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ROAD_TO_SUMMERSLAM_BANNER_URL = `${supabaseOrigin}/storage/v1/object/public/Banners/Road%20to%20SummerSlam.png`;

export const dynamic = "force-dynamic";

export default async function LeaguePathwayPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();
  if (league.season_slug !== ROAD_TO_SUMMERSLAM_SEASON_SLUG) notFound();

  return (
    <main className="app-page" style={{ paddingTop: 10 }}>
      <p style={{ marginBottom: 12 }}>
        <Link href={`/leagues/${slug}`} className="app-link" style={{ fontWeight: 600 }}>
          ← League
        </Link>
      </p>

      <div
        style={{
          border: "1px solid var(--color-border)",
          borderRadius: 18,
          overflow: "hidden",
          marginBottom: 12,
          background: "var(--color-bg-card)",
        }}
      >
        <Image
          src={ROAD_TO_SUMMERSLAM_BANNER_URL}
          alt="Road to SummerSlam"
          width={1120}
          height={240}
          sizes="100vw"
          style={{ display: "block", width: "100%", height: "auto" }}
        />
      </div>

      <SeasonTimelineRail leagueSlug={slug} />
    </main>
  );
}

