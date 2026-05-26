import type { SupabaseClient } from "@supabase/supabase-js";
import { PARTNER_SUBSTITUTION_EVENT_LABEL } from "@/lib/championshipPartnerSubstitution";

export function computeDaysHeld(dateWon: string, dateLost: string | null): number | null {
  if (!dateWon || !dateLost) return null;
  const start = new Date(dateWon);
  const end = new Date(dateLost);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff : null;
}

type HistoryRow = {
  id: string;
  championship_id: string;
  champion?: string | null;
  champion_slug?: string | null;
  previous_champion?: string | null;
  previous_champion_slug?: string | null;
  date_won?: string | null;
  date_lost?: string | null;
  event_name?: string | null;
  event_lost?: string | null;
  days_held?: number | null;
};

/** Mirror PWBS: copy latest reign into `championships` current-champion fields. */
export async function syncChampionshipFromHistory(
  admin: SupabaseClient,
  championshipId: string
): Promise<{ error?: string }> {
  const { data: rows, error: historyError } = await admin
    .from("championship_history")
    .select(
      "id,championship_id,champion,champion_slug,previous_champion,previous_champion_slug,date_won,date_lost,event_name"
    )
    .eq("championship_id", championshipId)
    .order("date_won", { ascending: false });
  if (historyError) return { error: historyError.message };
  if (!rows?.length) return {};

  const latest = rows[0] as HistoryRow;
  const prev = (rows[1] as HistoryRow | undefined) ?? null;

  const { error: champUpdateError } = await admin
    .from("championships")
    .update({
      current_champion: latest.champion ?? null,
      current_champion_slug: latest.champion_slug ?? null,
      previous_champion: latest.previous_champion ?? prev?.champion ?? null,
      previous_champion_slug: latest.previous_champion_slug ?? prev?.champion_slug ?? null,
      date_won: latest.date_won ?? null,
      event_name: latest.event_name ?? null,
    })
    .eq("id", championshipId);
  if (champUpdateError) return { error: champUpdateError.message };
  return {};
}

/**
 * When recording a title change, close the prior open reign (no date_lost) before inserting the new one.
 */
export async function closeOpenReignForTitleChange(
  admin: SupabaseClient,
  championshipId: string,
  newDateWon: string,
  newEventWon: string | null
): Promise<{ error?: string }> {
  const { data: rows, error } = await admin
    .from("championship_history")
    .select("id,date_won,date_lost")
    .eq("championship_id", championshipId)
    .order("date_won", { ascending: false })
    .limit(1);
  if (error) return { error: error.message };
  const prev = (rows?.[0] as HistoryRow | undefined) ?? null;
  if (!prev || (prev.date_lost != null && String(prev.date_lost).trim() !== "")) return {};

  const daysHeld = computeDaysHeld(String(prev.date_won ?? ""), newDateWon);
  const { error: updateErr } = await admin
    .from("championship_history")
    .update({
      date_lost: newDateWon,
      event_lost: newEventWon,
      days_held: daysHeld,
    })
    .eq("id", prev.id);
  if (updateErr) return { error: updateErr.message };
  return {};
}

/**
 * Close the open reign when a tag partner is replaced. Same date boundaries as a title change,
 * but Event lost is labeled so history does not read as losing the belt in a match.
 */
export async function closeOpenReignForPartnerSubstitution(
  admin: SupabaseClient,
  championshipId: string,
  substitutionDate: string
): Promise<{ error?: string }> {
  const { data: rows, error } = await admin
    .from("championship_history")
    .select("id,date_won,date_lost")
    .eq("championship_id", championshipId)
    .order("date_won", { ascending: false })
    .limit(1);
  if (error) return { error: error.message };
  const prev = (rows?.[0] as HistoryRow | undefined) ?? null;
  if (!prev || (prev.date_lost != null && String(prev.date_lost).trim() !== "")) return {};

  const daysHeld = computeDaysHeld(String(prev.date_won ?? ""), substitutionDate);
  const { error: updateErr } = await admin
    .from("championship_history")
    .update({
      date_lost: substitutionDate,
      event_lost: PARTNER_SUBSTITUTION_EVENT_LABEL,
      days_held: daysHeld,
    })
    .eq("id", prev.id);
  if (updateErr) return { error: updateErr.message };
  return {};
}
