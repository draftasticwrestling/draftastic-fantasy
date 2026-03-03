import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { aggregateWrestlerPoints } from "@/lib/scoring/aggregateWrestlerPoints.js";
import {
  getCurrentChampionsBySlug,
  inferReignsFromEvents,
} from "@/lib/scoring/endOfMonthBeltPoints.js";
import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";
import { isDraftableWrestler, isDraftableWrestlerForDraftTesting, normalizeWrestlerRowFromApi } from "@/lib/leagueDraft";
import { TestDraft } from "./TestDraft";

export const metadata = {
  title: "Draft Testing — Admin — Draftastic Fantasy",
  description: "Temporary admin page for trying out draft features.",
};

export const dynamic = "force-dynamic";

export type WrestlerDraftRow = {
  id: string;
  name: string | null;
  gender: string | null;
  brand: string | null;
  dob: string | null;
  image_url: string | null;
  rating_2k26: number | null;
  rating_2k25: number | null;
  /** Status from API (e.g. Injured, INJ). Shown as injury badge on Draft Testing table. */
  status: string | null;
  /** Current championship(s) held, e.g. "WWE Championship". Shown under name. */
  currentChampionship: string | null;
};

export type PointsBySlug = Record<string, { rsPoints: number; plePoints: number; beltPoints: number }>;

export default async function DraftTestingPage() {
  const supabase = await createClient();

  const [
    wrestlersResult,
    { data: events2025 },
    { data: events2026 },
    { data: eventsAll },
    { data: rawReigns },
  ] = await Promise.all([
    supabase
      .from("wrestlers")
      .select('id, name, gender, brand, dob, image_url, "Status", "Classification", "2K26 rating", "2K25 rating"')
      .order("name", { ascending: true }),
    supabase
      .from("events")
      .select("id, name, date, matches")
      .eq("status", "completed")
      .gte("date", "2025-01-01")
      .lte("date", "2025-12-31")
      .order("date", { ascending: true }),
    supabase
      .from("events")
      .select("id, name, date, matches")
      .eq("status", "completed")
      .gte("date", "2026-01-01")
      .order("date", { ascending: true }),
    supabase
      .from("events")
      .select("id, name, date, matches")
      .eq("status", "completed")
      .gte("date", "2025-01-01")
      .order("date", { ascending: true }),
    supabase
      .from("championship_history")
      .select("champion_slug, champion_id, champion, champion_name, title, title_name, won_date, start_date, lost_date, end_date")
      .order("won_date", { ascending: true }),
  ]);

  // If status column is missing or rating columns are missing, retry without status filter or with fewer columns.
  // Use Record<string, unknown>[] so fallback queries (e.g. only 2K26 or only 2K25) are assignable.
  type WrestlerRow = Record<string, unknown>;
  let wrestlersRows: WrestlerRow[] | null = (wrestlersResult.data ?? null) as WrestlerRow[] | null;
  let has2k26 = !wrestlersResult.error && wrestlersRows != null && wrestlersRows.length > 0;
  let has2k25 = has2k26;

  if (wrestlersResult.error && wrestlersRows == null) {
    const withoutStatus = await supabase
      .from("wrestlers")
      .select('id, name, gender, brand, dob, image_url, status, "Status", classification, "Classification", "2K26 rating", "2K25 rating"')
      .order("name", { ascending: true });
    if (!withoutStatus.error && withoutStatus.data != null) {
      wrestlersRows = withoutStatus.data as WrestlerRow[];
      has2k26 = true;
      has2k25 = true;
    }
  }
  if (wrestlersRows == null || wrestlersRows.length === 0) {
    const with26 = await supabase
      .from("wrestlers")
      .select('id, name, gender, brand, dob, image_url, status, "Status", classification, "Classification", "2K26 rating"')
      .order("name", { ascending: true });
    if (!with26.error && with26.data != null) {
      wrestlersRows = with26.data as WrestlerRow[];
      has2k26 = true;
      has2k25 = false;
    } else {
      const with25 = await supabase
        .from("wrestlers")
        .select('id, name, gender, brand, dob, image_url, status, "Status", classification, "Classification", "2K25 rating"')
        .order("name", { ascending: true });
      if (!with25.error && with25.data != null) {
        wrestlersRows = with25.data as WrestlerRow[];
        has2k26 = false;
        has2k25 = true;
      } else {
        const noRating = await supabase
          .from("wrestlers")
          .select('id, name, gender, brand, dob, image_url, status, "Status", classification, "Classification"')
          .order("name", { ascending: true });
        if (!noRating.error && noRating.data != null) {
          wrestlersRows = noRating.data as WrestlerRow[];
        }
      }
    }
  }
  // If classification column is missing, try without it so the table still gets data
  if (wrestlersRows == null || wrestlersRows.length === 0) {
    const noClassification = await supabase
      .from("wrestlers")
      .select('id, name, gender, brand, dob, image_url, status, "Status", "2K26 rating", "2K25 rating"')
      .order("name", { ascending: true });
    if (!noClassification.error && noClassification.data != null && noClassification.data.length > 0) {
      wrestlersRows = noClassification.data as WrestlerRow[];
      has2k26 = true;
      has2k25 = true;
    }
  }
  // Last resort: minimal columns; include Status so injury badge can show
  if (wrestlersRows == null || wrestlersRows.length === 0) {
    const minimal = await supabase
      .from("wrestlers")
      .select('id, name, gender, brand, dob, image_url, "Status", "2K26 rating", "2K25 rating"')
      .order("name", { ascending: true });
    if (!minimal.error && minimal.data != null && minimal.data.length > 0) {
      wrestlersRows = minimal.data as WrestlerRow[];
      has2k26 = true;
      has2k25 = true;
    }
  }
  // If Status column doesn't exist, try lowercase (Postgres may store as "status")
  if (wrestlersRows != null && wrestlersRows.length > 0) {
    const first = wrestlersRows[0] as Record<string, unknown>;
    if (first.Status == null && first.status == null) {
      const withStatus = await supabase
        .from("wrestlers")
        .select('id, name, gender, brand, dob, image_url, status, "2K26 rating", "2K25 rating"')
        .order("name", { ascending: true });
      if (!withStatus.error && withStatus.data != null && withStatus.data.length > 0) {
        wrestlersRows = withStatus.data as WrestlerRow[];
      }
    }
  }

  const tableReigns = (rawReigns ?? []) as Array<{
    champion_slug?: string | null;
    champion_id?: string | null;
    champion?: string | null;
    champion_name?: string | null;
    title?: string | null;
    title_name?: string | null;
    won_date?: string | null;
    start_date?: string | null;
    lost_date?: string | null;
    end_date?: string | null;
  }>;
  const reigns = tableReigns.length > 0 ? tableReigns : inferReignsFromEvents(eventsAll ?? []);
  const currentChampionsBySlug = getCurrentChampionsBySlug(reigns);

  const normalizedRows = (wrestlersRows ?? []).map((r) => ({ ...r, ...normalizeWrestlerRowFromApi(r as Record<string, unknown>) }));
  // Use isDraftableWrestlerForDraftTesting so injured wrestlers appear in the table with injury badge
  let draftableRows = normalizedRows.filter((row) => isDraftableWrestlerForDraftTesting(row as Parameters<typeof isDraftableWrestlerForDraftTesting>[0]));
  if (draftableRows.length === 0 && normalizedRows.length > 0) {
    draftableRows = [...normalizedRows];
  }

  /** Read numeric rating from row; tries primary key then alternates (Boxscore may use different column names). */
  function readRating(
    row: Record<string, unknown>,
    primary: string,
    alternates: string[] = []
  ): number | null {
    const keys = [primary, ...alternates];
    for (const key of keys) {
      const v = row[key];
      if (v == null || v === "") continue;
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
    }
    return null;
  }

  /** Read status from row (API may return Status or status). */
  function readStatus(row: Record<string, unknown>): string | null {
    const v = row.status ?? row.Status ?? (row as Record<string, unknown>).STATUS;
    return v != null && v !== "" ? String(v) : null;
  }

  const wrestlers: WrestlerDraftRow[] = draftableRows.map((w) => {
    const row = w as Record<string, unknown>;
    const statusVal = readStatus(row);
    const slugKey = String(row.id ?? "");
    const nameKey = row.name != null ? normalizeWrestlerName(String(row.name)) : "";
    const titles =
      currentChampionsBySlug[slugKey] ?? (nameKey ? currentChampionsBySlug[nameKey] : null) ?? [];
    return {
      id: slugKey,
      name: row.name != null ? String(row.name) : null,
      gender: row.gender != null ? String(row.gender) : null,
      brand: row.brand != null ? String(row.brand) : null,
      dob: row.dob != null ? String(row.dob) : null,
      image_url: row.image_url != null && row.image_url !== "" ? String(row.image_url) : null,
      rating_2k26: has2k26
        ? readRating(row, "2K26 rating", ["rating_2k26", "twok26_rating", "2k26_rating"])
        : null,
      rating_2k25: has2k25
        ? readRating(row, "2K25 rating", ["rating_2k25", "twok25_rating", "2k25_rating"])
        : null,
      status: statusVal,
      currentChampionship: titles.length > 0 ? titles.join(", ") : null,
      // Send both casings so client always receives status (serialization may vary)
      ...(statusVal != null ? { Status: statusVal } : {}),
    };
  });

  const points2025 = aggregateWrestlerPoints(events2025 ?? []) as PointsBySlug;
  const points2026 = aggregateWrestlerPoints(events2026 ?? []) as PointsBySlug;
  const pointsAll = aggregateWrestlerPoints(eventsAll ?? []) as PointsBySlug;

  const pointsByPeriod = {
    "2026": points2026,
    "2025": points2025,
    all: pointsAll,
  };

  return (
    <main
      className="app-page"
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "2rem 1rem",
        fontSize: 16,
        lineHeight: 1.6,
      }}
    >
      <p style={{ marginBottom: 24 }}>
        <Link href="/" className="app-link" style={{ fontWeight: 500 }}>
          ← Home
        </Link>
        {" · "}
        <span style={{ color: "var(--color-text-muted)" }}>Admin</span>
      </p>

      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 8 }}>
        Draft Testing
      </h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 32 }}>
        Run test drafts: set the number of teams, then make every pick for every team (snake order). No real league or data is saved.
      </p>

      <TestDraft wrestlers={wrestlers} pointsByPeriod={pointsByPeriod} />
    </main>
  );
}
