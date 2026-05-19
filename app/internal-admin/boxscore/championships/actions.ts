"use server";

import { revalidatePath } from "next/cache";
import { requireSiteAdmin } from "@/lib/auth/siteAdmin";
import {
  closeOpenReignForTitleChange,
  computeDaysHeld,
  syncChampionshipFromHistory,
} from "@/lib/boxscoreAdmin/championshipSync";
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

export async function createChampionshipAction(
  _prev: ChampionshipActionState,
  formData: FormData
): Promise<ChampionshipActionState> {
  const { user } = await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) return { error: "Missing SUPABASE_SERVICE_ROLE_KEY." };

  const titleName = norm(formData.get("title_name"));
  if (!titleName) return { error: "Title name is required." };

  const payload: Record<string, unknown> = {
    title_name: titleName,
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

  const { data, error } = await admin.from("championships").insert(payload).select("id").single();
  if (error) return { error: error.message };

  try {
    await admin.from("admin_audit_log").insert({
      actor_user_id: user.id,
      action: "create",
      entity_type: "championship",
      entity_id: String(data?.id ?? ""),
      payload_json: { title_name: titleName, brand: payload.brand ?? null, type: payload.type ?? null },
    });
  } catch {
    // optional table
  }

  await revalidateChampionships();
  return { success: "Championship created." };
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

  const reignMode = norm(formData.get("reign_mode"));
  const dateLost = norm(formData.get("date_lost"));
  const eventName = norm(formData.get("event_name"));

  if (reignMode === "title_change") {
    const closeResult = await closeOpenReignForTitleChange(admin, championshipId, dateWon, eventName);
    if (closeResult.error) return { error: closeResult.error };
  }

  const payload: Record<string, unknown> = {
    championship_id: championshipId,
    champion,
    champion_slug: norm(formData.get("champion_slug")),
    previous_champion: norm(formData.get("previous_champion")),
    previous_champion_slug: norm(formData.get("previous_champion_slug")),
    date_won: dateWon,
    date_lost: dateLost,
    event_name: eventName,
    event_lost: norm(formData.get("event_lost")),
    days_held: computeDaysHeld(dateWon, dateLost),
  };

  const { error } = await admin.from("championship_history").insert(payload);
  if (error) return { error: error.message };

  if (reignMode !== "historical") {
    const syncResult = await syncChampionshipFromHistory(admin, championshipId);
    if (syncResult.error) return { error: syncResult.error };
  }

  await revalidateChampionships();
  return {
    success:
      reignMode === "historical"
        ? "Historical reign added (current champion unchanged)."
        : "Title change recorded and current champion updated.",
  };
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

  const dateWon = norm(formData.get("date_won"));
  const dateLost = norm(formData.get("date_lost"));
  const payload: Record<string, unknown> = {
    champion: norm(formData.get("champion")),
    champion_slug: norm(formData.get("champion_slug")),
    previous_champion: norm(formData.get("previous_champion")),
    previous_champion_slug: norm(formData.get("previous_champion_slug")),
    date_won: dateWon,
    date_lost: dateLost,
    event_name: norm(formData.get("event_name")),
    event_lost: norm(formData.get("event_lost")),
    days_held: dateWon ? computeDaysHeld(dateWon, dateLost) : null,
  };

  const { data: existing, error: fetchErr } = await admin
    .from("championship_history")
    .select("championship_id")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) return { error: fetchErr.message };

  const { error } = await admin.from("championship_history").update(payload).eq("id", id);
  if (error) return { error: error.message };

  const championshipId = (existing as { championship_id?: string } | null)?.championship_id;
  if (championshipId) {
    const syncResult = await syncChampionshipFromHistory(admin, championshipId);
    if (syncResult.error) return { error: syncResult.error };
  }

  await revalidateChampionships();
  return { success: "History row updated." };
}

export async function deleteChampionshipHistoryAction(formData: FormData): Promise<void> {
  await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) return;
  const id = norm(formData.get("id"));
  if (!id) return;
  const { data: row } = await admin.from("championship_history").select("championship_id").eq("id", id).maybeSingle();
  await admin.from("championship_history").delete().eq("id", id);
  const championshipId = (row as { championship_id?: string } | null)?.championship_id;
  if (championshipId) await syncChampionshipFromHistory(admin, championshipId);
  await revalidateChampionships();
}

export async function syncChampionshipFromHistoryAction(
  _prev: ChampionshipActionState,
  formData: FormData
): Promise<ChampionshipActionState> {
  await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) return { error: "Missing SUPABASE_SERVICE_ROLE_KEY." };
  const id = norm(formData.get("championship_id"));
  if (!id) return { error: "Missing championship id." };
  const result = await syncChampionshipFromHistory(admin, id);
  if (result.error) return { error: result.error };
  await revalidateChampionships();
  return { success: "Current champion synced from title history." };
}

export async function updateChampionshipTitleFactsAction(
  _prev: ChampionshipActionState,
  formData: FormData
): Promise<ChampionshipActionState> {
  await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) return { error: "Missing SUPABASE_SERVICE_ROLE_KEY." };
  const id = norm(formData.get("id"));
  if (!id) return { error: "Missing championship id." };
  const raw = String(formData.get("title_facts_json") ?? "").trim();
  let value: string | null = null;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return { error: "Title facts must be a JSON array of strings." };
      value = JSON.stringify(parsed.map((x) => String(x ?? "").trim()).filter(Boolean));
    } catch {
      return { error: "Invalid title facts JSON." };
    }
  }
  const { error } = await admin.from("championships").update({ title_facts: value }).eq("id", id);
  if (error) return { error: error.message };
  await revalidateChampionships();
  return { success: "Title facts saved." };
}

export async function deleteChampionshipAction(
  _prev: ChampionshipActionState,
  formData: FormData
): Promise<ChampionshipActionState> {
  const { user } = await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) return { error: "Missing SUPABASE_SERVICE_ROLE_KEY." };

  const id = norm(formData.get("id"));
  const reason = norm(formData.get("reason"));
  const confirmText = norm(formData.get("confirm_text"));
  if (!id) return { error: "Missing championship id." };
  if (!reason) return { error: "Reason is required to delete a championship." };
  if (confirmText !== "DELETE") return { error: "Type DELETE to confirm deleting the championship." };

  const { data: row, error: rowErr } = await admin.from("championships").select("id,title_name").eq("id", id).maybeSingle();
  if (rowErr) return { error: rowErr.message };
  if (!row) return { error: "Championship not found." };

  const { count: historyCount, error: historyErr } = await admin
    .from("championship_history")
    .select("*", { count: "exact", head: true })
    .eq("championship_id", id);
  if (historyErr) return { error: historyErr.message };
  if ((historyCount ?? 0) > 0) {
    return { error: "Cannot delete a championship that has title history rows. Remove history rows first." };
  }

  const { error: delErr } = await admin.from("championships").delete().eq("id", id);
  if (delErr) return { error: delErr.message };

  try {
    await admin.from("admin_audit_log").insert({
      actor_user_id: user.id,
      action: "delete",
      entity_type: "championship",
      entity_id: id,
      payload_json: { reason, title_name: row.title_name ?? null },
    });
  } catch {
    // optional table
  }

  await revalidateChampionships();
  return { success: "Championship deleted." };
}

