/**
 * Upcoming PLE data from Supabase (same source as prowrestlingboxscore.com).
 * Events and matches are stored in the `events` table; we query by date and name.
 */

import { createClient } from "@/lib/supabase/server";
import { classifyEventType } from "@/lib/scoring/parsers/eventClassifier.js";

export type UpcomingMatch = {
  /** Human-readable label, e.g. "WWE Championship: Cody Rhodes vs. Randy Orton" */
  label: string;
  /** Event id this match belongs to (for future points lookup) */
  eventId: string;
  /** Match order within the event */
  order: number;
  /** Participant wrestler slugs (lowercase) for roster matching, e.g. ["cody-rhodes", "randy-orton"] */
  participantSlugs: string[];
  /** Raw match object for scoring when event is completed */
  raw?: Record<string, unknown>;
};

export type UpcomingPleEvent = {
  id: string;
  name: string;
  date: string;
  location: string | null;
  eventType: string;
  matches: UpcomingMatch[];
};

/** Slug to readable name: "cody-rhodes" -> "Cody Rhodes" */
function slugToName(slug: string): string {
  if (!slug || typeof slug !== "string") return slug;
  return slug
    .trim()
    .split(/[-.\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Format participants string: "sami-zayn vs. bronson-reed" -> "Sami Zayn vs. Bronson Reed" */
function formatParticipants(participants: string | null | undefined): string {
  if (!participants || typeof participants !== "string") return "TBD";
  return participants
    .split(/\s+vs\.?\s+/i)
    .map((s) => slugToName(s.trim()))
    .join(" vs. ");
}

/** Parse participants string into lowercase slugs for roster matching. */
function parseParticipantSlugs(participants: string | null | undefined): string[] {
  if (!participants || typeof participants !== "string") return [];
  return participants
    .split(/\s+vs\.?\s+/i)
    .map((s) => s.trim().toLowerCase().replace(/\s+/g, "-"))
    .filter(Boolean);
}

/** Build a single match label from raw match object (Boxscore shape). */
function matchToLabel(match: Record<string, unknown>, eventId: string, order: number): UpcomingMatch {
  const title = (match.title ?? match.matchType ?? "") as string;
  const participants = (match.participants ?? match.result ?? "") as string;
  const result = (match.result ?? "") as string;
  const formattedParticipants = formatParticipants(participants || result);
  const titlePart = title?.trim() ? `${title.trim()}: ` : "";
  const label = formattedParticipants ? `${titlePart}${formattedParticipants}` : titlePart || `Match ${order}`;
  const participantSlugs = parseParticipantSlugs(participants || result);
  return { label: label.trim() || `Match ${order}`, eventId, order, participantSlugs, raw: match };
}

/**
 * Fetch upcoming WrestleMania events (date >= today) from Supabase.
 * Returns events with matches; match labels are built from title + participants.
 * Data is the same as shown on prowrestlingboxscore.com (they read from the same Supabase project).
 */
export async function getUpcomingWrestleManiaEvents(): Promise<UpcomingPleEvent[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: rows, error } = await supabase
    .from("events")
    .select("id, name, date, location, matches")
    .gte("date", today)
    .ilike("name", "%wrestlemania%")
    .order("date", { ascending: true });

  if (error || !rows?.length) return [];

  const events = (rows ?? []) as { id: string; name: string; date: string; location: string | null; matches: unknown[] }[];
  const out: UpcomingPleEvent[] = [];

  for (const ev of events) {
    const eventType = classifyEventType(ev.name, ev.id) ?? "unknown";
    const rawMatches = Array.isArray(ev.matches) ? ev.matches : [];
    const matches: UpcomingMatch[] = rawMatches
      .filter((m): m is Record<string, unknown> => m != null && typeof m === "object")
      .map((m, i) => matchToLabel(m, ev.id, (m.order as number) ?? i + 1));

    out.push({
      id: ev.id,
      name: ev.name,
      date: ev.date,
      location: ev.location ?? null,
      eventType,
      matches,
    });
  }

  return out;
}

/** Format event date for display (e.g. "Saturday, April 5, 2026"). */
export function formatPleDate(dateStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}
