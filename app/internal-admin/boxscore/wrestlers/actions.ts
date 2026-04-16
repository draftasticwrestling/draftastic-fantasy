"use server";

import { revalidatePath } from "next/cache";
import { requireSiteAdmin } from "@/lib/auth/siteAdmin";
import { getAdminClient } from "@/lib/supabase/admin";

export type WrestlerActionState = { error?: string; success?: string } | null;

function norm(value: FormDataEntryValue | null): string | null {
  const v = String(value ?? "").trim();
  return v ? v : null;
}

function wrestlerPayload(formData: FormData): Record<string, unknown> {
  const classification = norm(formData.get("classification")) ?? "Active";
  const personType = norm(formData.get("person_type")) ?? "Wrestler";
  const brand = norm(formData.get("brand"));
  const status = norm(formData.get("status"));

  const payload: Record<string, unknown> = {
    name: norm(formData.get("name")) ?? "",
    nickname: norm(formData.get("nickname")),
    dob: norm(formData.get("dob")),
    nationality: norm(formData.get("nationality")),
    billed_from: personType === "Wrestler" ? norm(formData.get("billed_from")) : null,
    height: personType === "Wrestler" ? norm(formData.get("height")) : null,
    weight: personType === "Wrestler" ? norm(formData.get("weight")) : null,
    image_url: norm(formData.get("image_url")),
    full_body_image_url: personType === "Wrestler" ? norm(formData.get("full_body_image_url")) : null,
    accomplishments: personType === "Wrestler" ? norm(formData.get("accomplishments")) : null,
    classification,
    person_type: personType,
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

  return payload;
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
  await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) return { error: "Missing SUPABASE_SERVICE_ROLE_KEY." };

  const id = norm(formData.get("id"));
  const name = norm(formData.get("name"));
  if (!id) return { error: "Slug (id) is required." };
  if (!name) return { error: "Name is required." };

  const payload = wrestlerPayload(formData);
  payload.id = id;
  payload.name = name;

  const { error } = await insertWrestlerWithStatusFallback(admin, payload);
  if (error) return { error: error.message };

  await revalidateWrestlerAdmin();
  return { success: `Created wrestler ${name}.` };
}

export async function updateWrestlerAction(
  _prev: WrestlerActionState,
  formData: FormData
): Promise<WrestlerActionState> {
  await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) return { error: "Missing SUPABASE_SERVICE_ROLE_KEY." };

  const id = norm(formData.get("id"));
  const name = norm(formData.get("name"));
  if (!id) return { error: "Missing wrestler id." };
  if (!name) return { error: "Name is required." };

  const payload = wrestlerPayload(formData);
  payload.name = name;

  const { error } = await updateWrestlerWithStatusFallback(admin, id, payload);
  if (error) return { error: error.message };

  await revalidateWrestlerAdmin();
  return { success: `Saved ${name}.` };
}

export async function deleteWrestlerAction(formData: FormData): Promise<void> {
  await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) return;
  const id = norm(formData.get("id"));
  if (!id) return;
  await admin.from("wrestlers").delete().eq("id", id);
  await revalidateWrestlerAdmin();
}

