import { notFound, redirect } from "next/navigation";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import { getLeagueBySlug, getLeagueMembers } from "@/lib/leagues";
import { leagueUsesSalaryCap } from "@/lib/leagueStructure";
import { isSalaryCapRosterSetupComplete } from "@/lib/leagueOnboarding";
import { recordEngagementEvent } from "@/lib/engagementEvents";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  try {
    const { slug } = await params;
    const league = await getLeagueBySlug(slug);
    if (!league) return { title: "Faction — Draftastic Fantasy" };
    return {
      title: `Faction — ${league.name} — Draftastic Fantasy`,
      description: `Your roster in ${league.name}`,
    };
  } catch {
    return { title: "Faction — Draftastic Fantasy" };
  }
}

export default async function LeagueFactionSimpleEntryPage({ params }: Props) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const { user, supabase } = await getServerAuth();
  if (!user) notFound();

  const members = await getLeagueMembers(league.id);
  const isMember = members.some((m) => m.user_id === user.id);
  if (!isMember) notFound();

  if (leagueUsesSalaryCap(league.league_type)) {
    const setupComplete = await isSalaryCapRosterSetupComplete(supabase, league.id, user.id);
    if (!setupComplete) {
      redirect(`/leagues/${slug}/salary-cap`);
    }
  }

  await recordEngagementEvent({
    eventName: "page.my_faction_view",
    userId: user.id,
    leagueId: league.id,
    seasonSlug: league.season_slug ?? null,
    path: `/leagues/${slug}/faction`,
  });

  redirect(`/leagues/${slug}/team/${encodeURIComponent(user.id)}?view=simple`);
}
