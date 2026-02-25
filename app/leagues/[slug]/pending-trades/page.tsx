import UnderConstruction from "@/app/components/UnderConstruction";

export const metadata = {
  title: "Pending Trades — Draftastic Fantasy",
  description: "Review and approve pending trades",
};

export default async function PendingTradesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <UnderConstruction title="Pending Trades" leagueSlug={slug} />;
}
