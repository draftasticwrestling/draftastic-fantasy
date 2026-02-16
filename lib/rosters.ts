import { parse } from "csv-parse/sync";
import { LEAGUE_MEMBERS, getMemberBySlug } from "./league";

export type RosterEntry = { name: string; contract?: string };

/** Roster per member: slug -> list of wrestler names (and optional contract). */
export type RostersByMember = Record<string, RosterEntry[]>;

const CACHE_SECONDS = 60;

/**
 * If the user pastes the normal "edit" link, convert it to the CSV export URL.
 * Example: .../d/1ETOuez.../edit?gid=1300013357#gid=1300013357
 *      -> .../d/1ETOuez.../export?format=csv&gid=1300013357
 */
function getSheetExportUrl(): string {
  const raw = (process.env.GOOGLE_SHEET_CSV_URL ?? "").trim();
  if (!raw) return "";

  const editMatch = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)\/edit(?:\?[^#]*)?(?:#gid=(\d+))?/);
  if (editMatch) {
    const [, spreadsheetId, gid] = editMatch;
    const gidParam = gid ? `&gid=${gid}` : "";
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv${gidParam}`;
  }

  const gidFromQuery = raw.match(/[?&]gid=(\d+)/);
  if (gidFromQuery) {
    const gid = gidFromQuery[1];
    const idMatch = raw.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (idMatch) return `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv&gid=${gid}`;
  }

  return raw;
}

const CSV_URL = getSheetExportUrl();

/**
 * Normalize a name for matching: lowercase, trim, collapse spaces.
 */
function normalizeName(s: string): string {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Common nickname -> canonical first name for matching. */
const NICKNAMES: Record<string, string> = {
  chris: "christopher",
  mike: "michael",
  josh: "joshua",
  kenny: "kenneth",
  matt: "matthew",
  steve: "steven",
};

/**
 * Match sheet team/member name to our LEAGUE_MEMBERS.
 * Tries exact match, nickname expansion (Chris -> Christopher), last name, and contains.
 */
function matchMemberName(sheetName: string): (typeof LEAGUE_MEMBERS)[number] | null {
  const n = normalizeName(sheetName);
  if (!n) return null;
  const sheetParts = n.split(" ").filter(Boolean);
  for (const member of LEAGUE_MEMBERS) {
    const memberNorm = normalizeName(member.name);
    if (memberNorm === n) return member;
    if (memberNorm.endsWith(" " + n) || memberNorm.startsWith(n + " ")) return member;
    const memberParts = memberNorm.split(" ");
    const memberLast = memberParts.pop();
    const sheetLast = sheetParts[sheetParts.length - 1];
    if (memberLast && sheetLast && memberLast === sheetLast) return member;
    const expanded = sheetParts
      .map((p) => (NICKNAMES[p] ?? p))
      .join(" ");
    if (expanded && memberNorm === expanded) return member;
    if (memberNorm.includes(n) || n.includes(memberNorm)) return member;
  }
  return null;
}

/**
 * Fetch CSV from GOOGLE_SHEET_CSV_URL and return raw text.
 */
async function fetchSheetCSV(): Promise<string> {
  if (!CSV_URL) throw new Error("GOOGLE_SHEET_CSV_URL is not set");
  const res = await fetch(CSV_URL, { next: { revalidate: CACHE_SECONDS } });
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status} ${res.statusText}`);
  return res.text();
}

/**
 * Parse CSV text into rows with headers.
 * Expects first row = headers. Finds "team/member/owner" column and "wrestler/name" column.
 */
function parseRosterCSV(csvText: string): RostersByMember {
  const rows = parse(csvText, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
  if (rows.length === 0) return {};

  const rawKeys = Object.keys(rows[0]);
  const keyLower = (k: string) => k.trim().toLowerCase();
  const teamKey = rawKeys.find((k) => /team|member|owner|manager/.test(keyLower(k)) && !/wrestler/.test(keyLower(k))) ?? rawKeys[0];
  const wrestlerKey =
    rawKeys.find((k) => /wrestler|pick/.test(keyLower(k))) ??
    rawKeys.find((k) => keyLower(k) === "name" && rawKeys.indexOf(k) > 0) ??
    rawKeys[1];
  const contractKey = rawKeys.find((k) => /contract|years?|year/.test(keyLower(k)));

  const rosters: RostersByMember = {};

  for (const row of rows) {
    const teamRaw = row[teamKey] ?? rawKeys[0] ? row[rawKeys[0]] : "";
    const wrestlerRaw = row[wrestlerKey] ?? rawKeys[1] ? row[rawKeys[1]] : "";
    if (!teamRaw || !wrestlerRaw) continue;
    const member = matchMemberName(teamRaw);
    if (!member) continue;
    const contract = contractKey ? (row[contractKey] ?? undefined) : undefined;
    if (!rosters[member.slug]) rosters[member.slug] = [];
    rosters[member.slug].push({ name: String(wrestlerRaw).trim(), contract });
  }

  return rosters;
}

/**
 * Fetch and parse roster data from the Google Sheet.
 * Cached for CACHE_SECONDS. Returns empty rosters if URL not set or fetch fails.
 */
async function fetchRostersUncached(): Promise<RostersByMember> {
  if (!CSV_URL) return {};
  try {
    const csv = await fetchSheetCSV();
    return parseRosterCSV(csv);
  } catch (e) {
    console.warn("[rosters] Failed to fetch sheet:", e);
    return {};
  }
}

export async function getRostersFromSheet(): Promise<RostersByMember> {
  const { unstable_cache } = await import("next/cache");
  return unstable_cache(
    fetchRostersUncached,
    ["rosters-google-sheet"],
    { revalidate: CACHE_SECONDS }
  )();
}

/**
 * Fetch roster assignments from Supabase (in-app assignments).
 * Returns RostersByMember keyed by owner_slug. Wrestler names come from wrestler_id (slug); callers can resolve to display name.
 */
export async function getRostersFromSupabase(): Promise<RostersByMember> {
  try {
    const { supabase } = await import("@/lib/supabase");
    const { EXAMPLE_LEAGUE } = await import("./league");
    const { data, error } = await supabase
      .from("roster_assignments")
      .select("owner_slug, wrestler_id, contract")
      .eq("league_slug", EXAMPLE_LEAGUE.slug);
    if (error || !data) return {};
    const out: RostersByMember = {};
    for (const row of data as { owner_slug: string; wrestler_id: string; contract: string | null }[]) {
      if (!out[row.owner_slug]) out[row.owner_slug] = [];
      out[row.owner_slug].push({
        name: row.wrestler_id,
        contract: row.contract ?? undefined,
      });
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Get roster for one member by slug. Uses in-app roster assignments from Supabase only (no Google Sheet).
 */
export async function getRosterForMember(slug: string): Promise<RosterEntry[]> {
  const member = getMemberBySlug(slug);
  if (!member) return [];
  const supabaseRosters = await getRostersFromSupabase();
  return supabaseRosters[slug] ?? [];
}

/** Contract tier for display (section headers). */
export const CONTRACT_TIERS = [
  "Three Year Contracts",
  "Two Year Contracts",
  "One Year Contracts",
  "Other",
] as const;

function normalizeContract(raw: string | undefined): (typeof CONTRACT_TIERS)[number] {
  if (!raw || !String(raw).trim()) return "Other";
  const s = String(raw).trim().toLowerCase();
  if (/^3|three|3\s*yr|3\s*year/.test(s)) return "Three Year Contracts";
  if (/^2|two|2\s*yr|2\s*year/.test(s)) return "Two Year Contracts";
  if (/^1|one|1\s*yr|1\s*year/.test(s)) return "One Year Contracts";
  return "Other";
}

/** Group roster entries by contract tier for display. */
export function groupRosterByContract<T extends RosterEntry>(
  roster: T[]
): { tier: (typeof CONTRACT_TIERS)[number]; entries: T[] }[] {
  const groups: Record<string, T[]> = {
    "Three Year Contracts": [],
    "Two Year Contracts": [],
    "One Year Contracts": [],
    Other: [],
  };
  for (const entry of roster) {
    const tier = normalizeContract(entry.contract);
    groups[tier].push(entry);
  }
  return CONTRACT_TIERS.filter((t) => groups[t].length > 0).map((tier) => ({
    tier,
    entries: groups[tier],
  }));
}
