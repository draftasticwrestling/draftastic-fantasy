import { getSortedMatchesForEvent } from "@/components/boxscore-port/utils/eventMatchesOrder.js";
import { extractMatchParticipants, normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";

export type LeagueEventDayRow = {
  id: string;
  name: string | null;
  date: string | null;
  location?: string | null;
  matches: unknown;
  status?: string | null;
};

/** One show’s condensed hub card (filtered match orders) for the viewer’s roster. */
export type LeagueEventDayCondensedItem = {
  event: LeagueEventDayRow;
  allowedMatchOrders: number[];
  variant: "live" | "completed" | "upcoming";
};

function isMatchPromo(raw: Record<string, unknown>): boolean {
  const mt = String(raw.matchType || "").toLowerCase();
  const st = String(raw.stipulation || "").toLowerCase();
  return mt === "promo" || st === "promo";
}

export function eventPreviewVariantFromStatus(
  status: string | null | undefined
): "live" | "completed" | "upcoming" {
  const s = String(status || "").toLowerCase().trim();
  if (s === "live") return "live";
  if (s === "completed") return "completed";
  return "upcoming";
}

/**
 * Match `order` values (same as {@link getSortedMatchesForEvent} / hub condensed card) for non-promo
 * matches where at least one announced participant matches the manager's roster.
 */
export function buildRelevantMatchOrdersForRosterOnEvent(
  event: LeagueEventDayRow,
  rosterWrestlerIds: string[],
  wrestlerNameById: Record<string, string>
): number[] {
  const rosterIdSet = new Set(rosterWrestlerIds.map((id) => String(id).trim()).filter(Boolean));
  const normToDisplayName = new Map<string, string>();
  for (const id of rosterIdSet) {
    const name = wrestlerNameById[id];
    if (!name) continue;
    const k = normalizeWrestlerName(name);
    if (k) normToDisplayName.set(k, name.trim());
  }

  const orders: number[] = [];
  const sorted = getSortedMatchesForEvent(event);

  for (let i = 0; i < sorted.length; i++) {
    const raw = sorted[i] as Record<string, unknown>;
    if (isMatchPromo(raw)) continue;
    let participantsForScoring: string[] = [];
    try {
      const md = extractMatchParticipants(raw as never);
      participantsForScoring = md.participantsForScoring ?? [];
    } catch {
      continue;
    }
    const yourSet = new Set<string>();
    for (const p of participantsForScoring) {
      const pk = normalizeWrestlerName(String(p));
      const display = pk ? normToDisplayName.get(pk) : undefined;
      if (display) yourSet.add(display);
    }
    if (yourSet.size === 0) continue;
    orders.push(Number((raw.order as number) ?? i + 1));
  }
  return orders;
}
