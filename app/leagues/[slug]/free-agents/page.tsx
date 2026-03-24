import { redirect } from "next/navigation";

type Props = { params: Promise<{ slug: string }> };

/**
 * My Faction → Free Agents redirects to Wrestlers → Free Agents (same data and table).
 */
export default async function LeagueFreeAgentsRedirectPage({ params }: Props) {
  const { slug } = await params;
  redirect(`/leagues/${slug}/wrestlers/free-agents`);
}
