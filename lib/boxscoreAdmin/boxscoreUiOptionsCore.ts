import {
  SPECIAL_WINNER_OPTIONS,
  STIPULATION_OPTIONS,
} from "@/lib/boxscoreAdmin/boxscoreMatchOptions";

export type BoxscoreUiOptionCategory = "event_type" | "stipulation" | "special_winner";

/** Display labels for the optional Event type field (merged with DB). */
export const DEFAULT_EVENT_TYPE_LABELS = [
  "RAW",
  "SmackDown",
  "NXT",
  "Saturday Night's Main Event",
  "WrestleMania Night 1",
  "WrestleMania Night 2",
  "SummerSlam Night 1",
  "SummerSlam Night 2",
  "WrestleMania",
  "SummerSlam",
  "Survivor Series",
  "Royal Rumble",
  "Elimination Chamber",
  "Crown Jewel",
  "Night of Champions",
  "King & Queen of the Ring",
  "Money in the Bank",
  "Backlash",
  "Evolution",
  "Clash in Paris",
  "Clash in Italy",
  "WrestlePalooza",
  "Other / PLE",
] as const;

export function mergeWithDefaults(
  dbLabels: string[],
  defaults: readonly string[]
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of dbLabels) {
    const t = raw.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  for (const d of defaults) {
    const key = d.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(d);
  }
  return out;
}

/** If a stored value is not in the merged list (legacy/custom), surface it in the dropdown. */
export function ensureOptionInList(options: string[], value: string | null | undefined): string[] {
  const v = (value ?? "").trim();
  if (!v) return options;
  const key = v.toLowerCase();
  if (options.some((o) => o.toLowerCase() === key)) return options;
  return [v, ...options];
}

export type MergedBoxscoreUiOptions = {
  eventTypeLabels: string[];
  stipulationOptions: string[];
  specialWinnerOptions: string[];
};

export const FALLBACK_MERGED_BOXSCORE_UI_OPTIONS: MergedBoxscoreUiOptions = {
  eventTypeLabels: [...DEFAULT_EVENT_TYPE_LABELS],
  stipulationOptions: [...STIPULATION_OPTIONS],
  specialWinnerOptions: [...SPECIAL_WINNER_OPTIONS],
};
