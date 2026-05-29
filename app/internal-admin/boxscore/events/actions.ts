"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSiteAdmin } from "@/lib/auth/siteAdmin";
import {
  buildBoxscoreEventId,
  normalizeEventDateInput,
  sanitizeBoxscoreEventForSupabase,
} from "@/lib/boxscoreAdmin/eventPayload";
import { applyResultRegenerationToMatches } from "@/lib/boxscoreAdmin/regenerateSpecialMatchResults";
import { buildEventResultsSlug } from "@/lib/event-results/eventResultsRoute";
import { notifyEventScoresPublished } from "@/lib/email/leagueNotifications";
import { scheduleTransactionalEmail } from "@/lib/email/scheduleTransactionalEmail";
import { getAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export type InsertBoxscoreEventState = { error?: string } | null;
export type UpdateBoxscoreEventState = { error?: string } | null;
export type DeleteBoxscoreEventState = { error?: string } | null;

function parseMatchesJson(raw: string): { ok: true; matches: unknown[] } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, matches: [] };
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) {
      return { ok: false, error: "Matches must be a JSON array." };
    }
    return { ok: true, matches: parsed };
  } catch {
    return { ok: false, error: "Matches JSON is invalid." };
  }
}

function hasMatchParticipants(row: Record<string, unknown>): boolean {
  const p = row.participants;
  if (Array.isArray(p)) return p.length > 0;
  if (typeof p === "string") return p.trim().length > 0;
  return false;
}

function hasMatchResult(row: Record<string, unknown>): boolean {
  return !!(row.result && String(row.result).trim());
}

/** PWBS AddEvent `handleSaveEvent` — completed/live card validation. */
function matchesPassAddEventRules(
  matches: unknown[],
  status: string
): { ok: true } | { ok: false; error: string } {
  if (status !== "completed" && status !== "live") return { ok: true };
  if (!matches.length) {
    return {
      ok: false,
      error: "Completed or live events need at least one match. Use Upcoming to create an empty card, or paste a matches JSON array.",
    };
  }

  const invalidMatch = matches.some((m) => {
    if (!m || typeof m !== "object") return true;
    const row = m as Record<string, unknown>;
    if (row.matchType === "Promo") return false;
    if (!hasMatchParticipants(row)) return true;
    const matchType = String(row.matchType ?? "");
    if (
      matchType === "Gauntlet Match" ||
      matchType === "Tag Team Gauntlet Match" ||
      matchType === "2 out of 3 Falls"
    ) {
      const prog = row.gauntletProgression;
      if (Array.isArray(prog) && prog.length > 0) return !hasMatchResult(row);
      return false;
    }
    return !row.method || String(row.method).trim() === "" || !hasMatchResult(row);
  });

  if (invalidMatch) {
    return { ok: false, error: "Please fill out all required match fields for completed events." };
  }
  return { ok: true };
}

/** PWBS EditEvent `handleSaveEvent` — only requires ≥1 match when completed/live. */
function matchesPassEditEventRules(
  matches: unknown[],
  status: string
): { ok: true } | { ok: false; error: string } {
  if (status !== "completed" && status !== "live") return { ok: true };
  if (!matches.length) {
    return {
      ok: false,
      error: "Completed or live events need at least one match. Use Upcoming to create an empty card, or paste a matches JSON array.",
    };
  }
  return { ok: true };
}

function parseSpecialWinnerFromForm(formData: FormData): { type: string; name: string } | undefined {
  const type = (formData.get("special_winner_type") ?? "None").toString().trim();
  const name = (formData.get("special_winner_name") ?? "").toString().trim();
  if (type !== "None" && name) return { type, name };
  return undefined;
}

function isMissingEventsColumn(message: string, column: string): boolean {
  const m = message.toLowerCase();
  const col = column.toLowerCase();
  return m.includes(col) && (m.includes("schema cache") || m.includes("column") || m.includes("does not exist"));
}

async function prepareMatchesForEventSave(
  admin: SupabaseClient,
  matches: unknown[],
  status: string
): Promise<Record<string, unknown>[]> {
  const { data: wrestlers } = await admin.from("wrestlers").select("id, name");
  return applyResultRegenerationToMatches(matches, wrestlers ?? [], status);
}

async function persistEventRow(
  admin: SupabaseClient,
  mode: "insert" | "update",
  sanitized: Record<string, unknown>,
  eventId?: string
) {
  const payload = { ...sanitized };
  const run = () =>
    mode === "insert"
      ? admin.from("events").insert(payload)
      : admin.from("events").update(payload).eq("id", eventId!);

  let res = await run();
  if (!res.error) return res;

  const msg = res.error.message ?? "";
  if (isMissingEventsColumn(msg, "specialWinner") && "specialWinner" in payload) {
    delete payload.specialWinner;
    res = await run();
    if (!res.error) return res;
  }
  if (isMissingEventsColumn(res.error?.message ?? msg, "isLive") && "isLive" in payload) {
    delete payload.isLive;
    res = await run();
  }
  return res;
}

export async function insertBoxscoreEventAction(
  _prev: InsertBoxscoreEventState,
  formData: FormData
): Promise<InsertBoxscoreEventState> {
  const { user } = await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) {
    return { error: "Server is not configured with SUPABASE_SERVICE_ROLE_KEY." };
  }

  const submittedName = (formData.get("name") ?? "").toString().trim();
  const dateRaw = (formData.get("date") ?? "").toString().trim();
  const location = (formData.get("location") ?? "").toString().trim();
  const preview = (formData.get("preview") ?? "").toString().trim();
  const recap = (formData.get("recap") ?? "").toString().trim();
  const status = (formData.get("status") ?? "upcoming").toString().trim();
  const matchesRaw = (formData.get("matches_json") ?? "").toString();
  const customId = (formData.get("custom_id") ?? "").toString().trim();
  const broadcastTsRaw = (formData.get("broadcast_start_ts") ?? "").toString().trim();
  const eventType = (formData.get("event_type") ?? "").toString().trim();
  const name = eventType || submittedName;

  if (!eventType) return { error: "Event type is required." };
  if (!name) return { error: "Event name is required." };
  const date = normalizeEventDateInput(dateRaw);
  if (!date) return { error: "Enter a valid date (YYYY-MM-DD)." };
  if (!location) return { error: "Location is required." };

  if (status !== "upcoming" && status !== "completed" && status !== "live") {
    return { error: "Invalid status." };
  }

  const parsedMatches = parseMatchesJson(matchesRaw);
  if (!parsedMatches.ok) return { error: parsedMatches.error };

  const matchRules = matchesPassAddEventRules(parsedMatches.matches, status);
  if (!matchRules.ok) return { error: matchRules.error };

  const preparedMatches = await prepareMatchesForEventSave(admin, parsedMatches.matches, status);
  const specialWinner = parseSpecialWinnerFromForm(formData);

  let broadcast_start_ts: string | null = null;
  let broadcast_start_ts_source: string | null = null;
  if (broadcastTsRaw) {
    const d = new Date(broadcastTsRaw);
    if (Number.isNaN(d.getTime())) {
      return { error: "Broadcast start is not a valid date/time." };
    }
    broadcast_start_ts = d.toISOString();
    broadcast_start_ts_source = "manual";
  }

  const id = customId || buildBoxscoreEventId(name, date);

  const rowInput: Record<string, unknown> = {
    id,
    name,
    date,
    location,
    preview,
    recap,
    matches: preparedMatches,
    status,
    isLive: status === "live",
    broadcast_start_ts,
    broadcast_start_ts_source,
    event_type: eventType || null,
    ...(specialWinner ? { specialWinner } : {}),
  };

  const sanitized = sanitizeBoxscoreEventForSupabase(rowInput);

  const { error: insErr } = await persistEventRow(admin, "insert", sanitized);

  if (insErr) {
    if (insErr.code === "23505") {
      return { error: "An event with this id already exists. Change the name/date or clear the custom id and try again." };
    }
    return { error: insErr.message };
  }

  try {
    await admin.from("admin_audit_log").insert({
      actor_user_id: user.id,
      action: "create",
      entity_type: "boxscore_event",
      entity_id: id,
      payload_json: { name, date, status, match_count: parsedMatches.matches.length },
    });
  } catch {
    // Table may be missing in some environments; insert already succeeded.
  }

  if (status === "completed") {
    scheduleTransactionalEmail(() => notifyEventScoresPublished({ eventId: id, name, date }));
  }

  const resultsSlug = buildEventResultsSlug({ id, name, date });
  const editPathSegment = encodeURIComponent(resultsSlug);

  revalidatePath("/event-results");
  revalidatePath(`/event-results/${editPathSegment}`);
  revalidatePath(`/event-results/${encodeURIComponent(id)}`);
  revalidatePath("/internal-admin/events");
  revalidatePath(`/internal-admin/events/${encodeURIComponent(id)}`);
  revalidatePath("/internal-admin/boxscore/events");
  revalidatePath(`/internal-admin/boxscore/events/${editPathSegment}/edit`);
  revalidatePath(`/internal-admin/boxscore/events/${encodeURIComponent(id)}/edit`);

  redirect(`/internal-admin/boxscore/events/${editPathSegment}/edit?created=1`);
}

export async function updateBoxscoreEventAction(
  _prev: UpdateBoxscoreEventState,
  formData: FormData
): Promise<UpdateBoxscoreEventState> {
  const { user } = await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) {
    return { error: "Server is not configured with SUPABASE_SERVICE_ROLE_KEY." };
  }

  const eventId = (formData.get("event_id") ?? "").toString().trim();
  if (!eventId) return { error: "Missing event id." };

  const { data: existingRow, error: exErr } = await admin
    .from("events")
    .select("id, status")
    .eq("id", eventId)
    .maybeSingle();
  if (exErr) return { error: exErr.message };
  if (!existingRow) return { error: "Event not found." };

  const submittedName = (formData.get("name") ?? "").toString().trim();
  const dateRaw = (formData.get("date") ?? "").toString().trim();
  const location = (formData.get("location") ?? "").toString().trim();
  const preview = (formData.get("preview") ?? "").toString().trim();
  const recap = (formData.get("recap") ?? "").toString().trim();
  const status = (formData.get("status") ?? "upcoming").toString().trim();
  const matchesRaw = (formData.get("matches_json") ?? "").toString();
  const broadcastTsRaw = (formData.get("broadcast_start_ts") ?? "").toString().trim();
  const eventType = (formData.get("event_type") ?? "").toString().trim();
  const name = eventType || submittedName;

  if (!eventType) return { error: "Event type is required." };
  if (!name) return { error: "Event name is required." };
  const date = normalizeEventDateInput(dateRaw);
  if (!date) return { error: "Enter a valid date (YYYY-MM-DD)." };
  if (!location) return { error: "Location is required." };

  if (status !== "upcoming" && status !== "completed" && status !== "live") {
    return { error: "Invalid status." };
  }

  const parsedMatches = parseMatchesJson(matchesRaw);
  if (!parsedMatches.ok) return { error: parsedMatches.error };

  const matchRules = matchesPassEditEventRules(parsedMatches.matches, status);
  if (!matchRules.ok) return { error: matchRules.error };

  const preparedMatches = await prepareMatchesForEventSave(admin, parsedMatches.matches, status);

  let broadcast_start_ts: string | null = null;
  let broadcast_start_ts_source: string | null = null;
  if (broadcastTsRaw) {
    const d = new Date(broadcastTsRaw);
    if (Number.isNaN(d.getTime())) {
      return { error: "Broadcast start is not a valid date/time." };
    }
    broadcast_start_ts = d.toISOString();
    broadcast_start_ts_source = "manual";
  }

  const rowInput: Record<string, unknown> = {
    id: eventId,
    name,
    date,
    location,
    preview,
    recap,
    matches: preparedMatches,
    status,
    isLive: status === "live",
    broadcast_start_ts,
    broadcast_start_ts_source,
    event_type: eventType || null,
  };

  const sanitized = sanitizeBoxscoreEventForSupabase(rowInput);

  const { error: upErr } = await persistEventRow(admin, "update", sanitized, eventId);

  if (upErr) return { error: upErr.message };

  const previousStatus = String((existingRow as { status?: string | null }).status ?? "").trim();
  const becameCompleted = status === "completed" && previousStatus !== "completed";

  try {
    await admin.from("admin_audit_log").insert({
      actor_user_id: user.id,
      action: "update",
      entity_type: "boxscore_event",
      entity_id: eventId,
      payload_json: { name, date, status, match_count: parsedMatches.matches.length },
    });
  } catch {
    // optional table
  }

  if (becameCompleted) {
    scheduleTransactionalEmail(() => notifyEventScoresPublished({ eventId, name, date }));
  }

  revalidateAfterEventMatchesChange(eventId, name, date);

  const resultsSlug = buildEventResultsSlug({ id: eventId, name, date });
  redirect(`/internal-admin/boxscore/events/${encodeURIComponent(resultsSlug)}/edit?saved=1`);
}

function revalidateAfterEventMatchesChange(eventId: string, name?: string | null, date?: string | null) {
  const resultsSlug = buildEventResultsSlug({ id: eventId, name: name ?? undefined, date: date ?? undefined });
  const editPathSegment = encodeURIComponent(resultsSlug);
  revalidatePath("/event-results");
  revalidatePath(`/event-results/${editPathSegment}`);
  revalidatePath(`/event-results/${encodeURIComponent(eventId)}`);
  revalidatePath("/internal-admin/events");
  revalidatePath(`/internal-admin/events/${encodeURIComponent(eventId)}`);
  revalidatePath("/internal-admin/boxscore/events");
  revalidatePath(`/internal-admin/boxscore/events/${editPathSegment}/edit`);
  revalidatePath(`/internal-admin/boxscore/events/${encodeURIComponent(eventId)}/edit`);
}

/**
 * PWBS `onEditMatch` / EventBoxScore `handleSaveMatch` — persist card to Supabase immediately
 * so completed matches appear on the public site without waiting for Save Event.
 */
export async function persistEventMatchesAction(
  eventId: string,
  matches: unknown[]
): Promise<{ error?: string; ok?: boolean }> {
  await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) return { error: "Service role not configured." };

  const id = eventId.trim();
  if (!id) return { error: "Missing event id." };
  if (!Array.isArray(matches)) return { error: "Matches must be an array." };

  const { data: row, error: fetchErr } = await admin
    .from("events")
    .select("id, name, date, status")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) return { error: fetchErr.message };
  if (!row) return { error: "Event not found." };

  const status = String(row.status ?? "upcoming").trim();
  const prepared = await prepareMatchesForEventSave(admin, matches, status);

  const { error: updateErr } = await admin.from("events").update({ matches: prepared }).eq("id", id);
  if (updateErr) return { error: updateErr.message };

  revalidateAfterEventMatchesChange(id, row.name, row.date);
  return { ok: true };
}

export async function deleteBoxscoreEventAction(
  _prev: DeleteBoxscoreEventState,
  formData: FormData
): Promise<DeleteBoxscoreEventState> {
  const { user } = await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) {
    return { error: "Server is not configured with SUPABASE_SERVICE_ROLE_KEY." };
  }

  const eventId = (formData.get("event_id") ?? "").toString().trim();
  const reason = (formData.get("reason") ?? "").toString().trim();
  const confirmText = (formData.get("confirm_text") ?? "").toString().trim();
  if (!eventId) return { error: "Missing event id." };
  if (!reason) return { error: "Reason is required to delete an event." };
  if (confirmText !== "DELETE") return { error: "Type DELETE to confirm event deletion." };

  const { data: row, error: rowErr } = await admin
    .from("events")
    .select("id, name, date, status")
    .eq("id", eventId)
    .maybeSingle();
  if (rowErr) return { error: rowErr.message };
  if (!row) return { error: "Event not found." };
  if (String(row.status ?? "").toLowerCase() === "live") {
    return { error: "Live events cannot be deleted. Mark the event as completed or upcoming first." };
  }

  const { error: delErr } = await admin.from("events").delete().eq("id", eventId);
  if (delErr) return { error: delErr.message };

  try {
    await admin.from("admin_audit_log").insert({
      actor_user_id: user.id,
      action: "delete",
      entity_type: "boxscore_event",
      entity_id: eventId,
      payload_json: {
        reason,
        name: row.name ?? null,
        date: row.date ?? null,
        status: row.status ?? null,
      },
    });
  } catch {
    // optional table
  }

  revalidatePath("/event-results");
  revalidatePath(`/event-results/${encodeURIComponent(eventId)}`);
  revalidatePath("/internal-admin/events");
  revalidatePath(`/internal-admin/events/${encodeURIComponent(eventId)}`);
  revalidatePath("/internal-admin/boxscore/events");

  redirect(`/internal-admin/boxscore/events?ok=${encodeURIComponent(`Deleted event ${eventId}.`)}`);
}
