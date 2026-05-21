import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import { getLeagueBySlug } from "@/lib/leagues";
import {
  getLeagueDraftState,
  getDraftPreferences,
  isDraftableWrestler,
  normalizeWrestlerRowFromApi,
} from "@/lib/leagueDraft";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  AUTOPICK_LIST_EXHAUSTED_TIE_BREAK,
  AUTOPICK_REQUIRED_FEMALE_COUNT,
  getAutopickRequiredPriorityCount,
} from "@/lib/draftPriorityRequirements";
import {
  getAvailableBigBoardIdsForLeague,
  getBigBoardPriorityList,
  isBigBoardId,
  type BigBoardId,
} from "@/lib/draftBigBoards";
import {
  BETA_AUTOPICK_DRAFT_WINDOW_LABEL,
  BETA_AUTOPICK_PREF_DEADLINE_LABEL,
} from "@/lib/betaAutopickSchedule";
import { leagueIncludesNxt } from "@/lib/leagueStructure";
import { DraftPreferencesForm } from "./DraftPreferencesForm";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ from?: string }>;
};

export const metadata = {
  title: "Auto-draft preferences — Draftastic Fantasy",
  description: "Set your draft priority list or Big Board for auto-picks.",
};

export const dynamic = "force-dynamic";

export default async function DraftPreferencesPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const search = searchParams ? await searchParams : {};
  const fromOnboarding = search.from === "onboarding";
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const { supabase, user } = await getServerAuth();
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
      type Row = {
        id: string;
        name: string | null;
        gender?: string | null;
        status?: string | null;
        brand?: string | null;
        classification?: string | null;
      };
      let result: { data: Record<string, unknown>[] | null; error: { message?: string } | null } = await supabase
        .from("wrestlers")
        .select('id, name, gender, "Status", brand, "Classification"')
        .order("name", { ascending: true });
      if (result.error) {
        result = await supabase
          .from("wrestlers")
          .select('id, name, gender, "Status", brand, "Classification"')
          .order("name", { ascending: true });
      }
      let rawRows = (result.data ?? []) as Record<string, unknown>[];
      if (result.error && !rawRows.length) {
        const fallback = await supabase
          .from("wrestlers")
          .select('id, name, gender, "Status", brand, "Classification"')
          .order("name", { ascending: true });
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
      const excludedClassifications = new Set([
        "alumni",
        "non-wrestler",
        "non-wrestlers",
        "celebrity guest",
        "celebrity guests",
      ]);
      const isExcludedClassification = (r: Record<string, unknown>) => {
        const c = r.Classification ?? r.classification;
        if (c == null) return false;
        return excludedClassifications.has(String(c).trim().toLowerCase());
      };
      const eligibleRawRows = rawRows.filter((r) => !isExcludedClassification(r));
      const rows = eligibleRawRows.map((r) => ({ ...r, id: toId(r), name: toName(r), ...normalizeWrestlerRowFromApi(r) })) as Row[];
      const rowGender = (r: Record<string, unknown>) => {
        const g = r.gender ?? r.Gender;
        return g != null && String(g).trim() !== "" ? String(g) : null;
      };
      const rowBrand = (r: Record<string, unknown>) => {
        const b = r.brand ?? r.Brand;
        return b != null && String(b).trim() !== "" ? String(b) : null;
      };
      const rowDob = (r: Record<string, unknown>) => {
        const d = r.dob ?? r.DOB;
        return d != null && String(d).trim() !== "" ? String(d) : null;
      };
      const row2k26 = (r: Record<string, unknown>) => {
        const n = r["2K26 rating"] ?? r["2k26 rating"] ?? r["2k26_rating"];
        const parsed = Number(n);
        return Number.isFinite(parsed) ? parsed : null;
      };
      const row2k25 = (r: Record<string, unknown>) => {
        const n = r["2K25 rating"] ?? r["2k25 rating"] ?? r["2k25_rating"];
        const parsed = Number(n);
        return Number.isFinite(parsed) ? parsed : null;
      };
      let draftable = rows
        .filter((w) => isDraftableWrestler(w))
        .map((w) => {
          const raw = w as unknown as Record<string, unknown>;
          return {
            id: w.id,
            name: w.name ?? w.id,
            gender: rowGender(raw),
            brand: rowBrand(raw),
            dob: null as string | null,
            rating2k: null as number | null,
          };
        });
      if (draftable.length === 0 && eligibleRawRows.length > 0) {
        draftable = eligibleRawRows
          .map((r) => ({
            id: toId(r),
            name: toName(r),
            gender: rowGender(r),
            brand: rowBrand(r),
            dob: null as string | null,
            rating2k: null as number | null,
          }))
          .filter((w) => w.id);
      }
      // Optional metadata columns vary by environment; fetch them separately so one missing column
      // does not drop the entire wrestler query.
      const ids = [...new Set(draftable.map((w) => w.id).filter(Boolean))];
      if (ids.length > 0) {
        const chunk = 200;
        const brandById = new Map<string, string | null>();
        const classificationById = new Map<string, string | null>();
        const dobById = new Map<string, string | null>();
        const ratingById = new Map<string, number | null>();
        const put = <T,>(m: Map<string, T>, id: string, value: T) => {
          m.set(id, value);
          m.set(String(id).toLowerCase(), value);
        };
        for (let i = 0; i < ids.length; i += chunk) {
          const slice = ids.slice(i, i + chunk);
          const { data: brandRows } = await supabase.from("wrestlers").select("id, brand").in("id", slice);
          for (const row of (brandRows ?? []) as { id: string; brand: string | null }[]) {
            put(brandById, row.id, rowBrand(row as unknown as Record<string, unknown>));
          }
          let clsRows: { id: string; classification?: string | null; Classification?: string | null }[] = [];
          const clsLower = await supabase.from("wrestlers").select("id, classification").in("id", slice);
          if (!clsLower.error) {
            clsRows = (clsLower.data ?? []) as { id: string; classification?: string | null }[];
          } else {
            const clsUpper = await supabase.from("wrestlers").select('id, "Classification"').in("id", slice);
            clsRows = (clsUpper.data ?? []) as { id: string; Classification?: string | null }[];
          }
          for (const row of clsRows) {
            const c = row.classification ?? row.Classification ?? null;
            put(classificationById, row.id, c != null && String(c).trim() !== "" ? String(c) : null);
          }
          const { data: dobRows } = await supabase.from("wrestlers").select("id, dob").in("id", slice);
          for (const row of (dobRows ?? []) as { id: string; dob: string | null }[]) {
            put(dobById, row.id, rowDob(row as unknown as Record<string, unknown>));
          }
          const { data: r26Rows } = await supabase.from("wrestlers").select('id, "2K26 rating"').in("id", slice);
          for (const row of (r26Rows ?? []) as { id: string; "2K26 rating": number | null }[]) {
            put(ratingById, row.id, row2k26(row as unknown as Record<string, unknown>));
          }
          const { data: r25Rows } = await supabase.from("wrestlers").select('id, "2K25 rating"').in("id", slice);
          for (const row of (r25Rows ?? []) as { id: string; "2K25 rating": number | null }[]) {
            const k = row.id;
            const existing = ratingById.get(k) ?? ratingById.get(k.toLowerCase());
            if (existing == null) put(ratingById, k, row2k25(row as unknown as Record<string, unknown>));
          }
        }
        draftable = draftable.map((w) => ({
          ...w,
          brand: brandById.get(w.id) ?? brandById.get(w.id.toLowerCase()) ?? w.brand ?? null,
          classification:
            classificationById.get(w.id) ?? classificationById.get(w.id.toLowerCase()) ?? null,
          dob: dobById.get(w.id) ?? dobById.get(w.id.toLowerCase()) ?? w.dob ?? null,
          rating2k: ratingById.get(w.id) ?? ratingById.get(w.id.toLowerCase()) ?? w.rating2k ?? null,
        }));
      }
      const hasExcludedTokens = (value: string | null | undefined) => {
        const v = String(value ?? "").trim().toLowerCase();
        if (!v) return false;
        return (
          v === "aaa" ||
          v.includes("alumni") ||
          v.includes("non-wrestler") ||
          v.includes("non wrestler") ||
          v.includes("celebrity guest") ||
          v.includes("celebrity") ||
          v.includes("legend") ||
          v.includes("hall of fame")
        );
      };
      draftable = draftable.filter((w) => {
        const c = (w as { classification?: string | null }).classification ?? null;
        return !hasExcludedTokens(c) && !hasExcludedTokens(w.brand ?? null);
      });
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
  const autopickRequiredPriorityCount = getAutopickRequiredPriorityCount(leagueIncludesNxt(league));

  const wrestlerOptions = wrestlersData;
  const eligibleIds = new Set(wrestlerOptions.map((w) => String(w.id).toLowerCase()));
  const keepEligibleOnly = (ids: string[]) => ids.filter((id) => eligibleIds.has(String(id).toLowerCase()));
  const initialPriorityList = keepEligibleOnly(prefs?.priority_list ?? []);
  const availableBigBoardIds = getAvailableBigBoardIdsForLeague({
    includeNxt: leagueIncludesNxt(league),
  });
  const isAvailableBoardId = (id: string | null | undefined): id is BigBoardId =>
    Boolean(id) && isBigBoardId(id) && availableBigBoardIds.includes(id as BigBoardId);

  let initialListSource: "custom" | BigBoardId = "custom";
  let autopickInitialList = initialPriorityList;
  if (league.draft_type === "autopick") {
    const so = prefs?.strategy_options as { priorityListSource?: string } | null | undefined;
    const raw = so?.priorityListSource?.trim();
    if (raw === "custom") {
      initialListSource = "custom";
    } else if (!raw && initialPriorityList.length >= autopickRequiredPriorityCount) {
      initialListSource = "custom";
    } else if (raw && isAvailableBoardId(raw)) {
      initialListSource = raw;
      autopickInitialList = keepEligibleOnly(getBigBoardPriorityList(raw) ?? initialPriorityList);
    } else if (availableBigBoardIds.includes("default")) {
      initialListSource = "default";
      autopickInitialList = keepEligibleOnly(getBigBoardPriorityList("default") ?? []);
    } else {
      initialListSource = "custom";
      autopickInitialList = initialPriorityList;
    }
  }

  return (
    <main className="app-page" style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1rem", fontSize: 16, lineHeight: 1.5 }}>
      <p style={{ marginBottom: 24 }}>
        <Link
          href={fromOnboarding ? `/leagues/${slug}/onboarding` : `/leagues/${slug}/draft`}
          className="app-link"
        >
          {fromOnboarding ? "← Back to league setup" : "← Back to draft"}
        </Link>
      </p>
      {fromOnboarding ? (
        <div className="league-onboarding-callout" style={{ marginBottom: 24 }}>
          <p style={{ margin: 0 }}>
            <strong>League setup:</strong> Save your auto-draft list below, then return to setup to finish joining{" "}
            <strong>{league.name}</strong>.
          </p>
        </div>
      ) : null}
      <h1 style={{ marginBottom: 8, fontSize: "1.5rem", color: "var(--color-text)" }}>
        Auto-draft preferences
      </h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 24, fontSize: 14 }}>
        {league.draft_type === "autopick" ? (
          <>
            Beta autopick: everyone defaults to the site <strong>Default Big Board</strong> until they deliberately choose
            another <strong>provided Big Board</strong> or <strong>My own list</strong> below and save (for My own list: at least{" "}
            {autopickRequiredPriorityCount} wrestlers, including at least {AUTOPICK_REQUIRED_FEMALE_COUNT} female). Set
            preferences by end of day {BETA_AUTOPICK_PREF_DEADLINE_LABEL}; drafts run {BETA_AUTOPICK_DRAFT_WINDOW_LABEL}.{" "}
            <strong>Tie-break after your list runs out</strong> (same for everyone): {AUTOPICK_LIST_EXHAUSTED_TIE_BREAK}
          </>
        ) : (
          <>
            If the draft clock runs out, your pick is made automatically. Optionally set a ranked list of 10 or more
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
        key={JSON.stringify({ priorityList: autopickInitialList, listSource: initialListSource })}
        leagueSlug={slug}
        wrestlerOptions={wrestlerOptions}
        initialPriorityList={league.draft_type === "autopick" ? autopickInitialList : initialPriorityList}
        initialListSource={initialListSource}
        isAutopickLeague={league.draft_type === "autopick"}
        autopickRequiredPriorityCount={autopickRequiredPriorityCount}
        availableBigBoardIds={availableBigBoardIds}
        disabled={!canEdit}
        fromOnboarding={fromOnboarding}
      />
    </main>
  );
}
