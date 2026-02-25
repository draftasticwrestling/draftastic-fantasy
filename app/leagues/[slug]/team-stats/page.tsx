import UnderConstruction from "@/app/components/UnderConstruction";

export const metadata = {
  title: "Team Stats — Draftastic Fantasy",
  description: "Team statistics",
};

export default async function TeamStatsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <UnderConstruction title="Team Stats" leagueSlug={slug} />;
}
