import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLeagueBySlug } from "@/lib/leagues";
import {
  getLeagueDraftState,
  getDraftPreferences,
  isDraftableWrestler,
  normalizeWrestlerRowFromApi,
} from "@/lib/leagueDraft";
import { getAdminClient } from "@/lib/supabase/admin";
import { AUTOPICK_REQUIRED_FEMALE_COUNT, AUTOPICK_REQUIRED_PRIORITY_COUNT } from "@/lib/draftPriorityRequirements";
import { inferListSourceFromSavedList, isBigBoardId, type BigBoardId } from "@/lib/draftBigBoards";
import { DraftPreferencesForm } from "./DraftPreferencesForm";

type Props = { params: Promise<{ slug: string }> };

export const metadata = {
  title: "Auto-draft preferences — Draftastic Fantasy",
  description: "Set your draft priority list or Big Board for auto-picks.",
};

export const dynamic = "force-dynamic";

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
      const rowGender = (r: Record<string, unknown>) => {
        const g = r.gender ?? r.Gender;
        return g != null && String(g).trim() !== "" ? String(g) : null;
      };
      let draftable = rows
        .filter((w) => isDraftableWrestler(w))
        .map((w) => {
          const raw = w as unknown as Record<string, unknown>;
          return { id: w.id, name: w.name ?? w.id, gender: rowGender(raw) };
        });
      if (draftable.length === 0 && rawRows.length > 0) {
        draftable = rawRows
          .map((r) => ({ id: toId(r), name: toName(r), gender: rowGender(r) }))
          .filter((w) => w.id);
      }
      const admin = getAdminClient();
      if (admin && draftable.length > 0) {
        const ids = [...new Set(draftable.map((w) => w.id))];
        const chunk = 200;
        const genderById = new Map<string, string | null>();
        for (let i = 0; i < ids.length; i += chunk) {
          const slice = ids.slice(i, i + chunk);
          const { data: gRows } = await admin.from("wrestlers").select("id, gender").in("id", slice);
          for (const row of (gRows ?? []) as { id: string; gender: string | null }[]) {
            const g = row.gender ?? null;
            genderById.set(row.id, g);
            genderById.set(String(row.id).toLowerCase(), g);
          }
        }
        draftable = draftable.map((w) => ({
          ...w,
          gender: genderById.get(w.id) ?? genderById.get(w.id.toLowerCase()) ?? w.gender ?? null,
        }));
      }
      return draftable;
    })(),
  ]);

  const draftStatus = state?.draft_status ?? "not_started";
  const canEdit = draftStatus === "not_started";

  const initialPriorityList = prefs?.priority_list ?? [];
  const wrestlerOptions = wrestlersData;

  let initialListSource: "custom" | BigBoardId = "custom";
  if (league.draft_type === "autopick") {
    const so = prefs?.strategy_options as { priorityListSource?: string } | null | undefined;
    const raw = so?.priorityListSource?.trim();
    if (raw === "custom") {
      initialListSource = "custom";
    } else if (raw && isBigBoardId(raw)) {
      initialListSource = raw;
    } else if (initialPriorityList.length >= AUTOPICK_REQUIRED_PRIORITY_COUNT) {
      const inferred = inferListSourceFromSavedList(initialPriorityList);
      if (inferred) initialListSource = inferred;
    }
  }

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
        {league.draft_type === "autopick" ? (
          <>
            Autopick leagues require a ranked list of at least {AUTOPICK_REQUIRED_PRIORITY_COUNT} wrestlers with at
            least {AUTOPICK_REQUIRED_FEMALE_COUNT} female picks, or you can apply an official Big Board below. After
            your list runs out, picks use all-time total points and best-available tie-breaks.
          </>
        ) : (
          <>
            If the draft clock runs out, your pick is made automatically. Optionally set a ranked list of 10–50
            preferred wrestlers; when none from your list are available, picks use all-time total points and
            best-available tie-breaks.
          </>
        )}
      </p>

      {!canEdit && (
        <p style={{ padding: "12px 16px", background: "var(--color-bg-elevated)", borderRadius: "var(--radius)", marginBottom: 24, color: "var(--color-text-muted)" }}>
          The draft has already started or finished. Preferences cannot be changed now.
        </p>
      )}

      <DraftPreferencesForm
        key={JSON.stringify({ priorityList: initialPriorityList, listSource: initialListSource })}
        leagueSlug={slug}
        wrestlerOptions={wrestlerOptions}
        initialPriorityList={initialPriorityList}
        initialListSource={initialListSource}
        isAutopickLeague={league.draft_type === "autopick"}
        disabled={!canEdit}
      />
    </main>
  );
}
