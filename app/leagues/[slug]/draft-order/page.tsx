import UnderConstruction from "@/app/components/UnderConstruction";

export const metadata = {
  title: "Draft Order — Draftastic Fantasy",
  description: "Draft order and pick sequence",
};

export default async function DraftOrderPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <UnderConstruction title="Draft Order" leagueSlug={slug} />;
}
