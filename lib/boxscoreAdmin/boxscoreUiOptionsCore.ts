import {
  SPECIAL_WINNER_OPTIONS,
  STIPULATION_OPTIONS,
} from "@/lib/boxscoreAdmin/boxscoreMatchOptions";

export type BoxscoreUiOptionCategory = "event_type" | "stipulation" | "special_winner";

/**
 * Default event-type labels aligned with PWBS AddEvent (`App.jsx` EVENT_TYPES).
 * DB rows in boxscore_ui_options merge on top; these fill gaps (e.g. NXT PLEs).
 */
export const DEFAULT_EVENT_TYPE_LABELS = [
  "RAW",
  "SmackDown",
  "WWE NXT",
  "NXT Stand and Deliver",
  "NXT Deadline",
  "NXT Battleground",
  "NXT The Great American Bash",
  "NXT No Mercy",
  "NXT Halloween Havoc",
  "NXT Heatwave",
  "NXT Vengeance Day",
  "NXT New Year's Evil",
  "NXT Showdown",
  "NXT Gold Rush",
  "NXT Roadblock",
  "NXT Homecoming",
  "NXT Revenge",
  "Backlash",
  "Bad Blood",
  "Clash in Paris",
  "Clash in Italy",
  "Crown Jewel",
  "Elimination Chamber",
  "Evolution",
  "Money in the Bank",
  "Night of Champions",
  "Royal Rumble",
  "Saturday Night's Main Event",
  "Summer Slam night 1",
  "Summer Slam night 2",
  "Survivor Series",
  "WrestleMania night 1",
  "WrestleMania night 2",
  "Wrestlepalooza",
] as const;

export const LOCATION_PLACEHOLDER = "e.g. Dallas, TX";
export const LOCATION_HELPER =
  "City and state only — do not include the arena or venue name (matches PWBS).";

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
