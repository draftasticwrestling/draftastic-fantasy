import UnderConstruction from "@/app/components/UnderConstruction";

export const metadata = {
  title: "Notify League — Draftastic Fantasy",
  description: "Send announcements to league members",
};

export default async function NotifyLeaguePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <UnderConstruction title="Notify League" leagueSlug={slug} />;
}
