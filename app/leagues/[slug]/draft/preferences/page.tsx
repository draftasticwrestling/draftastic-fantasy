import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLeagueBySlug } from "@/lib/leagues";
import { getLeagueDraftState, getDraftPreferences, isDraftableWrestler, normalizeWrestlerRowFromApi } from "@/lib/leagueDraft";
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

  const [state, prefs, wrestlersData] = await Promise.all([
    getLeagueDraftState(league.id),
    getDraftPreferences(league.id, user.id),
    (async () => {
      type Row = { id: string; name: string | null; gender?: string | null; status?: string | null; brand?: string | null; classification?: string | null };
      let result = await supabase
        .from("wrestlers")
        .select('id, name, gender, status, "Status", brand, classification, "Classification"')
        .order("name", { ascending: true });
      if (result.error) {
        result = await supabase.from("wrestlers").select('id, name, gender, status, "Status", brand, classification, "Classification"').order("name", { ascending: true });
      }
      let rawRows = (result.data ?? []) as Record<string, unknown>[];
      if (result.error && !rawRows.length) {
        const fallback = await supabase.from("wrestlers").select('id, name, gender, status, "Status", brand, classification, "Classification"').order("name", { ascending: true });
        rawRows = (fallback.data ?? []) as Record<string, unknown>[];
      }
      if (rawRows.length === 0) {
        const minimal = await supabase.from("wrestlers").select("id, name").order("name", { ascending: true });
        rawRows = (minimal.data ?? []) as Record<string, unknown>[];
      }
      const toId = (r: Record<string, unknown>) => String(r.id ?? r.Id ?? "");
      const toName = (r: Record<string, unknown>) => {
        const n = r.name ?? r.Name ?? r.id ?? r.Id;
        return n != null ? String(n) : "";
      };
      const rows = rawRows.map((r) => ({ ...r, id: toId(r), name: toName(r), ...normalizeWrestlerRowFromApi(r) })) as Row[];
      let draftable = rows.filter((w) => isDraftableWrestler(w)).map((w) => ({ id: w.id, name: w.name ?? w.id }));
      if (draftable.length === 0 && rawRows.length > 0) {
        draftable = rawRows.map((r) => ({ id: toId(r), name: toName(r) })).filter((w) => w.id);
      }
      return draftable;
    })(),
  ]);

  const draftStatus = state?.draft_status ?? "not_started";
  const canEdit = draftStatus === "not_started";

  const initialFocus = prefs?.strategy_options?.focus ?? "all";
  const initialPointStrategy = prefs?.strategy_options?.pointStrategy ?? "total";
  const initialWrestlerStrategy = prefs?.strategy_options?.wrestlerStrategy ?? "best_available";
  const initialPriorityList = prefs?.priority_list ?? [];
  const wrestlerOptions = wrestlersData;

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
        If the draft clock runs out, your pick is made automatically. Optionally set a ranked list of 10–50 preferred wrestlers; when none from your list are available, your focus and strategies below take over.
      </p>

      {!canEdit && (
        <p style={{ padding: "12px 16px", background: "var(--color-bg-elevated)", borderRadius: "var(--radius)", marginBottom: 24, color: "var(--color-text-muted)" }}>
          The draft has already started or finished. Preferences cannot be changed now.
        </p>
      )}

      <DraftPreferencesForm
        leagueSlug={slug}
        wrestlerOptions={wrestlerOptions}
        initialPriorityList={initialPriorityList}
        initialFocus={initialFocus}
        initialPointStrategy={initialPointStrategy}
        initialWrestlerStrategy={initialWrestlerStrategy}
        disabled={!canEdit}
      />
    </main>
  );
}
