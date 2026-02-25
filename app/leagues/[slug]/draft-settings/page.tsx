import UnderConstruction from "@/app/components/UnderConstruction";

export const metadata = {
  title: "Draft Settings — Draftastic Fantasy",
  description: "Draft configuration",
};

export default async function DraftSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <UnderConstruction title="Draft Settings" leagueSlug={slug} />;
}
