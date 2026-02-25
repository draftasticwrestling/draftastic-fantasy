import UnderConstruction from "@/app/components/UnderConstruction";

export const metadata = {
  title: "Watchlist — Draftastic Fantasy",
  description: "Wrestler watchlist",
};

export default async function WatchlistPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <UnderConstruction title="Watchlist" leagueSlug={slug} />;
}
