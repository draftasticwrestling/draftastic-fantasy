import { getSundayOfWeek } from "@/lib/leagueMatchups";

/** Human-readable Mon–Sun range for the fantasy week (dates are YYYY-MM-DD league week keys). */
export function formatFantasyWeekRangeLabel(weekStartMonday: string): string {
  const end = getSundayOfWeek(weekStartMonday);
  try {
    const s = new Date(`${weekStartMonday}T12:00:00Z`);
    const e = new Date(`${end}T12:00:00Z`);
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "UTC" };
    const y = s.getUTCFullYear();
    const y2 = e.getUTCFullYear();
    const a = s.toLocaleDateString("en-US", opts);
    const b = e.toLocaleDateString("en-US", { ...opts, year: y !== y2 ? "numeric" : undefined });
    if (y !== y2) {
      return `${a}, ${y} – ${b}, ${y2}`;
    }
    return `${a} – ${b}, ${y}`;
  } catch {
    return `${weekStartMonday} – ${end}`;
  }
}
