"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSiteAdmin } from "@/lib/auth/siteAdmin";
import { getAdminClient } from "@/lib/supabase/admin";

export async function createEventScoreCorrectionAction(
  formData: FormData
): Promise<{ error: string } | void> {
  const { user } = await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) {
    return { error: "Server is not configured with SUPABASE_SERVICE_ROLE_KEY." };
  }

  const leagueSlug = (formData.get("league_slug") ?? "").toString().trim();
  const eventId = (formData.get("event_id") ?? "").toString().trim();
  const title = (formData.get("title") ?? "").toString().trim();
  const body_markdown = (formData.get("body_markdown") ?? "").toString();
  const visibleAtRaw = (formData.get("visible_at") ?? "").toString().trim();

  if (!eventId) return { error: "Event id is required." };
  if (!title) return { error: "Title is required." };

  let league_id: string | null = null;
  if (leagueSlug) {
    const slug = leagueSlug.toLowerCase();
    const { data: lea, error: leErr } = await admin.from("leagues").select("id").eq("slug", slug).maybeSingle();
    if (leErr) return { error: leErr.message };
    if (!lea) return { error: `No league with slug "${slug}".` };
    league_id = (lea as { id: string }).id;
  }

  let visible_at = new Date().toISOString();
  if (visibleAtRaw) {
    const d = new Date(visibleAtRaw);
    if (Number.isNaN(d.getTime())) return { error: "Invalid visible date/time." };
    visible_at = d.toISOString();
  }

  const { data: inserted, error: insErr } = await admin
    .from("event_score_corrections")
    .insert({
      league_id,
      event_id: eventId,
      title,
      body_markdown,
      visible_at,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insErr) return { error: insErr.message };
  const correctionId = (inserted as { id: string }).id;

  await admin.from("admin_audit_log").insert({
    actor_user_id: user.id,
    action: "create",
    entity_type: "event_score_correction",
    entity_id: correctionId,
    payload_json: { title, event_id: eventId, league_id, visible_at },
  });

  revalidatePath("/internal-admin/stat-corrections");
  if (leagueSlug) {
    revalidatePath(`/leagues/${leagueSlug.toLowerCase()}/stat-corrections`);
  }
  redirect("/internal-admin/stat-corrections?created=1");
}
