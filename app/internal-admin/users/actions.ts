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
