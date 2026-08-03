import type { SupabaseClient } from "@supabase/supabase-js";
import { PARTNER_SUBSTITUTION_EVENT_LABEL } from "@/lib/championshipPartnerSubstitution";
import { INTERIM_CHAMPION_EVENT_LABEL } from "@/lib/championshipReignKind";

export function computeDaysHeld(dateWon: string, dateLost: string | null): number | null {
  if (!dateWon || !dateLost) return null;
  const start = new Date(dateWon);
  const end = new Date(dateLost);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff : null;
}

type HistoryRow = {
  id: string | number;
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
  reign_kind?: string | null;
};

function isOpenReign(row: HistoryRow): boolean {
  return row.date_lost == null || String(row.date_lost).trim() === "";
}

function pickSyncSourceRow(rows: HistoryRow[]): { latest: HistoryRow; prev: HistoryRow | null } {
  const open = rows.filter(isOpenReign);
  const interimOpen = open.filter(
    (r) => String(r.reign_kind ?? "").trim().toLowerCase() === "interim"
  );
  const preferredPool = interimOpen.length > 0 ? interimOpen : open.length > 0 ? open : rows;
  const sorted = [...preferredPool].sort((a, b) =>
    String(b.date_won ?? "").localeCompare(String(a.date_won ?? ""))
  );
  const latest = sorted[0]!;
  const rest = rows.filter((r) => r.id !== latest.id);
  const prev =
    rest.sort((a, b) => String(b.date_won ?? "").localeCompare(String(a.date_won ?? "")))[0] ??
    null;
  return { latest, prev };
}

/** Mirror PWBS: copy preferred open reign into `championships` current-champion fields. */
export async function syncChampionshipFromHistory(
  admin: SupabaseClient,
  championshipId: string
): Promise<{ error?: string }> {
  const { data: rows, error: historyError } = await admin
    .from("championship_history")
    .select(
      "id,championship_id,champion,champion_slug,previous_champion,previous_champion_slug,date_won,date_lost,event_name,reign_kind"
    )
    .eq("championship_id", championshipId)
    .order("date_won", { ascending: false });
  if (historyError) {
    // Older DBs without reign_kind: retry without the column.
    if (/reign_kind/i.test(historyError.message)) {
      const fallback = await admin
        .from("championship_history")
        .select(
          "id,championship_id,champion,champion_slug,previous_champion,previous_champion_slug,date_won,date_lost,event_name"
        )
        .eq("championship_id", championshipId)
        .order("date_won", { ascending: false });
      if (fallback.error) return { error: fallback.error.message };
      if (!fallback.data?.length) return {};
      const { latest, prev } = pickSyncSourceRow(fallback.data as HistoryRow[]);
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
    return { error: historyError.message };
  }
  if (!rows?.length) return {};

  const { latest, prev } = pickSyncSourceRow(rows as HistoryRow[]);

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
 * When recording a title change, close every open reign that isn't the incoming
 * champion+date (leftover open duplicates from prior double-submits included).
 */
export async function closeOpenReignForTitleChange(
  admin: SupabaseClient,
  championshipId: string,
  newDateWon: string,
  newEventWon: string | null,
  newChampion?: string | null
): Promise<{ error?: string }> {
  const { data: rows, error } = await admin
    .from("championship_history")
    .select("id,champion,date_won,date_lost")
    .eq("championship_id", championshipId)
    .order("date_won", { ascending: false });
  if (error) return { error: error.message };

  const openRows = ((rows ?? []) as HistoryRow[]).filter(isOpenReign);
  const newChampKey = String(newChampion ?? "")
    .trim()
    .toLowerCase();
  const newDateKey = String(newDateWon).slice(0, 10);

  for (const prev of openRows) {
    const sameChampion =
      newChampKey !== "" &&
      String(prev.champion ?? "")
        .trim()
        .toLowerCase() === newChampKey;
    const sameDate = String(prev.date_won ?? "").slice(0, 10) === newDateKey;
    if (sameChampion && sameDate) continue;

    const daysHeld = computeDaysHeld(String(prev.date_won ?? ""), newDateWon);
    const { error: updateErr } = await admin
      .from("championship_history")
      .update({
        date_lost: newDateWon,
        event_lost: newEventWon,
        days_held: daysHeld,
        reign_kind: null,
      })
      .eq("id", prev.id);
    if (updateErr) {
      if (/reign_kind/i.test(updateErr.message)) {
        const retry = await admin
          .from("championship_history")
          .update({
            date_lost: newDateWon,
            event_lost: newEventWon,
            days_held: daysHeld,
          })
          .eq("id", prev.id);
        if (retry.error) return { error: retry.error.message };
      } else {
        return { error: updateErr.message };
      }
    }
  }
  return {};
}

/**
 * Mark every currently open reign as inactive_injured (leave date_lost null)
 * so an interim champion can be inserted alongside them.
 */
export async function markOpenReignsInactiveInjured(
  admin: SupabaseClient,
  championshipId: string
): Promise<{ error?: string }> {
  const { data: rows, error } = await admin
    .from("championship_history")
    .select("id,date_lost,reign_kind")
    .eq("championship_id", championshipId);
  if (error) {
    if (/reign_kind/i.test(error.message)) {
      return { error: "Run supabase/championship_history_reign_kind.sql before recording interim champions." };
    }
    return { error: error.message };
  }

  const openRows = ((rows ?? []) as HistoryRow[]).filter(isOpenReign);
  for (const row of openRows) {
    const { error: updateErr } = await admin
      .from("championship_history")
      .update({ reign_kind: "inactive_injured" })
      .eq("id", row.id);
    if (updateErr) return { error: updateErr.message };
  }
  return {};
}

/**
 * Close every open reign except the sole champion (matched by name), clear their reign_kind.
 * Used when resolving an interim period back to a single champion.
 */
export async function resolveInterimToSoleChampion(
  admin: SupabaseClient,
  championshipId: string,
  soleChampion: string,
  resolveDate: string,
  resolveEvent: string | null
): Promise<{ error?: string }> {
  const soleKey = soleChampion.trim().toLowerCase();
  if (!soleKey) return { error: "Sole champion is required." };

  const { data: rows, error } = await admin
    .from("championship_history")
    .select("id,champion,date_won,date_lost,reign_kind")
    .eq("championship_id", championshipId)
    .order("date_won", { ascending: false });
  if (error) {
    if (/reign_kind/i.test(error.message)) {
      return { error: "Run supabase/championship_history_reign_kind.sql before resolving interim champions." };
    }
    return { error: error.message };
  }

  const openRows = ((rows ?? []) as HistoryRow[]).filter(isOpenReign);
  const survivor = openRows.find(
    (r) =>
      String(r.champion ?? "")
        .trim()
        .toLowerCase() === soleKey
  );
  if (!survivor) {
    return {
      error: `No open reign found for "${soleChampion}". Enter the exact champion name of the surviving open reign.`,
    };
  }

  for (const row of openRows) {
    if (row.id === survivor.id) {
      const { error: clearErr } = await admin
        .from("championship_history")
        .update({ reign_kind: null })
        .eq("id", row.id);
      if (clearErr) return { error: clearErr.message };
      continue;
    }
    const daysHeld = computeDaysHeld(String(row.date_won ?? ""), resolveDate);
    const { error: updateErr } = await admin
      .from("championship_history")
      .update({
        date_lost: resolveDate,
        event_lost: resolveEvent,
        days_held: daysHeld,
        reign_kind: null,
      })
      .eq("id", row.id);
    if (updateErr) return { error: updateErr.message };
  }
  return {};
}

/**
 * Close every open reign when a tag partner is replaced.
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
    .order("date_won", { ascending: false });
  if (error) return { error: error.message };

  const openRows = ((rows ?? []) as HistoryRow[]).filter(isOpenReign);
  for (const prev of openRows) {
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
  }
  return {};
}

/**
 * Keep the oldest row for each (champion, date_won) pair; delete the rest.
 * Heals duplicates left by React Strict Mode double-invoking server actions in dev.
 */
export async function dedupeChampionshipHistory(
  admin: SupabaseClient,
  championshipId: string
): Promise<{ error?: string; removed?: number }> {
  const { data: rows, error } = await admin
    .from("championship_history")
    .select("id,champion,date_won")
    .eq("championship_id", championshipId)
    .order("id", { ascending: true });
  if (error) return { error: error.message };

  const keepByKey = new Map<string, string | number>();
  const removeIds: Array<string | number> = [];
  for (const row of (rows ?? []) as HistoryRow[]) {
    const key = `${String(row.champion ?? "")
      .trim()
      .toLowerCase()}|${String(row.date_won ?? "").slice(0, 10)}`;
    if (!keepByKey.has(key)) {
      keepByKey.set(key, row.id);
    } else {
      removeIds.push(row.id);
    }
  }
  if (removeIds.length === 0) return { removed: 0 };

  const { error: delErr } = await admin.from("championship_history").delete().in("id", removeIds);
  if (delErr) return { error: delErr.message };
  return { removed: removeIds.length };
}

export { INTERIM_CHAMPION_EVENT_LABEL };
