import UnderConstruction from "@/app/components/UnderConstruction";

export const metadata = {
  title: "Injury Report — Draftastic Fantasy",
  description: "Wrestler injury status",
};

export default async function InjuryReportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <UnderConstruction title="Injury Report" leagueSlug={slug} />;
}
