import UnderConstruction from "@/app/components/UnderConstruction";

export const metadata = {
  title: "Wrestlers — Draftastic Fantasy",
  description: "Draft-eligible wrestlers for this league",
};

export default async function WrestlersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <UnderConstruction title="Wrestlers" leagueSlug={slug} />;
}
