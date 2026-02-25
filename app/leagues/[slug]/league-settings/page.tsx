import UnderConstruction from "@/app/components/UnderConstruction";

export const metadata = {
  title: "League Settings — Draftastic Fantasy",
  description: "League configuration",
};

export default async function LeagueSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <UnderConstruction title="League Settings" leagueSlug={slug} />;
}
