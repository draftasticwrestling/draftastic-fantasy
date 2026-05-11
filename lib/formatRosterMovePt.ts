const PT = "America/Los_Angeles";

/**
 * Format a roster add/drop instant in Pacific Time for matchup transparency (FA 5:00 PM PT cutoff).
 * Prefer `acquired_at_ts` / `released_at_ts` from `league_rosters`; when missing, show calendar date only.
 */
export function formatRosterMoveDateTimePt(
  isoTs: string | null | undefined,
  ymdFallback: string | null | undefined
): string {
  if (isoTs) {
    const d = new Date(isoTs);
    if (!Number.isNaN(d.getTime())) {
      return (
        new Intl.DateTimeFormat("en-US", {
          timeZone: PT,
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }).format(d) + " PT"
      );
    }
  }
  const y = (ymdFallback ?? "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(y)) {
    const d = new Date(y + "T12:00:00.000Z");
    const datePart = new Intl.DateTimeFormat("en-US", {
      timeZone: PT,
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(d);
    return `${datePart} (time N/A)`;
  }
  return "—";
}

/** Lines under a wrestler on matchup pages (add/drop vs Mon–Sun week). */
export function matchupRosterTransactionLines(
  weekStartMonday: string,
  weekEndSunday: string,
  entry: {
    acquired_at?: string;
    released_at?: string | null;
    acquired_at_ts?: string | null;
    released_at_ts?: string | null;
  }
): string[] {
  const lines: string[] = [];
  const acqYmd = entry.acquired_at?.slice(0, 10);
  const relYmd = entry.released_at ? entry.released_at.slice(0, 10) : null;
  if (acqYmd && /^\d{4}-\d{2}-\d{2}$/.test(acqYmd)) {
    const when = formatRosterMoveDateTimePt(entry.acquired_at_ts, acqYmd);
    if (acqYmd < weekStartMonday) {
      lines.push(`On roster since ${when}`);
    } else if (acqYmd <= weekEndSunday) {
      lines.push(`Added ${when}`);
    }
  }
  if (
    relYmd &&
    /^\d{4}-\d{2}-\d{2}$/.test(relYmd) &&
    relYmd >= weekStartMonday &&
    relYmd <= weekEndSunday
  ) {
    lines.push(`Dropped ${formatRosterMoveDateTimePt(entry.released_at_ts, relYmd)}`);
  }
  return lines;
}
