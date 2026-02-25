import UnderConstruction from "@/app/components/UnderConstruction";

export const metadata = {
  title: "Mock Draft — Draftastic Fantasy",
  description: "Practice draft",
};

export default async function MockDraftPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <UnderConstruction title="Mock Draft" leagueSlug={slug} />;
}
