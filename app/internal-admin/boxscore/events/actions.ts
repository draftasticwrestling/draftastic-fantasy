"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSiteAdmin } from "@/lib/auth/siteAdmin";
import {
  buildBoxscoreEventId,
  normalizeEventDateInput,
  sanitizeBoxscoreEventForSupabase,
} from "@/lib/boxscoreAdmin/eventPayload";
import { buildEventResultsSlug } from "@/lib/event-results/eventResultsRoute";
import { getAdminClient } from "@/lib/supabase/admin";

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

/** PWBS-style checks from AddEvent `handleSaveEvent` (simplified match validation). */
function matchesPassCompletedRules(matches: unknown[], status: string): { ok: true } | { ok: false; error: string } {
  if (status !== "completed" && status !== "live") return { ok: true };
  if (!matches.length) {
    return {
      ok: false,
      error: "Completed or live events need at least one match. Use Upcoming to create an empty card, or paste a matches JSON array.",
    };
  }
  for (const m of matches) {
    if (!m || typeof m !== "object") {
      return { ok: false, error: "Each match must be a JSON object." };
    }
    const row = m as Record<string, unknown>;
    if (row.matchType === "Promo") continue;
    if (row.matchType === "Gauntlet Match" || row.matchType === "Tag Team Gauntlet Match" || row.matchType === "2 out of 3 Falls") {
      const prog = row.gauntletProgression;
      if (Array.isArray(prog) && prog.length > 0) {
        if (!row.result || String(row.result).trim() === "") {
          return { ok: false, error: "Gauntlet / 2-of-3 matches need a result when progression is set." };
        }
        continue;
      }
      // PWBS: empty gauntlet progression does not require method/result yet
      continue;
    }
    if (!row.participants) {
      return { ok: false, error: "Each wrestling match needs participants (or use matchType Promo)." };
    }
    if (!row.method || String(row.method).trim() === "") {
      return { ok: false, error: "Each wrestling match needs a method for completed/live events." };
    }
    if (!row.result || String(row.result).trim() === "") {
      return { ok: false, error: "Each wrestling match needs a result for completed/live events." };
    }
  }
  return { ok: true };
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
  const swType = (formData.get("special_winner_type") ?? "None").toString().trim();
  const swName = (formData.get("special_winner_name") ?? "").toString().trim();
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

  const matchRules = matchesPassCompletedRules(parsedMatches.matches, status);
  if (!matchRules.ok) return { error: matchRules.error };

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
    matches: parsedMatches.matches,
    status,
    isLive: status === "live",
    broadcast_start_ts,
    broadcast_start_ts_source,
    event_type: eventType || null,
  };

  if (swType !== "None" && swName) {
    rowInput.specialWinner = { type: swType, name: swName };
  }

  const sanitized = sanitizeBoxscoreEventForSupabase(rowInput);

  const { error: insErr } = await admin.from("events").insert(sanitized);

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

  revalidatePath("/event-results");
  revalidatePath(`/event-results/${encodeURIComponent(id)}`);
  revalidatePath("/internal-admin/events");

  redirect(`/internal-admin/events/${encodeURIComponent(id)}?created=1`);
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

  const { data: existingRow, error: exErr } = await admin.from("events").select("id").eq("id", eventId).maybeSingle();
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
  const swType = (formData.get("special_winner_type") ?? "None").toString().trim();
  const swName = (formData.get("special_winner_name") ?? "").toString().trim();
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

  const matchRules = matchesPassCompletedRules(parsedMatches.matches, status);
  if (!matchRules.ok) return { error: matchRules.error };

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
    matches: parsedMatches.matches,
    status,
    isLive: status === "live",
    broadcast_start_ts,
    broadcast_start_ts_source,
    event_type: eventType || null,
  };

  if (swType !== "None" && swName) {
    rowInput.specialWinner = { type: swType, name: swName };
  } else {
    rowInput.specialWinner = null;
  }

  const sanitized = sanitizeBoxscoreEventForSupabase(rowInput);

  const { error: upErr } = await admin.from("events").update(sanitized).eq("id", eventId);

  if (upErr) return { error: upErr.message };

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

  const resultsSlug = buildEventResultsSlug({ id: eventId, name, date });
  const editPathSegment = encodeURIComponent(resultsSlug);

  revalidatePath("/event-results");
  revalidatePath(`/event-results/${editPathSegment}`);
  revalidatePath(`/event-results/${encodeURIComponent(eventId)}`);
  revalidatePath("/internal-admin/events");
  revalidatePath(`/internal-admin/events/${encodeURIComponent(eventId)}`);
  revalidatePath(`/internal-admin/boxscore/events/${editPathSegment}/edit`);
  revalidatePath(`/internal-admin/boxscore/events/${encodeURIComponent(eventId)}/edit`);

  redirect(`/internal-admin/boxscore/events/${editPathSegment}/edit?saved=1`);
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
