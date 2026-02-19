import { supabase } from "@/lib/supabase";
import { EXAMPLE_LEAGUE } from "@/lib/league";

const LEAGUE_SLUG = EXAMPLE_LEAGUE.slug;
const ACTIVATION_MONTHS = 12;

export type DiscoveryHoldingRow = {
  id: string;
  league_slug: string;
  owner_slug: string;
  draft_pick_id: string;
  wrestler_name: string;
  company: string | null;
  debut_date: string | null;
  activated_at: string | null;
  created_at?: string;
};

export type DiscoveryHoldingWithStatus = DiscoveryHoldingRow & {
  status: "rights_held" | "clock_started" | "expired" | "activated";
  monthsLeft?: number | null;
  contractYears?: number | null;
};

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function getStatus(
  holding: { debut_date: string | null; activated_at: string | null }
): DiscoveryHoldingWithStatus["status"] {
  if (holding.activated_at) return "activated";
  if (!holding.debut_date) return "rights_held";
  const deadline = addMonths(holding.debut_date, ACTIVATION_MONTHS);
  const today = new Date().toISOString().slice(0, 10);
  if (today > deadline) return "expired";
  return "clock_started";
}

export function getMonthsLeft(debutDate: string): number | null {
  const deadline = addMonths(debutDate, ACTIVATION_MONTHS);
  const today = new Date().toISOString().slice(0, 10);
  if (today > deadline) return null;
  const d = new Date(deadline + "T12:00:00Z");
  const t = new Date(today + "T12:00:00Z");
  const months = (d.getTime() - t.getTime()) / (30.44 * 24 * 60 * 60 * 1000);
  return Math.max(0, Math.ceil(months));
}

/**
 * Fetch all discovery holdings for an owner.
 */
export async function getHoldingsForOwner(
  leagueSlug: string,
  ownerSlug: string
): Promise<DiscoveryHoldingWithStatus[]> {
  const { data, error } = await supabase
    .from("discovery_holdings")
    .select("id, league_slug, owner_slug, draft_pick_id, wrestler_name, company, debut_date, activated_at, created_at")
    .eq("league_slug", leagueSlug)
    .eq("owner_slug", ownerSlug)
    .order("created_at", { ascending: true });

  if (error) return [];
  const rows = (data ?? []) as DiscoveryHoldingRow[];
  if (rows.length === 0) return [];

  const picksById: Record<string, { contract_years: number }> = {};
  const pickIds = rows.map((r) => r.draft_pick_id);
  if (pickIds.length > 0) {
    const { data: picks } = await supabase
      .from("draft_picks")
      .select("id, contract_years")
      .in("id", pickIds);
    for (const p of picks ?? []) {
      picksById[p.id] = { contract_years: p.contract_years ?? 1 };
    }
  }

  return rows.map((row) => {
    const r = row;
    const status = getStatus(r);
    const contractYears = picksById[r.draft_pick_id]?.contract_years ?? null;
    return {
      ...r,
      status,
      monthsLeft: r.debut_date && status === "clock_started" ? getMonthsLeft(r.debut_date) : null,
      contractYears,
    };
  });
}

/**
 * Fetch all discovery holdings for the league (e.g. for admin or league page).
 */
export async function getHoldingsByOwner(leagueSlug: string): Promise<Record<string, DiscoveryHoldingWithStatus[]>> {
  const { data, error } = await supabase
    .from("discovery_holdings")
    .select("id, league_slug, owner_slug, draft_pick_id, wrestler_name, company, debut_date, activated_at, created_at")
    .eq("league_slug", leagueSlug)
    .order("owner_slug")
    .order("created_at", { ascending: true });

  if (error) return {};

  const pickIds = [...new Set((data ?? []).map((r) => r.draft_pick_id))];
  const { data: picks } = await supabase.from("draft_picks").select("id, contract_years").in("id", pickIds);
  const picksById: Record<string, number> = {};
  for (const p of picks ?? []) {
    picksById[p.id] = p.contract_years ?? 1;
  }

  const byOwner: Record<string, DiscoveryHoldingWithStatus[]> = {};
  for (const row of (data ?? []) as DiscoveryHoldingRow[]) {
    const status = getStatus(row);
    const entry: DiscoveryHoldingWithStatus = {
      ...row,
      status,
      monthsLeft: row.debut_date && status === "clock_started" ? getMonthsLeft(row.debut_date) : null,
      contractYears: picksById[row.draft_pick_id] ?? null,
    };
    const owner = row.owner_slug;
    if (!byOwner[owner]) byOwner[owner] = [];
    byOwner[owner].push(entry);
  }
  return byOwner;
}

/**
 * Use a discovery pick to claim rights to a wrestler (by name; they may not be in the DB).
 */
export async function createHolding(
  leagueSlug: string,
  ownerSlug: string,
  draftPickId: string,
  wrestlerName: string,
  company?: string | null
): Promise<{ id: string } | { error: string }> {
  const name = String(wrestlerName).trim();
  if (!name) return { error: "Wrestler name is required." };

  const { data: pick, error: pickErr } = await supabase
    .from("draft_picks")
    .select("id, league_slug, season, pick_type, current_owner_slug, used_at")
    .eq("id", draftPickId)
    .single();

  if (pickErr || !pick) return { error: "Invalid or missing draft pick." };
  const p = pick as { league_slug: string; pick_type: string; current_owner_slug: string; used_at: string | null };
  if (p.pick_type !== "discovery") return { error: "Pick must be a discovery pick." };
  if (p.current_owner_slug !== ownerSlug) return { error: "You do not own this pick." };
  if (p.used_at) return { error: "This discovery pick has already been used." };
  if (p.league_slug !== leagueSlug) return { error: "Pick is for a different league." };

  const { data: holding, error: insertErr } = await supabase
    .from("discovery_holdings")
    .insert({
      league_slug: leagueSlug,
      owner_slug: ownerSlug,
      draft_pick_id: draftPickId,
      wrestler_name: name,
      company: company?.trim() || null,
    })
    .select("id")
    .single();

  if (insertErr) return { error: insertErr.message };

  await supabase.from("draft_picks").update({ used_at: new Date().toISOString() }).eq("id", draftPickId);

  return { id: (holding as { id: string }).id };
}

/**
 * Set WWE main roster debut date (starts 12-month clock).
 */
export async function setDebutDate(holdingId: string, debutDate: string): Promise<{ error?: string }> {
  const date = debutDate.slice(0, 10);
  const { error } = await supabase
    .from("discovery_holdings")
    .update({ debut_date: date })
    .eq("id", holdingId)
    .is("activated_at", null);

  if (error) return { error: error.message };
  return {};
}

/**
 * Activate: add wrestler to roster (create wrestler row if needed) and mark holding as activated.
 */
export async function activateHolding(holdingId: string): Promise<{ error?: string }> {
  const { data: holding, error: fetchErr } = await supabase
    .from("discovery_holdings")
    .select("id, league_slug, owner_slug, draft_pick_id, wrestler_name, debut_date, activated_at")
    .eq("id", holdingId)
    .single();

  if (fetchErr || !holding) return { error: "Holding not found." };
  const h = holding as DiscoveryHoldingRow;
  if (h.activated_at) return { error: "Already activated." };
  if (h.debut_date) {
    const deadline = addMonths(h.debut_date, ACTIVATION_MONTHS);
    if (new Date().toISOString().slice(0, 10) > deadline) return { error: "12-month window has expired. Rights have lapsed." };
  }

  const { data: pick } = await supabase
    .from("draft_picks")
    .select("contract_years")
    .eq("id", h.draft_pick_id)
    .single();
  const contractYears = (pick as { contract_years?: number } | null)?.contract_years ?? 1;
  const contract = `${contractYears} yr`;

  const wrestlerId = slugifyName(h.wrestler_name);
  if (!wrestlerId) return { error: "Invalid wrestler name." };

  const { data: existing } = await supabase.from("wrestlers").select("id").eq("id", wrestlerId).single();
  if (!existing) {
    await supabase.from("wrestlers").insert({
      id: wrestlerId,
      name: h.wrestler_name.trim(),
    });
  }

  await supabase.from("roster_assignments").upsert(
    {
      league_slug: h.league_slug,
      owner_slug: h.owner_slug,
      wrestler_id: wrestlerId,
      contract,
    },
    { onConflict: "league_slug,owner_slug,wrestler_id" }
  );

  await supabase
    .from("discovery_holdings")
    .update({ activated_at: new Date().toISOString() })
    .eq("id", holdingId);

  return {};
}
