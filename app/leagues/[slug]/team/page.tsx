import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLeagueBySlug, getLeagueMembers } from "@/lib/leagues";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  try {
    const { slug } = await params;
    const league = await getLeagueBySlug(slug);
    if (!league) return { title: "My team — Draftastic Fantasy" };
    return {
      title: `My team — ${league.name} — Draftastic Fantasy`,
      description: `Your roster, lineup, and proposals for ${league.name}`,
    };
  } catch {
    return { title: "My team — Draftastic Fantasy" };
  }
}

type SearchParams = Promise<{ proposeTradeTo?: string; addFa?: string }>;

export default async function TeamPage({
  params,
  searchParams,
}: {
  params: Props["params"];
  searchParams?: SearchParams;
}) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const members = await getLeagueMembers(league.id);
  const isMember = members.some((m) => m.user_id === user.id);
  if (!isMember) notFound();

  const sp = searchParams ? await searchParams : {};
  const proposeTradeTo = typeof sp.proposeTradeTo === "string" ? sp.proposeTradeTo.trim() : undefined;
  const addFa = typeof sp.addFa === "string" ? sp.addFa.trim() : undefined;
  const base = `/leagues/${slug}/team/${encodeURIComponent(user.id)}`;
  const queryParams = new URLSearchParams();
  if (proposeTradeTo) queryParams.set("proposeTradeTo", proposeTradeTo);
  if (addFa) queryParams.set("addFa", addFa);
  const qs = queryParams.toString();
  const url = qs ? `${base}?${qs}` : base;
  const hash = proposeTradeTo ? "#propose-trade" : addFa ? "#sign-free-agent" : "";
  redirect(url + hash);
}
