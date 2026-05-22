import { redirect } from "next/navigation";
import { getLeaguesForUser } from "@/lib/leagues";

export const metadata = {
  title: "Watch List — Wrestlers — Draftastic Fantasy",
  description: "Wrestlers on your watch list",
};

export const dynamic = "force-dynamic";

/** Legacy global URL — watchlists are per league; redirect into a league context. */
export default async function WrestlersWatchPage({
  searchParams,
}: {
  searchParams?: Promise<{ add?: string; league?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const addId = typeof sp.add === "string" ? sp.add.trim() : "";
  const leagueSlug = typeof sp.league === "string" ? sp.league.trim() : "";

  const leagues = await getLeaguesForUser();
  if (leagues.length === 0) {
    redirect("/leagues");
  }

  const matched = leagueSlug ? leagues.find((l) => l.slug === leagueSlug) : undefined;
  const target = matched ?? leagues[0]!;

  const base = `/leagues/${encodeURIComponent(target.slug)}/watchlist`;
  redirect(addId ? `${base}?add=${encodeURIComponent(addId)}` : base);
}
