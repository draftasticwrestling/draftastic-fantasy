import "server-only";

import { unstable_cache } from "next/cache";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { EVENT_STATUSES_FOR_SCORING } from "@/lib/eventsScoring";
import {
  isDraftableWrestlerForDraftTesting,
  normalizeWrestlerRowFromApi,
} from "@/lib/leagueDraft";
import { aggregateWrestlerPoints } from "@/lib/scoring/aggregateWrestlerPoints.js";
import { brandByWrestlerSlugFromRows } from "@/lib/wrestlerBrandLookup";
import { genderFilterKey } from "@/lib/wrestlerGenderFilter";
import type { MockBrand, MockDraftWrestler, MockGender } from "@/lib/mockDraftEngine";

/**
 * One cached roster payload for the practice draft.
 * Points come from wrestler_stats_cache so this path does not scan events.matches
 * on the happy path. The draft room never calls back — picks stay in the browser.
 */
const MOCK_POOL_REVALIDATE_SECONDS = 1800;

function publicClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !anon) return null;
  return createClient(url, anon);
}

function mockBrand(brand: string | null | undefined): MockBrand {
  const lower = (brand ?? "").trim().toLowerCase();
  if (lower === "raw") return "Raw";
  if (lower === "smackdown" || lower === "smack down") return "SmackDown";
  if (lower === "nxt" || lower.includes("nxt")) return "NXT";
  return "Other";
}

function isInjured(status: string | null | undefined): boolean {
  if (!status) return false;
  const s = status.trim().toLowerCase();
  return s === "injured" || s === "inj" || s.includes("injured");
}

type WrestlerSource = {
  id: string;
  name: string;
  gender: string | null;
  brand: string | null;
  imageUrl: string | null;
  status: string | null;
};

async function loadWrestlerRows(supabase: SupabaseClient): Promise<WrestlerSource[]> {
  const full = await supabase
    .from("wrestlers")
    .select('id, name, gender, brand, image_url, "Status", "Classification"')
    .order("name", { ascending: true });

  const data = !full.error ? full.data : null;
  const rows =
    data ??
    (
      await supabase
        .from("wrestlers")
        .select('id, name, gender, brand, image_url, "Status"')
        .order("name", { ascending: true })
    ).data ??
    [];

  return rows.flatMap((row) => {
    const record = row as Record<string, unknown>;
    const normalized = normalizeWrestlerRowFromApi(record);
    const id = normalized.id ?? (record.id != null ? String(record.id) : "");
    const name = record.name != null ? String(record.name).trim() : "";
    if (!id || !name) return [];
    if (
      !isDraftableWrestlerForDraftTesting({
        id,
        status: normalized.status,
        classification: normalized.classification,
        brand: normalized.brand ?? (record.brand != null ? String(record.brand) : undefined),
      })
    ) {
      return [];
    }
    return [
      {
        id,
        name,
        gender: record.gender != null ? String(record.gender) : null,
        brand: record.brand != null ? String(record.brand) : null,
        imageUrl: record.image_url != null && record.image_url !== "" ? String(record.image_url) : null,
        status: normalized.status ?? null,
      },
    ];
  });
}

async function pointsByWrestlerId(
  supabase: SupabaseClient,
  wrestlers: WrestlerSource[]
): Promise<Map<string, number>> {
  const points = new Map<string, number>();
  const { data, error } = await supabase
    .from("wrestler_stats_cache")
    .select("wrestler_id, total_points")
    .eq("season_key", "2026");

  if (!error && data && data.length > 0) {
    for (const row of data) {
      const id = row.wrestler_id != null ? String(row.wrestler_id) : "";
      if (!id) continue;
      points.set(id, Number(row.total_points ?? 0));
    }
    return points;
  }

  const { data: events } = await supabase
    .from("events")
    .select("id, name, date, matches")
    .in("status", [...EVENT_STATUSES_FOR_SCORING])
    .gte("date", "2026-01-01")
    .lte("date", "2026-12-31")
    .order("date", { ascending: true });

  const brandBySlug = brandByWrestlerSlugFromRows(
    wrestlers.map((w) => ({ id: w.id, brand: w.brand }))
  );
  const aggregated = aggregateWrestlerPoints(
    (events ?? []) as { id: string; name: string; date: string; matches?: object[] }[],
    brandBySlug
  ) as Record<string, { rsPoints: number; plePoints: number; beltPoints: number }>;

  for (const [id, row] of Object.entries(aggregated)) {
    points.set(id, (row.rsPoints ?? 0) + (row.plePoints ?? 0) + (row.beltPoints ?? 0));
  }
  return points;
}

async function loadMockDraftPool(): Promise<MockDraftWrestler[]> {
  const supabase = publicClient();
  if (!supabase) return [];

  const wrestlers = await loadWrestlerRows(supabase);
  const points = await pointsByWrestlerId(supabase, wrestlers);
  const ranked: MockDraftWrestler[] = wrestlers
    .map((w) => ({
      id: w.id,
      name: w.name,
      gender: genderFilterKey(w) as MockGender,
      brand: mockBrand(w.brand),
      imageUrl: w.imageUrl,
      injured: isInjured(w.status),
      points: points.get(w.id) ?? 0,
      rank: 0,
    }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

  ranked.forEach((w, i) => {
    w.rank = i + 1;
  });
  return ranked;
}

export const getMockDraftPool = unstable_cache(loadMockDraftPool, ["mock-draft-pool-v1"], {
  revalidate: MOCK_POOL_REVALIDATE_SECONDS,
});
