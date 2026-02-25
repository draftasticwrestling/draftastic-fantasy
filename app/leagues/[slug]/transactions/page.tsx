import UnderConstruction from "@/app/components/UnderConstruction";

export const metadata = {
  title: "Transactions — Draftastic Fantasy",
  description: "League transactions",
};

export default async function TransactionsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <UnderConstruction title="Transactions" leagueSlug={slug} />;
}
