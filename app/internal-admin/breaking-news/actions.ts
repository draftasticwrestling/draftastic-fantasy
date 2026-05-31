"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSiteAdmin } from "@/lib/auth/siteAdmin";
import { getAdminClient } from "@/lib/supabase/admin";

function parseOptionalDateTime(value: FormDataEntryValue | null): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function parseSortOrder(value: FormDataEntryValue | null): number {
  const n = Number(String(value ?? "0"));
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function validatePayload(formData: FormData): {
  message: string;
  link_href: string | null;
  link_label: string | null;
  enabled: boolean;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
} | { error: string } {
  const message = String(formData.get("message") ?? "").trim();
  const linkHref = String(formData.get("link_href") ?? "").trim() || null;
  const linkLabel = String(formData.get("link_label") ?? "").trim() || null;
  const enabled = String(formData.get("enabled") ?? "") === "on";
  const sort_order = parseSortOrder(formData.get("sort_order"));
  const starts_at = parseOptionalDateTime(formData.get("starts_at"));
  const ends_at = parseOptionalDateTime(formData.get("ends_at"));

  if (!message) return { error: "Message is required." };
  if (message.length > 500) return { error: "Message must be 500 characters or fewer." };
  if (linkLabel && linkLabel.length > 80) return { error: "Link label must be 80 characters or fewer." };
  if (linkHref && linkHref.length > 512) return { error: "Link URL must be 512 characters or fewer." };
  if (linkLabel && !linkHref) return { error: "Link label requires a link URL." };
  if (linkHref && !linkHref.startsWith("/") && !/^https?:\/\//i.test(linkHref)) {
    return { error: "Link URL must start with / or http(s)://." };
  }
  if (starts_at && ends_at && Date.parse(starts_at) > Date.parse(ends_at)) {
    return { error: "End time must be after start time." };
  }

  return {
    message,
    link_href: linkHref,
    link_label: linkLabel,
    enabled,
    sort_order,
    starts_at,
    ends_at,
  };
}

export async function createBreakingNewsAction(formData: FormData): Promise<{ error?: string }> {
  const { user } = await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) return { error: "Server missing SUPABASE_SERVICE_ROLE_KEY." };

  const payload = validatePayload(formData);
  if ("error" in payload) return { error: payload.error };

  const { error } = await admin.from("site_breaking_news").insert({
    ...payload,
    updated_by: user.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/internal-admin/breaking-news");
  redirect("/internal-admin/breaking-news?ok=Breaking+news+created.");
}

export async function updateBreakingNewsAction(formData: FormData): Promise<{ error?: string }> {
  const { user } = await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) return { error: "Server missing SUPABASE_SERVICE_ROLE_KEY." };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Missing id." };

  const payload = validatePayload(formData);
  if ("error" in payload) return { error: payload.error };

  const { error } = await admin
    .from("site_breaking_news")
    .update({ ...payload, updated_by: user.id })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/internal-admin/breaking-news");
  redirect("/internal-admin/breaking-news?ok=Breaking+news+updated.");
}

export async function deleteBreakingNewsAction(formData: FormData): Promise<{ error?: string }> {
  await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) return { error: "Server missing SUPABASE_SERVICE_ROLE_KEY." };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Missing id." };

  const { error } = await admin.from("site_breaking_news").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/internal-admin/breaking-news");
  redirect("/internal-admin/breaking-news?ok=Breaking+news+deleted.");
}
