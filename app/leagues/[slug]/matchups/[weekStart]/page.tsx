import { notFound, redirect } from "next/navigation";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import { getLeagueBySlug, getLeagueMembers } from "@/lib/leagues";

type Props = { params: Promise<{ slug: string; weekStart: string }> };

export const dynamic = "force-dynamic";

/** Old deep links `/matchups/[week]` → canonical scoreboard with week selected. */
export default async function LeagueMatchupWeekRedirect({ params }: Props) {
  const { slug, weekStart } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const { user } = await getServerAuth();
  const members = await getLeagueMembers(league.id);
  const isMember = user && members.some((m) => m.user_id === user.id);
  if (!isMember) notFound();

  const weekStartDecoded = decodeURIComponent(weekStart);
  redirect(`/leagues/${slug}/matchups?week=${encodeURIComponent(weekStartDecoded)}`);
}
