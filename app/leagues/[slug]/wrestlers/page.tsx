import { redirect } from "next/navigation";

export default async function WrestlersIndexPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/leagues/${slug}/wrestlers/league-leaders`);
}
