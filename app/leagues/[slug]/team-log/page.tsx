import UnderConstruction from "@/app/components/UnderConstruction";

export const metadata = {
  title: "Team Log — Draftastic Fantasy",
  description: "Team activity log",
};

export default async function TeamLogPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <UnderConstruction title="Team Log" leagueSlug={slug} />;
}
