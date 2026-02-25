import UnderConstruction from "@/app/components/UnderConstruction";

export const metadata = {
  title: "Manage Rosters — Draftastic Fantasy",
  description: "General Manager roster management",
};

export default async function ManageRostersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <UnderConstruction title="Manage Rosters" leagueSlug={slug} />;
}
