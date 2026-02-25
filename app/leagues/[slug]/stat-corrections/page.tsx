import UnderConstruction from "@/app/components/UnderConstruction";

export const metadata = {
  title: "Stat Corrections — Draftastic Fantasy",
  description: "Request or view stat corrections",
};

export default async function StatCorrectionsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <UnderConstruction title="Stat Corrections" leagueSlug={slug} />;
}
