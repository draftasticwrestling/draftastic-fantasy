"use server";

import { revalidatePath } from "next/cache";
import { requireSiteAdmin } from "@/lib/auth/siteAdmin";
import { getAdminClient } from "@/lib/supabase/admin";

export type ChampionshipActionState = { error?: string; success?: string } | null;

function norm(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

async function revalidateChampionships() {
  revalidatePath("/internal-admin/boxscore/championships");
  revalidatePath("/championship");
  revalidatePath("/championships");
}

export async function updateChampionshipAction(
  _prev: ChampionshipActionState,
  formData: FormData
): Promise<ChampionshipActionState> {
  await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) return { error: "Missing SUPABASE_SERVICE_ROLE_KEY." };

  const id = norm(formData.get("id"));
  if (!id) return { error: "Missing championship id." };

  const payload: Record<string, unknown> = {
    title_name: norm(formData.get("title_name")),
    brand: norm(formData.get("brand")),
    type: norm(formData.get("type")),
    current_champion: norm(formData.get("current_champion")),
    current_champion_slug: norm(formData.get("current_champion_slug")),
    previous_champion: norm(formData.get("previous_champion")),
    previous_champion_slug: norm(formData.get("previous_champion_slug")),
    date_won: norm(formData.get("date_won")),
    event_name: norm(formData.get("event_name")),
    title_facts: norm(formData.get("title_facts")),
  };

  const { error } = await admin.from("championships").update(payload).eq("id", id);
  if (error) return { error: error.message };

  await revalidateChampionships();
  return { success: "Championship updated." };
}

export async function createChampionshipHistoryAction(
  _prev: ChampionshipActionState,
  formData: FormData
): Promise<ChampionshipActionState> {
  await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) return { error: "Missing SUPABASE_SERVICE_ROLE_KEY." };

  const championshipId = norm(formData.get("championship_id"));
  const champion = norm(formData.get("champion"));
  const dateWon = norm(formData.get("date_won"));
  if (!championshipId || !champion || !dateWon) return { error: "Championship, champion, and date won are required." };

  const payload: Record<string, unknown> = {
    championship_id: championshipId,
    champion,
    champion_slug: norm(formData.get("champion_slug")),
    previous_champion: norm(formData.get("previous_champion")),
    previous_champion_slug: norm(formData.get("previous_champion_slug")),
    date_won: dateWon,
    date_lost: norm(formData.get("date_lost")),
    event_name: norm(formData.get("event_name")),
    event_lost: norm(formData.get("event_lost")),
  };

  const { error } = await admin.from("championship_history").insert(payload);
  if (error) return { error: error.message };

  await revalidateChampionships();
  return { success: "History row created." };
}

export async function updateChampionshipHistoryAction(
  _prev: ChampionshipActionState,
  formData: FormData
): Promise<ChampionshipActionState> {
  await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) return { error: "Missing SUPABASE_SERVICE_ROLE_KEY." };

  const id = norm(formData.get("id"));
  if (!id) return { error: "Missing history row id." };

  const payload: Record<string, unknown> = {
    champion: norm(formData.get("champion")),
    champion_slug: norm(formData.get("champion_slug")),
    previous_champion: norm(formData.get("previous_champion")),
    previous_champion_slug: norm(formData.get("previous_champion_slug")),
    date_won: norm(formData.get("date_won")),
    date_lost: norm(formData.get("date_lost")),
    event_name: norm(formData.get("event_name")),
    event_lost: norm(formData.get("event_lost")),
  };

  const { error } = await admin.from("championship_history").update(payload).eq("id", id);
  if (error) return { error: error.message };

  await revalidateChampionships();
  return { success: "History row updated." };
}

export async function deleteChampionshipHistoryAction(formData: FormData): Promise<void> {
  await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) return;
  const id = norm(formData.get("id"));
  if (!id) return;
  await admin.from("championship_history").delete().eq("id", id);
  await revalidateChampionships();
}

