import UnderConstruction from "@/app/components/UnderConstruction";

export const metadata = {
  title: "Roster Changes — Draftastic Fantasy",
  description: "Roster change log",
};

export default async function RosterChangesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <UnderConstruction title="Roster Changes" leagueSlug={slug} />;
}
