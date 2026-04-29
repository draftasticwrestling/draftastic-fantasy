import "server-only";

import { createClient } from "@/lib/supabase/server";
import { classifyEventType, isPLE } from "@/lib/scoring/parsers/eventClassifier.js";
import type { UpcomingMatch } from "@/lib/pleUpcoming";

export type PleEventRow = {
  id: string;
  name: string;
  date: string;
  location: string | null;
  updated_at: string | null;
  matches: unknown[];
};

function matchToUpcomingMatch(
  match: Record<string, unknown>,
  eventId: string,
  order: number
): UpcomingMatch {
  const title = (match.title ?? match.matchType ?? "") as string;
  const participants = (match.participants ?? match.result ?? "") as string;
  const result = (match.result ?? "") as string;
  const formattedParticipants = formatParticipants(participants || result);
  const titlePart = title?.trim() ? `${title.trim()}: ` : "";
  const label = formattedParticipants ? `${titlePart}${formattedParticipants}` : titlePart || `Match ${order}`;
  const participantSlugs = parseParticipantSlugs(participants || result);
  return { label: label.trim() || `Match ${order}`, eventId, order, participantSlugs, raw: match };
}

function slugToName(slug: string): string {
  if (!slug || typeof slug !== "string") return slug;
  return slug
    .trim()
    .split(/[-.\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function formatParticipants(participants: string | null | undefined): string {
  if (!participants || typeof participants !== "string") return "TBD";
  return participants
    .split(/\s+vs\.?\s+/i)
    .map((s) => slugToName(s.trim()))
    .join(" vs. ");
}

function parseParticipantSlugs(participants: string | null | undefined): string[] {
  if (!participants || typeof participants !== "string") return [];
  return participants
    .split(/\s+vs\.?\s+/i)
    .map((s) => s.trim().toLowerCase().replace(/\s+/g, "-"))
    .filter(Boolean);
}

/**
 * Load scored/live events on the given calendar dates; prefer rows that classify as a PLE.
 */
export async function fetchPleEventsOnDates(dates: string[]): Promise<PleEventRow[]> {
  if (dates.length === 0) return [];
  const supabase = await createClient();
  const primary = await supabase
    .from("events")
    .select("id, name, date, location, updated_at, matches")
    .in("date", dates)
    .order("date", { ascending: true });

  let data = primary.data;
  let error = primary.error;

  // Be resilient to environments where `events.updated_at` is not present yet.
  if (error) {
    const fallback = await supabase
      .from("events")
      .select("id, name, date, location, matches")
      .in("date", dates)
      .order("date", { ascending: true });
    data = fallback.data as typeof data;
    error = fallback.error;
  }

  if (error || !data?.length) return [];

  const rows = data as {
    id: string;
    name: string | null;
    date: string | null;
    location: string | null;
    updated_at: string | null;
    matches: unknown;
  }[];
  const out: PleEventRow[] = [];
  for (const d of dates) {
    const onDay = rows.filter((r) => (r.date ?? "").slice(0, 10) === d);
    const pleRow =
      onDay.find((r) => isPLE(classifyEventType(r.name ?? "", r.id))) ?? onDay[0];
    if (pleRow?.id) {
      out.push({
        id: pleRow.id,
        name: pleRow.name ?? "Event",
        date: (pleRow.date ?? d).slice(0, 10),
        location: pleRow.location ?? null,
        updated_at: pleRow.updated_at ?? null,
        matches: Array.isArray(pleRow.matches) ? pleRow.matches : [],
      });
    }
  }
  return out;
}

export function matchesFromEventRow(row: PleEventRow): UpcomingMatch[] {
  const rawMatches = Array.isArray(row.matches) ? row.matches : [];
  return rawMatches
    .filter((m): m is Record<string, unknown> => m != null && typeof m === "object")
    .map((m, i) => matchToUpcomingMatch(m, row.id, (m.order as number) ?? i + 1));
}

