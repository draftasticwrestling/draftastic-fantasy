/**
 * Read optional long-form fields from Boxscore-style `matches[]` JSON.
 * Keys vary by pipeline; we try several common names.
 */
export function pickRawString(raw: unknown, keys: string[]): string | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export function getMatchTabContent(raw: unknown): {
  summary: string | null;
  commentary: string | null;
  statistics: string | null;
} {
  return {
    summary: pickRawString(raw, [
      "summary",
      "Summary",
      "matchSummary",
      "recap",
      "Recap",
    ]),
    commentary: pickRawString(raw, [
      "commentary",
      "Commentary",
      "notes",
      "Notes",
    ]),
    statistics: pickRawString(raw, [
      "statistics",
      "Statistics",
      "stats",
      "Stats",
    ]),
  };
}
