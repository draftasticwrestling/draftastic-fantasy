import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_EVENT_TYPE_LABELS,
  FALLBACK_MERGED_BOXSCORE_UI_OPTIONS,
  type BoxscoreUiOptionCategory,
  type MergedBoxscoreUiOptions,
  mergeWithDefaults,
} from "@/lib/boxscoreAdmin/boxscoreUiOptionsCore";
import {
  SPECIAL_WINNER_OPTIONS,
  STIPULATION_OPTIONS,
} from "@/lib/boxscoreAdmin/boxscoreMatchOptions";

export type { BoxscoreUiOptionCategory, MergedBoxscoreUiOptions } from "@/lib/boxscoreAdmin/boxscoreUiOptionsCore";
export {
  DEFAULT_EVENT_TYPE_LABELS,
  ensureOptionInList,
  mergeWithDefaults,
  sortDropdownLabelsAlphabetically,
} from "@/lib/boxscoreAdmin/boxscoreUiOptionsCore";

export async function fetchBoxscoreUiOptionRows(
  admin: SupabaseClient,
  category: BoxscoreUiOptionCategory
): Promise<{ id: string; label: string; sort_order: number }[]> {
  const { data, error } = await admin
    .from("boxscore_ui_options")
    .select("id, label, sort_order")
    .eq("category", category)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; label: string; sort_order: number }[];
}

export async function getMergedBoxscoreUiOptions(admin: SupabaseClient | null): Promise<MergedBoxscoreUiOptions> {
  if (!admin) return FALLBACK_MERGED_BOXSCORE_UI_OPTIONS;
  try {
    const [et, st, sw] = await Promise.all([
      fetchBoxscoreUiOptionRows(admin, "event_type"),
      fetchBoxscoreUiOptionRows(admin, "stipulation"),
      fetchBoxscoreUiOptionRows(admin, "special_winner"),
    ]);
    return {
      eventTypeLabels: mergeWithDefaults(et.map((r) => r.label), DEFAULT_EVENT_TYPE_LABELS),
      stipulationOptions: mergeWithDefaults(st.map((r) => r.label), STIPULATION_OPTIONS, {
        pinFirst: ["None"],
        pinLast: ["Custom/Other"],
      }),
      specialWinnerOptions: mergeWithDefaults(sw.map((r) => r.label), SPECIAL_WINNER_OPTIONS, {
        pinFirst: ["None"],
      }),
    };
  } catch {
    return FALLBACK_MERGED_BOXSCORE_UI_OPTIONS;
  }
}
