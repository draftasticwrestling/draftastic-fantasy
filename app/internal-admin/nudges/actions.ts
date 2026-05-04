"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSiteAdmin } from "@/lib/auth/siteAdmin";
import { getAdminClient } from "@/lib/supabase/admin";

const ALLOWED_KEYS = new Set(["missing_draft_prefs", "no_league_joined"]);

function done(message: string): never {
  revalidatePath("/internal-admin/nudges");
  redirect(`/internal-admin/nudges?ok=${encodeURIComponent(message)}`);
}

function fail(message: string): never {
  redirect(`/internal-admin/nudges?err=${encodeURIComponent(message)}`);
}

export async function saveLoginNudgeAction(formData: FormData) {
  const { user } = await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) fail("Server missing SUPABASE_SERVICE_ROLE_KEY.");

  const nudgeKey = String(formData.get("nudge_key") ?? "").trim();
  if (!ALLOWED_KEYS.has(nudgeKey)) fail("Invalid nudge key.");

  const enabled = String(formData.get("enabled") ?? "") === "on";
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const primaryLabel = String(formData.get("primary_cta_label") ?? "").trim() || null;
  const primaryHref = String(formData.get("primary_cta_href") ?? "").trim() || null;
  const secondaryLabel = String(formData.get("secondary_cta_label") ?? "").trim() || null;
  const secondaryHref = String(formData.get("secondary_cta_href") ?? "").trim() || null;

  if (!title) fail("Title is required.");
  if (!body) fail("Body is required.");

  if ((primaryLabel && !primaryHref) || (!primaryLabel && primaryHref)) {
    fail("Primary CTA requires both label and href.");
  }
  if ((secondaryLabel && !secondaryHref) || (!secondaryLabel && secondaryHref)) {
    fail("Secondary CTA requires both label and href.");
  }

  const { error } = await admin.from("site_login_nudges").upsert(
    {
      nudge_key: nudgeKey,
      enabled,
      title,
      body,
      primary_cta_label: primaryLabel,
      primary_cta_href: primaryHref,
      secondary_cta_label: secondaryLabel,
      secondary_cta_href: secondaryHref,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "nudge_key" }
  );
  if (error) fail(error.message);

  done("Nudge saved.");
}
