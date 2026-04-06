"use server";

import { revalidatePath } from "next/cache";
import { requireSiteAdmin } from "@/lib/auth/siteAdmin";
import type { BoxscoreUiOptionCategory } from "@/lib/boxscoreAdmin/boxscoreUiOptionsCore";
import { getAdminClient } from "@/lib/supabase/admin";

const CATEGORIES = new Set<BoxscoreUiOptionCategory>(["event_type", "stipulation", "special_winner"]);

function parseCategory(raw: string): BoxscoreUiOptionCategory | null {
  const t = raw.trim();
  return CATEGORIES.has(t as BoxscoreUiOptionCategory) ? (t as BoxscoreUiOptionCategory) : null;
}

export type BoxscoreOptionActionState = { error?: string; ok?: boolean } | null;

export async function addBoxscoreUiOptionAction(
  _prev: BoxscoreOptionActionState,
  formData: FormData
): Promise<BoxscoreOptionActionState> {
  await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) return { error: "Server is not configured with SUPABASE_SERVICE_ROLE_KEY." };

  const category = parseCategory((formData.get("category") ?? "").toString());
  const label = (formData.get("label") ?? "").toString().trim();
  if (!category) return { error: "Invalid category." };
  if (!label) return { error: "Label is required." };
  if (label.length > 256) return { error: "Label is too long (max 256 characters)." };

  const { error } = await admin.from("boxscore_ui_options").insert({ category, label, sort_order: 0 });
  if (error) {
    if (error.code === "23505") {
      return { error: "That label already exists for this category." };
    }
    if (error.message?.includes("does not exist") || error.code === "42P01") {
      return { error: "Table boxscore_ui_options is missing. Run supabase/boxscore_ui_options.sql in your project." };
    }
    return { error: error.message };
  }

  revalidatePath("/internal-admin/boxscore/options");
  revalidatePath("/internal-admin/boxscore/events/new");
  revalidatePath("/internal-admin/boxscore/events");
  return { ok: true };
}

export async function deleteBoxscoreUiOptionAction(
  _prev: BoxscoreOptionActionState,
  formData: FormData
): Promise<BoxscoreOptionActionState> {
  await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) return { error: "Server is not configured with SUPABASE_SERVICE_ROLE_KEY." };

  const id = (formData.get("id") ?? "").toString().trim();
  if (!id) return { error: "Missing id." };

  const { error } = await admin.from("boxscore_ui_options").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/internal-admin/boxscore/options");
  revalidatePath("/internal-admin/boxscore/events/new");
  revalidatePath("/internal-admin/boxscore/events");
  return { ok: true };
}
