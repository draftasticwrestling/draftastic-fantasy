"use server";

import { revalidatePath } from "next/cache";
import { requireSiteAdmin } from "@/lib/auth/siteAdmin";
import { uploadWrestlerFullBodyAdmin, uploadWrestlerHeadshotAdmin } from "@/lib/boxscoreAdmin/wrestlerImageUpload";
import { isValidWrestlerSlug } from "@/lib/boxscoreAdmin/wrestlerSlug";
import { syncTagTeamForEditedWrestler, syncTagTeamForNewWrestler } from "@/lib/boxscoreAdmin/wrestlerTagTeamSync";
import { getAdminClient } from "@/lib/supabase/admin";

export type WrestlerActionState = { error?: string; success?: string; newId?: string } | null;

const BRAND_OPTIONS = ["RAW", "SmackDown", "NXT", "AAA", "Unassigned", "N/A"];

function norm(value: FormDataEntryValue | null): string | null {
  const v = String(value ?? "").trim();
  return v ? v : null;
}

function fileFromForm(formData: FormData, key: string): File | null {
  const v = formData.get(key);
  if (v instanceof File && v.size > 0) return v;
  return null;
}

function wrestlerPayload(formData: FormData): Record<string, unknown> {
  const classification = norm(formData.get("classification")) ?? "Active";
  const personType = norm(formData.get("person_type")) ?? "Wrestler";
  const brand = norm(formData.get("brand"));
  const status = norm(formData.get("status"));
  const gender = norm(formData.get("gender"));

  const payload: Record<string, unknown> = {
    nickname: norm(formData.get("nickname")),
    dob: norm(formData.get("dob")),
    nationality: norm(formData.get("nationality")),
    billed_from: personType === "Wrestler" ? norm(formData.get("billed_from")) : null,
    height: personType === "Wrestler" ? norm(formData.get("height")) : null,
    weight: personType === "Wrestler" ? norm(formData.get("weight")) : null,
    accomplishments: personType === "Wrestler" ? norm(formData.get("accomplishments")) : null,
    classification,
    person_type: personType,
    gender: personType === "Wrestler" ? gender : null,
    brand:
      classification === "Active" || classification === "Part-timer"
        ? brand && brand !== "Unassigned" && brand !== "N/A"
          ? brand
          : null
        : null,
    tag_team_name: norm(formData.get("tag_team_name")),
    tag_team_partner_slug: norm(formData.get("tag_team_partner_slug")),
    stable: norm(formData.get("stable")),
    is_stable_leader: String(formData.get("is_stable_leader") ?? "") === "on",
  };

  if (classification === "Active" || classification === "Part-timer") {
    payload.status = status;
  } else {
    payload.status = null;
  }

  if (personType !== "Wrestler") {
    payload.billed_from = null;
    payload.height = null;
    payload.weight = null;
    payload.accomplishments = null;
  }

  return payload;
}

function validateWrestlerForm(formData: FormData, slug: string, isCreate: boolean): string | null {
  const name = norm(formData.get("name"));
  if (!name) return "Name is required.";
  if (!slug) return "Slug is required.";
  if (!isValidWrestlerSlug(slug)) return "Slug can only contain lowercase letters, numbers, and hyphens.";

  const classification = norm(formData.get("classification")) ?? "Active";
  const personType = norm(formData.get("person_type")) ?? "Wrestler";
  const brand = norm(formData.get("brand"));
  const gender = norm(formData.get("gender"));

  if ((classification === "Active" || classification === "Part-timer") && (!brand || !BRAND_OPTIONS.includes(brand))) {
    return "Active and Part-timer wrestlers must have a brand selected.";
  }
  if (personType === "Wrestler" && !gender) {
    return "Gender is required for wrestler profiles.";
  }

  const headshot = fileFromForm(formData, "headshot_file");
  const fullBody = fileFromForm(formData, "full_body_file");
  for (const f of [headshot, fullBody]) {
    if (!f) continue;
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (ext !== "png" && ext !== "webp") return "Images must be .png or .webp files.";
  }

  if (isCreate && !name) return "Name is required.";
  return null;
}

function isMissingStatusColumn(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("status") && (m.includes("schema cache") || m.includes("column"));
}

async function insertWrestlerWithStatusFallback(
  admin: NonNullable<ReturnType<typeof getAdminClient>>,
  payload: Record<string, unknown>
) {
  let res = await admin.from("wrestlers").insert(payload);
  if (!res.error || !isMissingStatusColumn(res.error.message ?? "")) return res;

  const fallback = { ...payload };
  const statusVal = fallback.status;
  delete fallback.status;
  fallback["Status"] = statusVal;
  res = await admin.from("wrestlers").insert(fallback);
  if (!res.error) return res;

  if (isMissingStatusColumn(res.error.message ?? "")) {
    delete fallback["Status"];
    res = await admin.from("wrestlers").insert(fallback);
  }
  return res;
}

async function updateWrestlerWithStatusFallback(
  admin: NonNullable<ReturnType<typeof getAdminClient>>,
  id: string,
  payload: Record<string, unknown>
) {
  let res = await admin.from("wrestlers").update(payload).eq("id", id);
  if (!res.error || !isMissingStatusColumn(res.error.message ?? "")) return res;

  const fallback = { ...payload };
  const statusVal = fallback.status;
  delete fallback.status;
  fallback["Status"] = statusVal;
  res = await admin.from("wrestlers").update(fallback).eq("id", id);
  if (!res.error) return res;

  if (isMissingStatusColumn(res.error.message ?? "")) {
    delete fallback["Status"];
    res = await admin.from("wrestlers").update(fallback).eq("id", id);
  }
  return res;
}

async function revalidateWrestlerAdmin() {
  revalidatePath("/internal-admin/boxscore/wrestlers");
  revalidatePath("/wrestlers");
}

export async function createWrestlerAction(
  _prev: WrestlerActionState,
  formData: FormData
): Promise<WrestlerActionState> {
  const { user } = await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) return { error: "Missing SUPABASE_SERVICE_ROLE_KEY." };

  const slug = norm(formData.get("id"));
  const name = norm(formData.get("name"));
  const validationError = validateWrestlerForm(formData, slug ?? "", true);
  if (validationError) return { error: validationError };
  if (!slug || !name) return { error: "Slug and name are required." };

  const { data: existing } = await admin.from("wrestlers").select("id").eq("id", slug).maybeSingle();
  if (existing) return { error: `A wrestler with slug "${slug}" already exists.` };

  const payload = wrestlerPayload(formData);
  payload.id = slug;
  payload.name = name;

  try {
    const headshot = fileFromForm(formData, "headshot_file");
    if (headshot) payload.image_url = await uploadWrestlerHeadshotAdmin(admin, headshot, slug);
    else payload.image_url = norm(formData.get("image_url"));

    const fullBody = fileFromForm(formData, "full_body_file");
    if (fullBody) payload.full_body_image_url = await uploadWrestlerFullBodyAdmin(admin, fullBody, slug);
    else if (payload.person_type === "Wrestler") payload.full_body_image_url = norm(formData.get("full_body_image_url"));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Image upload failed." };
  }

  const { error } = await insertWrestlerWithStatusFallback(admin, payload);
  if (error) return { error: error.message };

  try {
    await syncTagTeamForNewWrestler(admin, {
      wrestlerSlug: slug,
      teamName: norm(formData.get("tag_team_name")),
      partnerSlug: norm(formData.get("tag_team_partner_slug")),
      brand: norm(formData.get("brand")),
      stableName: norm(formData.get("stable")),
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Wrestler created but tag team sync failed." };
  }

  try {
    await admin.from("admin_audit_log").insert({
      actor_user_id: user.id,
      action: "create",
      entity_type: "wrestler",
      entity_id: slug,
      payload_json: { name, brand: payload.brand ?? null },
    });
  } catch {
    // optional table
  }

  await revalidateWrestlerAdmin();
  return { success: `Created wrestler ${name}.`, newId: slug };
}

export async function updateWrestlerAction(
  _prev: WrestlerActionState,
  formData: FormData
): Promise<WrestlerActionState> {
  const { user } = await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) return { error: "Missing SUPABASE_SERVICE_ROLE_KEY." };

  const originalId = norm(formData.get("original_id"));
  const slug = norm(formData.get("id"));
  const name = norm(formData.get("name"));
  if (!originalId) return { error: "Missing original wrestler id." };
  if (!slug) return { error: "Slug is required." };

  const validationError = validateWrestlerForm(formData, slug, false);
  if (validationError) return { error: validationError };

  const slugChanged = slug !== originalId;
  if (slugChanged) {
    const { data: collision } = await admin.from("wrestlers").select("id").eq("id", slug).maybeSingle();
    if (collision) return { error: `Slug "${slug}" is already in use.` };
  }

  const payload = wrestlerPayload(formData);
  if (slugChanged) payload.id = slug;

  const removeHeadshot = formData.get("remove_headshot") === "1";
  const removeFullBody = formData.get("remove_full_body") === "1";

  try {
    const headshot = fileFromForm(formData, "headshot_file");
    if (headshot) {
      payload.image_url = await uploadWrestlerHeadshotAdmin(admin, headshot, slug);
    } else if (removeHeadshot) {
      payload.image_url = null;
    } else {
      const url = norm(formData.get("image_url"));
      if (url !== null) payload.image_url = url;
    }

    const fullBody = fileFromForm(formData, "full_body_file");
    if (fullBody) {
      payload.full_body_image_url = await uploadWrestlerFullBodyAdmin(admin, fullBody, slug);
    } else if (removeFullBody) {
      payload.full_body_image_url = null;
    } else {
      const url = norm(formData.get("full_body_image_url"));
      if (url !== null) payload.full_body_image_url = url;
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Image upload failed." };
  }

  const { error } = await updateWrestlerWithStatusFallback(admin, originalId, payload);
  if (error) return { error: error.message };

  try {
    await syncTagTeamForEditedWrestler(admin, {
      oldSlug: originalId,
      wrestlerSlug: slug,
      teamName: norm(formData.get("tag_team_name")),
      partnerSlug: norm(formData.get("tag_team_partner_slug")),
      brand: norm(formData.get("brand")),
      stableName: norm(formData.get("stable")),
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Saved wrestler but tag team sync failed." };
  }

  try {
    await admin.from("admin_audit_log").insert({
      actor_user_id: user.id,
      action: "update",
      entity_type: "wrestler",
      entity_id: slug,
      payload_json: { original_id: originalId, slug_changed: slugChanged },
    });
  } catch {
    // optional table
  }

  await revalidateWrestlerAdmin();
  return { success: `Saved ${name ?? slug}.`, newId: slugChanged ? slug : undefined };
}

async function wrestlerDeleteBlockers(
  admin: NonNullable<ReturnType<typeof getAdminClient>>,
  id: string
): Promise<string | null> {
  const checks: { label: string; table: string; column: string }[] = [
    { label: "title history", table: "championship_history", column: "champion_slug" },
    { label: "title history (defeated)", table: "championship_history", column: "previous_champion_slug" },
    { label: "tag team membership", table: "tag_team_members", column: "wrestler_slug" },
    { label: "current champion record", table: "championships", column: "current_champion_slug" },
    { label: "previous champion record", table: "championships", column: "previous_champion_slug" },
    { label: "fantasy league roster", table: "league_rosters", column: "wrestler_id" },
  ];

  for (const { label, table, column } of checks) {
    const { count, error } = await admin.from(table).select("*", { count: "exact", head: true }).eq(column, id);
    if (error) {
      if (error.message.toLowerCase().includes("does not exist")) continue;
      return error.message;
    }
    if ((count ?? 0) > 0) {
      return `Cannot delete: this wrestler is still referenced in ${label}. Remove or reassign those records first.`;
    }
  }

  return null;
}

export async function deleteWrestlerAction(
  _prev: WrestlerActionState,
  formData: FormData
): Promise<WrestlerActionState> {
  const { user } = await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) return { error: "Missing SUPABASE_SERVICE_ROLE_KEY." };

  const id = norm(formData.get("id"));
  const reason = norm(formData.get("reason"));
  const confirmText = norm(formData.get("confirm_text"));
  if (!id) return { error: "Missing wrestler id." };
  if (!reason) return { error: "Reason is required to delete a wrestler." };
  if (confirmText !== "DELETE") return { error: 'Type DELETE in the confirmation field to proceed.' };

  const { data: row, error: rowErr } = await admin.from("wrestlers").select("id,name").eq("id", id).maybeSingle();
  if (rowErr) return { error: rowErr.message };
  if (!row) return { error: "Wrestler not found." };

  const blocker = await wrestlerDeleteBlockers(admin, id);
  if (blocker) return { error: blocker };

  const { error: delErr } = await admin.from("wrestlers").delete().eq("id", id);
  if (delErr) return { error: delErr.message };

  try {
    await admin.from("admin_audit_log").insert({
      actor_user_id: user.id,
      action: "delete",
      entity_type: "wrestler",
      entity_id: id,
      payload_json: { reason, name: row.name ?? null },
    });
  } catch {
    // optional table
  }

  await revalidateWrestlerAdmin();
  return { success: `Deleted wrestler ${row.name ?? id}.` };
}
