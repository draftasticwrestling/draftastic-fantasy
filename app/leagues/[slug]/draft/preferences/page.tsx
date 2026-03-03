import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLeagueBySlug } from "@/lib/leagues";
import { getLeagueDraftState, getDraftPreferences } from "@/lib/leagueDraft";
import { DraftPreferencesForm } from "./DraftPreferencesForm";

type Props = { params: Promise<{ slug: string }> };

export const metadata = {
  title: "Auto-draft preferences — Draftastic Fantasy",
  description: "Set your draft focus and strategy for auto-picks.",
};

export default async function DraftPreferencesPage({ params }: Props) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: member } = await supabase
    .from("league_members")
    .select("user_id")
    .eq("league_id", league.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) notFound();

  const [state, prefs] = await Promise.all([
    getLeagueDraftState(league.id),
    getDraftPreferences(league.id, user.id),
  ]);

  const draftStatus = state?.draft_status ?? "not_started";
  const canEdit = draftStatus === "not_started";

  const initialFocus = prefs?.strategy_options?.focus ?? "all";
  const initialPointStrategy = prefs?.strategy_options?.pointStrategy ?? "total";
  const initialWrestlerStrategy = prefs?.strategy_options?.wrestlerStrategy ?? "best_available";

  return (
    <main className="app-page" style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1rem", fontSize: 16, lineHeight: 1.5 }}>
      <p style={{ marginBottom: 24 }}>
        <Link href={`/leagues/${slug}/draft`} className="app-link">
          ← Back to draft
        </Link>
      </p>
      <h1 style={{ marginBottom: 8, fontSize: "1.5rem", color: "var(--color-text)" }}>
        Auto-draft preferences
      </h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 24, fontSize: 14 }}>
        If the draft clock runs out, your pick is made automatically. Choose a focus (which points period), point strategy, and wrestler strategy below.
      </p>

      {!canEdit && (
        <p style={{ padding: "12px 16px", background: "var(--color-bg-elevated)", borderRadius: "var(--radius)", marginBottom: 24, color: "var(--color-text-muted)" }}>
          The draft has already started or finished. Preferences cannot be changed now.
        </p>
      )}

      <DraftPreferencesForm
        leagueSlug={slug}
        initialFocus={initialFocus}
        initialPointStrategy={initialPointStrategy}
        initialWrestlerStrategy={initialWrestlerStrategy}
        disabled={!canEdit}
      />
    </main>
  );
}
