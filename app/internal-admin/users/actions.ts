"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSiteAdmin } from "@/lib/auth/siteAdmin";
import { getAdminClient } from "@/lib/supabase/admin";

function fail(userId: string, message: string): never {
  redirect(`/internal-admin/users/${encodeURIComponent(userId)}?err=${encodeURIComponent(message)}`);
}

function ok(userId: string, message: string): never {
  revalidatePath("/internal-admin/users");
  revalidatePath(`/internal-admin/users/${encodeURIComponent(userId)}`);
  redirect(`/internal-admin/users/${encodeURIComponent(userId)}?ok=${encodeURIComponent(message)}`);
}

async function writeAudit(args: {
  actorUserId: string;
  targetUserId: string;
  action: string;
  reason: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}) {
  const admin = getAdminClient();
  if (!admin) return;
  await admin.from("admin_moderation_audit").insert({
    actor_user_id: args.actorUserId,
    target_user_id: args.targetUserId,
    action: args.action,
    reason: args.reason,
    before_json: args.before,
    after_json: args.after,
  });
}

export async function saveUserModerationAction(formData: FormData) {
  const { user } = await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) return fail("unknown", "Server missing SUPABASE_SERVICE_ROLE_KEY.");

  const userId = (formData.get("user_id") ?? "").toString().trim();
  const displayName = (formData.get("display_name") ?? "").toString().trim() || null;
  const moderationNote = (formData.get("moderation_note") ?? "").toString().trim() || null;
  const makeSiteAdmin = (formData.get("is_site_admin") ?? "").toString() === "on";
  const reason = (formData.get("reason") ?? "").toString().trim();
  if (!userId) return fail("unknown", "Missing user id.");
  if (!reason) return fail(userId, "Reason is required for moderation changes.");

  const { data: before, error: beforeErr } = await admin
    .from("profiles")
    .select("display_name, moderation_note, is_site_admin")
    .eq("id", userId)
    .maybeSingle();
  if (beforeErr) return fail(userId, beforeErr.message);

  const update = {
    display_name: displayName,
    moderation_note: moderationNote,
    is_site_admin: makeSiteAdmin,
    updated_at: new Date().toISOString(),
  };
  const { error } = await admin.from("profiles").upsert({ id: userId, ...update }, { onConflict: "id" });
  if (error) return fail(userId, error.message);

  await writeAudit({
    actorUserId: user.id,
    targetUserId: userId,
    action: "user_core_update",
    reason,
    before: (before as Record<string, unknown> | null) ?? null,
    after: update,
  });

  return ok(userId, "User moderation fields saved.");
}

export async function setSuspensionAction(formData: FormData) {
  const { user } = await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) return fail("unknown", "Server missing SUPABASE_SERVICE_ROLE_KEY.");

  const userId = (formData.get("user_id") ?? "").toString().trim();
  const mode = (formData.get("mode") ?? "").toString().trim();
  const reason = (formData.get("reason") ?? "").toString().trim();
  if (!userId) return fail("unknown", "Missing user id.");
  if (!reason) return fail(userId, "Reason is required for suspension updates.");
  if (mode !== "suspend" && mode !== "unsuspend" && mode !== "permanent_block") {
    return fail(userId, "Invalid suspension mode.");
  }

  const untilRaw = (formData.get("suspended_until") ?? "").toString().trim();
  let suspendedUntil: string | null = null;
  if ((mode === "suspend" || mode === "permanent_block") && untilRaw) {
    const d = new Date(untilRaw);
    if (Number.isNaN(d.getTime())) return fail(userId, "Invalid suspended-until timestamp.");
    suspendedUntil = d.toISOString();
  }

  const { data: before, error: beforeErr } = await admin
    .from("profiles")
    .select("is_suspended, suspended_until, suspension_reason")
    .eq("id", userId)
    .maybeSingle();
  if (beforeErr) return fail(userId, beforeErr.message);

  const update =
    mode === "suspend" || mode === "permanent_block"
      ? {
          is_suspended: true,
          suspended_until: mode === "permanent_block" ? null : suspendedUntil,
          suspension_reason: reason,
          updated_at: new Date().toISOString(),
        }
      : {
          is_suspended: false,
          suspended_until: null,
          suspension_reason: null,
          updated_at: new Date().toISOString(),
        };

  const { error } = await admin.from("profiles").upsert({ id: userId, ...update }, { onConflict: "id" });
  if (error) return fail(userId, error.message);

  await writeAudit({
    actorUserId: user.id,
    targetUserId: userId,
    action:
      mode === "unsuspend" ? "user_unsuspended" : mode === "permanent_block" ? "user_permanently_blocked" : "user_suspended",
    reason,
    before: (before as Record<string, unknown> | null) ?? null,
    after: update,
  });

  if (mode === "permanent_block") return ok(userId, "User permanently blocked.");
  return ok(userId, mode === "suspend" ? "User suspended." : "User unsuspended.");
}

export async function clearAvatarAction(formData: FormData) {
  const { user } = await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) return fail("unknown", "Server missing SUPABASE_SERVICE_ROLE_KEY.");
  const userId = (formData.get("user_id") ?? "").toString().trim();
  const reason = (formData.get("reason") ?? "").toString().trim();
  if (!userId) return fail("unknown", "Missing user id.");
  if (!reason) return fail(userId, "Reason is required to clear avatar.");

  const { data: before, error: beforeErr } = await admin
    .from("profiles")
    .select("avatar_url")
    .eq("id", userId)
    .maybeSingle();
  if (beforeErr) return fail(userId, beforeErr.message);

  const { error } = await admin
    .from("profiles")
    .upsert({ id: userId, avatar_url: null, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) return fail(userId, error.message);

  await writeAudit({
    actorUserId: user.id,
    targetUserId: userId,
    action: "avatar_cleared",
    reason,
    before: (before as Record<string, unknown> | null) ?? null,
    after: { avatar_url: null },
  });

  return ok(userId, "Avatar cleared.");
}

export async function updateLeagueMembershipTextAction(formData: FormData) {
  const { user } = await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) return fail("unknown", "Server missing SUPABASE_SERVICE_ROLE_KEY.");

  const userId = (formData.get("user_id") ?? "").toString().trim();
  const leagueId = (formData.get("league_id") ?? "").toString().trim();
  const teamName = (formData.get("team_name") ?? "").toString().trim() || null;
  const catchphrase = (formData.get("manager_catchphrase") ?? "").toString().trim() || null;
  const reason = (formData.get("reason") ?? "").toString().trim();
  if (!userId || !leagueId) return fail(userId || "unknown", "Missing user/league id.");
  if (!reason) return fail(userId, "Reason is required for league content moderation.");

  const beforeResult = await admin
    .from("league_members")
    .select("team_name, manager_catchphrase")
    .eq("league_id", leagueId)
    .eq("user_id", userId)
    .maybeSingle();
  if (beforeResult.error) return fail(userId, beforeResult.error.message);
  if (!beforeResult.data) return fail(userId, "League membership row not found.");

  let updateErr: string | null = null;
  const update = { team_name: teamName, manager_catchphrase: catchphrase };
  const full = await admin
    .from("league_members")
    .update(update)
    .eq("league_id", leagueId)
    .eq("user_id", userId);
  if (full.error) {
    const msg = full.error.message.toLowerCase();
    if (msg.includes("manager_catchphrase")) {
      const fallback = await admin
        .from("league_members")
        .update({ team_name: teamName })
        .eq("league_id", leagueId)
        .eq("user_id", userId);
      if (fallback.error) updateErr = fallback.error.message;
    } else {
      updateErr = full.error.message;
    }
  }
  if (updateErr) return fail(userId, updateErr);

  await writeAudit({
    actorUserId: user.id,
    targetUserId: userId,
    action: "league_member_text_update",
    reason,
    before: { league_id: leagueId, ...(beforeResult.data as Record<string, unknown>) },
    after: { league_id: leagueId, ...update },
  });

  return ok(userId, "League text fields updated.");
}

export async function deleteUserAccountAction(formData: FormData) {
  const { user } = await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) return fail("unknown", "Server missing SUPABASE_SERVICE_ROLE_KEY.");

  const userId = (formData.get("user_id") ?? "").toString().trim();
  const reason = (formData.get("reason") ?? "").toString().trim();
  const confirmText = (formData.get("confirm_text") ?? "").toString().trim();
  const confirmUserId = (formData.get("confirm_user_id") ?? "").toString().trim();
  if (!userId) return fail("unknown", "Missing user id.");
  if (!reason) return fail(userId, "Reason is required for deleting a user.");
  if (confirmText !== "DELETE") return fail(userId, "Type DELETE to confirm user deletion.");
  if (confirmUserId !== userId) return fail(userId, "User id confirmation does not match.");
  if (userId === user.id) return fail(userId, "You cannot delete your own account from admin tools.");

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("is_site_admin")
    .eq("id", userId)
    .maybeSingle();
  if (profileErr) return fail(userId, profileErr.message);
  if (Boolean(profile?.is_site_admin)) {
    return fail(userId, "Site admin accounts cannot be deleted from this tool.");
  }

  const { count: membershipCount, error: memberErr } = await admin
    .from("league_members")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  if (memberErr) return fail(userId, memberErr.message);
  if ((membershipCount ?? 0) > 0) {
    return fail(userId, "User is still in one or more leagues. Remove memberships before deleting.");
  }

  const { data: authUser, error: beforeErr } = await admin.auth.admin.getUserById(userId);
  if (beforeErr) return fail(userId, beforeErr.message);
  if (!authUser.user) return fail(userId, "User not found.");

  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) return fail(userId, delErr.message);

  await writeAudit({
    actorUserId: user.id,
    targetUserId: userId,
    action: "user_deleted",
    reason,
    before: {
      email: authUser.user.email ?? null,
      phone: authUser.user.phone ?? null,
      created_at: authUser.user.created_at ?? null,
    },
    after: { deleted: true },
  });

  revalidatePath("/internal-admin/users");
  redirect(`/internal-admin/users?ok=${encodeURIComponent("User account deleted.")}`);
}

export async function removeUserFromAllLeaguesAction(formData: FormData) {
  const { user } = await requireSiteAdmin();
  const admin = getAdminClient();
  if (!admin) return fail("unknown", "Server missing SUPABASE_SERVICE_ROLE_KEY.");

  const userId = (formData.get("user_id") ?? "").toString().trim();
  const reason = (formData.get("reason") ?? "").toString().trim();
  const confirmText = (formData.get("confirm_text") ?? "").toString().trim();
  if (!userId) return fail("unknown", "Missing user id.");
  if (!reason) return fail(userId, "Reason is required for bulk league removal.");
  if (confirmText !== "REMOVE") return fail(userId, "Type REMOVE to confirm bulk league removal.");
  if (userId === user.id) return fail(userId, "You cannot bulk-remove yourself from leagues from admin tools.");

  const { data: commissionerMemberships, error: commissionerErr } = await admin
    .from("league_members")
    .select("league_id")
    .eq("user_id", userId)
    .eq("role", "commissioner");
  if (commissionerErr) return fail(userId, commissionerErr.message);
  if ((commissionerMemberships ?? []).length > 0) {
    return fail(userId, "User is commissioner in one or more leagues. Transfer/delete those leagues first.");
  }

  const { data: beforeRows, error: beforeErr } = await admin
    .from("league_members")
    .select("league_id, role, joined_at")
    .eq("user_id", userId);
  if (beforeErr) return fail(userId, beforeErr.message);
  const beforeCount = (beforeRows ?? []).length;
  if (beforeCount === 0) return ok(userId, "User is not a member of any leagues.");

  const { error: delErr } = await admin.from("league_members").delete().eq("user_id", userId);
  if (delErr) return fail(userId, delErr.message);

  await writeAudit({
    actorUserId: user.id,
    targetUserId: userId,
    action: "user_removed_from_all_leagues",
    reason,
    before: { memberships: beforeRows ?? [] },
    after: { memberships_removed_count: beforeCount },
  });

  return ok(userId, `Removed user from ${beforeCount} league${beforeCount === 1 ? "" : "s"}.`);
}
