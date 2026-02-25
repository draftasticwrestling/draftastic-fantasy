import UnderConstruction from "@/app/components/UnderConstruction";

export const metadata = {
  title: "Standings — Draftastic Fantasy",
  description: "League standings",
};

export default async function StandingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <UnderConstruction title="Standings" leagueSlug={slug} />;
}
