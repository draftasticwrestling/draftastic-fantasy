import { notFound, redirect } from "next/navigation";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import { getLeagueBySlug, getLeagueMembers } from "@/lib/leagues";

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

  const { user } = await getServerAuth();
  if (!user) notFound();

  const members = await getLeagueMembers(league.id);
  const isMember = members.some((m) => m.user_id === user.id);
  if (!isMember) notFound();

  redirect(`/leagues/${slug}/team/${encodeURIComponent(user.id)}?view=simple`);
}
