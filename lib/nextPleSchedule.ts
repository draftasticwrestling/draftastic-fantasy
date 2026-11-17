import { classifyEventType, isNxtBrandEventType, isPLE } from "@/lib/scoring/parsers/eventClassifier.js";

export type PleScheduleRow = {
  id: string;
  name: string | null;
  date: string | null;
  status: string | null;
};

function eventDate(row: PleScheduleRow): string {
  return String(row.date ?? "").slice(0, 10);
}

function isCompleted(row: PleScheduleRow): boolean {
  return String(row.status ?? "").toLowerCase().trim() === "completed";
}

/**
 * Soonest premium live event on or after today.
 * Weekly TV (Raw, SmackDown, NXT, Main Event) is skipped.
 * NXT-brand PLEs are skipped when the league does not score NXT.
 */
export function pickNextPleOnSchedule(
  events: PleScheduleRow[],
  opts: { todayYmd: string; includeNxt: boolean }
): PleScheduleRow | null {
  const today = opts.todayYmd.slice(0, 10);
  const ples = events
    .filter((row) => {
      const date = eventDate(row);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today) return false;
      if (isCompleted(row)) return false;
      const eventType = classifyEventType(row.name ?? "", row.id);
      if (!isPLE(eventType)) return false;
      if (!opts.includeNxt && isNxtBrandEventType(eventType)) return false;
      return true;
    })
    .sort((a, b) => {
      const byDate = eventDate(a).localeCompare(eventDate(b));
      if (byDate !== 0) return byDate;
      const byName = String(a.name ?? "").localeCompare(String(b.name ?? ""));
      if (byName !== 0) return byName;
      return a.id.localeCompare(b.id);
    });
  return ples[0] ?? null;
}
