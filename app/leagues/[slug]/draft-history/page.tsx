import UnderConstruction from "@/app/components/UnderConstruction";

export const metadata = {
  title: "Draft History — Draftastic Fantasy",
  description: "Past draft results",
};

export default async function DraftHistoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <UnderConstruction title="Draft History" leagueSlug={slug} />;
}
