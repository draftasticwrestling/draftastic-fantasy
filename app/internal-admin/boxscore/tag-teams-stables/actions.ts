"use server";

import { revalidatePath } from "next/cache";
import { requireSiteAdmin } from "@/lib/auth/siteAdmin";
import { getAdminClient } from "@/lib/supabase/admin";

export type TeamActionState = { error?: string; success?: string } | null;

function norm(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

async function revalidateTeams() {
  revalidatePath("/internal-admin/boxscore/tag-teams-stables");
  revalidatePath("/wrestlers");
}

export async function createTagTeamAction(
  _prev: TeamActionState,
  formData: FormData
): Promise<TeamActionState> {
  await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) return { error: "Missing SUPABASE_SERVICE_ROLE_KEY." };

  const id = norm(formData.get("id"));
  const name = norm(formData.get("name"));
  if (!id || !name) return { error: "Team id and name are required." };

  const payload = {
    id,
    name,
    brand: norm(formData.get("brand")),
    description: norm(formData.get("description")),
    is_stable: String(formData.get("is_stable") ?? "") === "on",
    primary_for_stable: norm(formData.get("primary_for_stable")),
    active: String(formData.get("active") ?? "on") === "on",
  };

  const { error } = await admin.from("tag_teams").insert(payload);
  if (error) return { error: error.message };
  await revalidateTeams();
  return { success: "Tag team created." };
}

export async function updateTagTeamAction(
  _prev: TeamActionState,
  formData: FormData
): Promise<TeamActionState> {
  await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) return { error: "Missing SUPABASE_SERVICE_ROLE_KEY." };

  const id = norm(formData.get("id"));
  if (!id) return { error: "Missing tag team id." };
  const payload = {
    name: norm(formData.get("name")),
    brand: norm(formData.get("brand")),
    description: norm(formData.get("description")),
    is_stable: String(formData.get("is_stable") ?? "") === "on",
    primary_for_stable: norm(formData.get("primary_for_stable")),
    active: String(formData.get("active") ?? "on") === "on",
  };

  const { error } = await admin.from("tag_teams").update(payload).eq("id", id);
  if (error) return { error: error.message };
  await revalidateTeams();
  return { success: "Tag team updated." };
}

export async function deleteTagTeamAction(formData: FormData): Promise<void> {
  await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) return;
  const id = norm(formData.get("id"));
  if (!id) return;
  await admin.from("tag_team_members").delete().eq("tag_team_id", id);
  await admin.from("tag_teams").delete().eq("id", id);
  await revalidateTeams();
}

export async function addTagTeamMemberAction(
  _prev: TeamActionState,
  formData: FormData
): Promise<TeamActionState> {
  await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) return { error: "Missing SUPABASE_SERVICE_ROLE_KEY." };

  const tagTeamId = norm(formData.get("tag_team_id"));
  const wrestlerSlug = norm(formData.get("wrestler_slug"));
  if (!tagTeamId || !wrestlerSlug) return { error: "Team and wrestler are required." };
  const memberOrder = Number.parseInt(String(formData.get("member_order") ?? "0"), 10) || 0;

  const { error } = await admin.from("tag_team_members").insert({
    tag_team_id: tagTeamId,
    wrestler_slug: wrestlerSlug,
    member_order: memberOrder,
    active: true,
  });
  if (error) return { error: error.message };

  await revalidateTeams();
  return { success: "Member added." };
}

export async function updateTagTeamMemberAction(
  _prev: TeamActionState,
  formData: FormData
): Promise<TeamActionState> {
  await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) return { error: "Missing SUPABASE_SERVICE_ROLE_KEY." };
  const tagTeamId = norm(formData.get("tag_team_id"));
  const wrestlerSlug = norm(formData.get("wrestler_slug"));
  if (!tagTeamId || !wrestlerSlug) return { error: "Missing member key." };
  const payload = {
    member_order: Number.parseInt(String(formData.get("member_order") ?? "0"), 10) || 0,
    active: String(formData.get("active") ?? "on") === "on",
  };
  const { error } = await admin
    .from("tag_team_members")
    .update(payload)
    .eq("tag_team_id", tagTeamId)
    .eq("wrestler_slug", wrestlerSlug);
  if (error) return { error: error.message };
  await revalidateTeams();
  return { success: "Member updated." };
}

export async function deleteTagTeamMemberAction(formData: FormData): Promise<void> {
  await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) return;
  const tagTeamId = norm(formData.get("tag_team_id"));
  const wrestlerSlug = norm(formData.get("wrestler_slug"));
  if (!tagTeamId || !wrestlerSlug) return;
  await admin.from("tag_team_members").delete().eq("tag_team_id", tagTeamId).eq("wrestler_slug", wrestlerSlug);
  await revalidateTeams();
}

export async function updateWrestlerStableAction(
  _prev: TeamActionState,
  formData: FormData
): Promise<TeamActionState> {
  await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) return { error: "Missing SUPABASE_SERVICE_ROLE_KEY." };
  const wrestlerId = norm(formData.get("wrestler_id"));
  if (!wrestlerId) return { error: "Missing wrestler id." };
  const payload = {
    stable: norm(formData.get("stable")),
    is_stable_leader: String(formData.get("is_stable_leader") ?? "") === "on",
  };
  const { error } = await admin.from("wrestlers").update(payload).eq("id", wrestlerId);
  if (error) return { error: error.message };
  await revalidateTeams();
  return { success: "Stable info saved." };
}

