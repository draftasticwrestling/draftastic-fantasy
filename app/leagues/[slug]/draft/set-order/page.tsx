import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLeagueBySlug, getLeagueMembers } from "@/lib/leagues";
import { getDraftOrder } from "@/lib/leagueDraft";
import { SetDraftOrderForm } from "./SetDraftOrderForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) return { title: "Set draft order — Draftastic Fantasy" };
  return {
    title: `Set draft order — ${league.name} — Draftastic Fantasy`,
    description: "Set the draft pick order for this league (General Manager only).",
  };
}

export default async function SetDraftOrderPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const isCommissioner = league.commissioner_id === user.id;
  if (!isCommissioner) notFound();

  const [members, order] = await Promise.all([
    getLeagueMembers(league.id),
    getDraftOrder(league.id),
  ]);

  const numMembers = members.length;
  const initialRound1UserIds =
    order.length >= numMembers
      ? order.slice(0, numMembers).map((o) => o.user_id)
      : members.map((m) => m.user_id);

  const memberRows = members.map((m) => ({
    user_id: m.user_id,
    display_name: m.display_name ?? null,
    team_name: m.team_name ?? null,
  }));

  return (
    <main className="app-page">
      <p style={{ marginBottom: 24 }}>
        <Link href={`/leagues/${slug}/draft`} className="app-link">
          ← Draft
        </Link>
      </p>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 8, color: "var(--color-text)" }}>
        Set draft order
      </h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 24, maxWidth: 560 }}>
        As the General Manager, you can set the pick order for round 1. The full order is built from this list using your league&apos;s draft style (snake or linear). Everyone will see the order on the Draft page once saved.
      </p>
      <SetDraftOrderForm
        leagueSlug={slug}
        members={memberRows}
        initialRound1UserIds={initialRound1UserIds}
      />
    </main>
  );
}
