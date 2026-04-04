"use server";

import { revalidatePath } from "next/cache";
import { requireSiteAdmin } from "@/lib/auth/siteAdmin";
import { getAdminClient } from "@/lib/supabase/admin";

export async function persistEventMatchCommentaryAction(
  eventId: string,
  matchOrder: string | number,
  commentary: unknown[],
  newLiveStart: number | null | undefined
): Promise<{ error?: string }> {
  await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) return { error: "Service role not configured." };

  const { data: eventData, error: fetchError } = await admin.from("events").select("matches").eq("id", eventId).single();
  if (fetchError) return { error: fetchError.message };

  const existingMatches = Array.isArray(eventData?.matches) ? [...eventData.matches] : [];

  let matchIndex = existingMatches.findIndex((m: { order?: unknown }) => String(m.order) === String(matchOrder));
  if (matchIndex === -1) {
    const numericOrder = parseInt(String(matchOrder), 10);
    if (!Number.isNaN(numericOrder) && numericOrder - 1 >= 0 && numericOrder - 1 < existingMatches.length) {
      matchIndex = numericOrder - 1;
    } else {
      matchIndex = 0;
    }
  }

  const existingMatch = existingMatches[matchIndex] || {};
  const updatedMatches = [...existingMatches];
  updatedMatches[matchIndex] = {
    ...existingMatch,
    commentary,
    ...(newLiveStart != null ? { liveStart: newLiveStart } : {}),
  };

  const { error: updateError } = await admin.from("events").update({ matches: updatedMatches }).eq("id", eventId);
  if (updateError) return { error: updateError.message };

  revalidatePath("/internal-admin/events");
  revalidatePath(`/internal-admin/events/${encodeURIComponent(eventId)}`);
  revalidatePath("/event-results");
  revalidatePath(`/event-results/${encodeURIComponent(eventId)}`);

  return {};
}
