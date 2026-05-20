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

export type DropdownSortPins = {
  /** Kept at top in this order (e.g. stipulation "None"). */
  pinFirst?: readonly string[];
  /** Kept at bottom in this order (e.g. stipulation "Custom/Other"). */
  pinLast?: readonly string[];
};

function normLabelKey(label: string): string {
  return label.trim().toLowerCase();
}

/** Case-insensitive A–Z; pinned labels stay first/last (PWBS-style sentinels). */
export function sortDropdownLabelsAlphabetically(
  labels: string[],
  pins?: DropdownSortPins
): string[] {
  const pinFirst = pins?.pinFirst ?? [];
  const pinLast = pins?.pinLast ?? [];
  const used = new Set<string>();
  const first: string[] = [];
  const last: string[] = [];

  for (const pin of pinFirst) {
    const match = labels.find((l) => normLabelKey(l) === normLabelKey(pin));
    if (match) {
      first.push(match);
      used.add(normLabelKey(match));
    }
  }
  for (const pin of pinLast) {
    const match = labels.find((l) => normLabelKey(l) === normLabelKey(pin));
    if (match) {
      last.push(match);
      used.add(normLabelKey(match));
    }
  }

  const middle = labels.filter((l) => !used.has(normLabelKey(l)));
  middle.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  return [...first, ...middle, ...last];
}

export function mergeWithDefaults(
  dbLabels: string[],
  defaults: readonly string[],
  sortPins?: DropdownSortPins
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of dbLabels) {
    const t = raw.trim();
    if (!t) continue;
    const key = normLabelKey(t);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  for (const d of defaults) {
    const key = normLabelKey(d);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(d);
  }
  return sortDropdownLabelsAlphabetically(out, sortPins);
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
  eventTypeLabels: sortDropdownLabelsAlphabetically([...DEFAULT_EVENT_TYPE_LABELS]),
  stipulationOptions: sortDropdownLabelsAlphabetically([...STIPULATION_OPTIONS], {
    pinFirst: ["None"],
    pinLast: ["Custom/Other"],
  }),
  specialWinnerOptions: sortDropdownLabelsAlphabetically([...SPECIAL_WINNER_OPTIONS], {
    pinFirst: ["None"],
  }),
};
