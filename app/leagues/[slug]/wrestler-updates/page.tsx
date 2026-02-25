import UnderConstruction from "@/app/components/UnderConstruction";

export const metadata = {
  title: "Wrestler Updates — Draftastic Fantasy",
  description: "Wrestler news and updates",
};

export default async function WrestlerUpdatesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <UnderConstruction title="Wrestler Updates" leagueSlug={slug} />;
}
