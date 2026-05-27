import { getWeekEndForWeekStart } from "@/lib/fantasyWeekBounds";

/** Sunday YYYY-MM-DD for fantasy week (weekStart is Monday YYYY-MM-DD; same UTC-noon calendar math as matchups). */
function getSundayOfWeekFromMonday(weekStart: string): string {
  const d = new Date(weekStart + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

const FANTASY_WEEK_LABEL_TZ = "America/Los_Angeles";

function fantasyWeekEnd(weekStart: string, leagueStart?: string | null): string {
  if (leagueStart) {
    return getWeekEndForWeekStart(weekStart, leagueStart);
  }
  return getSundayOfWeekFromMonday(weekStart);
}

/** Human-readable range for a fantasy week (Mon–Sun, or Fri–Sun for Championship Pathway week 1). */
export function formatFantasyWeekRangeLabel(
  weekStart: string,
  leagueStart?: string | null
): string {
  const end = fantasyWeekEnd(weekStart, leagueStart);
  try {
    const s = new Date(`${weekStart}T12:00:00Z`);
    const e = new Date(`${end}T12:00:00Z`);
    const md: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: FANTASY_WEEK_LABEL_TZ };
    const yFmt = new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: FANTASY_WEEK_LABEL_TZ });
    const a = new Intl.DateTimeFormat("en-US", md).format(s);
    const b = new Intl.DateTimeFormat("en-US", md).format(e);
    const ys = yFmt.format(s);
    const ye = yFmt.format(e);
    if (ys !== ye) {
      return `${a}, ${ys} – ${b}, ${ye}`;
    }
    return `${a} – ${b}, ${ys}`;
  } catch {
    return `${weekStart} – ${end}`;
  }
}
