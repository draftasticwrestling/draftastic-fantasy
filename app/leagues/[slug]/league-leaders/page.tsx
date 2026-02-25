import UnderConstruction from "@/app/components/UnderConstruction";

export const metadata = {
  title: "League Leaders — Draftastic Fantasy",
  description: "League leaderboards",
};

export default async function LeagueLeadersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <UnderConstruction title="League Leaders" leagueSlug={slug} />;
}
