/** Sunday YYYY-MM-DD for fantasy week (weekStart is Monday YYYY-MM-DD; same UTC-noon calendar math as matchups). */
function getSundayOfWeekFromMonday(weekStart: string): string {
  const d = new Date(weekStart + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

const FANTASY_WEEK_LABEL_TZ = "America/Los_Angeles";

/** Human-readable Mon–Sun range for the fantasy week (week keys align with Mon–Sun Pacific fantasy weeks). */
export function formatFantasyWeekRangeLabel(weekStartMonday: string): string {
  const end = getSundayOfWeekFromMonday(weekStartMonday);
  try {
    const s = new Date(`${weekStartMonday}T12:00:00Z`);
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
    return `${weekStartMonday} – ${end}`;
  }
}
