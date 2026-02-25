import UnderConstruction from "@/app/components/UnderConstruction";

export const metadata = {
  title: "Edit Team Info — Draftastic Fantasy",
  description: "Edit your team details",
};

export default async function EditTeamInfoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <UnderConstruction title="Edit Team Info" leagueSlug={slug} />;
}
