"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireSiteAdmin } from "@/lib/auth/siteAdmin";
import { addWrestlerToRoster, removeWrestlerFromRoster } from "@/lib/leagues";
import { getRosterRulesForLeague } from "@/lib/leagueStructure";

type Failure = { userId: string; expectedSize: number; actualSize: number; female: number; male: number; minFemale: number; minMale: number };

function leagueRedirect(slug: string, ok?: string, err?: string): never {
  const params = new URLSearchParams();
  if (ok) params.set("ok", ok);
  if (err) params.set("err", err);
  const qs = params.toString();
  redirect(`/internal-admin/leagues/${encodeURIComponent(slug)}${qs ? `?${qs}` : ""}`);
}

async function getRosterFailures(leagueId: string): Promise<Failure[]> {
  const admin = getAdminClient();
  if (!admin) return [];
  const [{ data: league }, { data: members }, { data: rows }, { data: genders }] = await Promise.all([
    admin.from("leagues").select("season_slug").eq("id", leagueId).maybeSingle(),
    admin.from("league_members").select("user_id").eq("league_id", leagueId),
    admin.from("league_rosters").select("user_id, wrestler_id").eq("league_id", leagueId).is("released_at", null),
    admin.from("wrestlers").select("id, gender"),
  ]);
  const memberIds = ((members ?? []) as { user_id: string }[]).map((m) => m.user_id);
  const rules = getRosterRulesForLeague(memberIds.length, (league as { season_slug?: string | null } | null)?.season_slug ?? null);
  if (!rules) return [];
  const genderById = new Map<string, "F" | "M" | null>();
  for (const w of (genders ?? []) as { id: string; gender: string | null }[]) {
    const g = String(w.gender ?? "").trim().toLowerCase();
    genderById.set(w.id, g === "female" || g === "f" ? "F" : g === "male" || g === "m" ? "M" : null);
  }
  const rosterByUser = new Map<string, string[]>();
  for (const r of (rows ?? []) as { user_id: string; wrestler_id: string }[]) {
    const list = rosterByUser.get(r.user_id) ?? [];
    list.push(r.wrestler_id);
    rosterByUser.set(r.user_id, list);
  }
  const failures: Failure[] = [];
  for (const userId of memberIds) {
    const roster = rosterByUser.get(userId) ?? [];
    let female = 0;
    let male = 0;
    for (const wid of roster) {
      const g = genderById.get(wid) ?? null;
      if (g === "F") female += 1;
      if (g === "M") male += 1;
    }
    if (roster.length !== rules.rosterSize || female < rules.minFemale || male < rules.minMale) {
      failures.push({
        userId,
        expectedSize: rules.rosterSize,
        actualSize: roster.length,
        female,
        male,
        minFemale: rules.minFemale,
        minMale: rules.minMale,
      });
    }
  }
  return failures;
}

export async function adminApproveDraftReviewAction(formData: FormData): Promise<void> {
  await requireSiteAdmin();
  const admin = getAdminClient();
  const leagueSlug = String(formData.get("leagueSlug") ?? "");
  const adminPath = leagueSlug ? `/internal-admin/leagues/${encodeURIComponent(leagueSlug)}` : "/internal-admin/leagues";
  if (!admin) redirect(`${adminPath}?review=error`);
  const leagueId = String(formData.get("leagueId") ?? "");
  const note = String(formData.get("reviewNote") ?? "").trim();
  if (!leagueId || !leagueSlug) redirect(`${adminPath}?review=invalid`);
  const failures = await getRosterFailures(leagueId);
  if (failures.length > 0 && !note) {
    revalidatePath(`/internal-admin/leagues/${encodeURIComponent(leagueSlug)}`);
    redirect(`${adminPath}?review=note-required`);
  }
  let approveRes = await admin
    .from("leagues")
    .update({
      draft_status: "completed",
      // Safe even when column doesn't exist (fallback below).
      ...(note ? ({ draft_review_notes: note } as Record<string, unknown>) : {}),
    })
    .eq("id", leagueId);
  if (approveRes.error && /draft_review_notes/i.test(approveRes.error.message ?? "")) {
    approveRes = await admin.from("leagues").update({ draft_status: "completed" }).eq("id", leagueId);
  }
  if (approveRes.error) {
    revalidatePath(`/internal-admin/leagues/${encodeURIComponent(leagueSlug)}`);
    redirect(`${adminPath}?review=error`);
  }
  if (note) {
    await admin.from("leagues").update({ manager_note: note }).eq("id", leagueId);
  }
  revalidatePath(`/internal-admin/leagues/${encodeURIComponent(leagueSlug)}`);
  revalidatePath(`/leagues/${encodeURIComponent(leagueSlug)}`);
  redirect(`${adminPath}?review=approved`);
}

export async function adminAddRosterEntryAction(formData: FormData): Promise<void> {
  await requireSiteAdmin();
  const leagueId = String(formData.get("leagueId") ?? "");
  const leagueSlug = String(formData.get("leagueSlug") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const wrestlerId = String(formData.get("wrestlerId") ?? "").trim();
  if (!leagueId || !leagueSlug || !userId || !wrestlerId) return;
  await addWrestlerToRoster(leagueId, userId, wrestlerId, null, true);
  revalidatePath(`/internal-admin/leagues/${encodeURIComponent(leagueSlug)}`);
  revalidatePath(`/leagues/${encodeURIComponent(leagueSlug)}`);
}

export async function adminRemoveRosterEntryAction(formData: FormData): Promise<void> {
  await requireSiteAdmin();
  const leagueId = String(formData.get("leagueId") ?? "");
  const leagueSlug = String(formData.get("leagueSlug") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const wrestlerId = String(formData.get("wrestlerId") ?? "").trim();
  if (!leagueId || !leagueSlug || !userId || !wrestlerId) return;
  await removeWrestlerFromRoster(leagueId, userId, wrestlerId, null, true);
  revalidatePath(`/internal-admin/leagues/${encodeURIComponent(leagueSlug)}`);
  revalidatePath(`/leagues/${encodeURIComponent(leagueSlug)}`);
}

async function ensureCommissionerAfterRemoval(
  admin: NonNullable<ReturnType<typeof getAdminClient>>,
  leagueId: string,
  removedUserId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: league, error: leagueErr } = await admin
    .from("leagues")
    .select("commissioner_id, slug")
    .eq("id", leagueId)
    .maybeSingle();
  if (leagueErr) return { ok: false, error: leagueErr.message };
  const commissionerId = (league as { commissioner_id?: string | null } | null)?.commissioner_id ?? null;
  if (!commissionerId || commissionerId !== removedUserId) return { ok: true };

  const { data: others, error: othersErr } = await admin
    .from("league_members")
    .select("user_id")
    .eq("league_id", leagueId)
    .neq("user_id", removedUserId)
    .order("joined_at", { ascending: true })
    .limit(1);
  if (othersErr) return { ok: false, error: othersErr.message };
  const nextId = (others?.[0] as { user_id?: string } | undefined)?.user_id ?? null;
  if (!nextId) {
    return { ok: false, error: "Cannot remove commissioner from a single-member league." };
  }
  const leagueUpd = await admin.from("leagues").update({ commissioner_id: nextId }).eq("id", leagueId);
  if (leagueUpd.error) return { ok: false, error: leagueUpd.error.message };
  await admin
    .from("league_members")
    .update({ role: "commissioner" })
    .eq("league_id", leagueId)
    .eq("user_id", nextId);
  return { ok: true };
}

async function resolveUserIdFromInput(
  admin: NonNullable<ReturnType<typeof getAdminClient>>,
  input: string
): Promise<{ userId: string | null; error?: string }> {
  const raw = input.trim();
  if (!raw) return { userId: null, error: "Enter a user id or email." };
  if (!raw.includes("@")) return { userId: raw };

  // Email lookup via Auth Admin API paging.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) return { userId: null, error: error.message };
    const users = data.users ?? [];
    const match = users.find((u) => (u.email ?? "").toLowerCase() === raw.toLowerCase());
    if (match) return { userId: match.id };
    if (users.length < 100) break;
  }
  return { userId: null, error: "No user found for that email." };
}

export async function adminArchiveLeagueAction(formData: FormData): Promise<void> {
  const { user } = await requireSiteAdmin();
  const admin = getAdminClient();
  const leagueId = String(formData.get("leagueId") ?? "").trim();
  const leagueSlug = String(formData.get("leagueSlug") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!admin || !leagueId || !leagueSlug) return;
  if (!reason) return leagueRedirect(leagueSlug, undefined, "Archive reason is required.");
  const res = await admin
    .from("leagues")
    .update({
      is_archived: true,
      archived_at: new Date().toISOString(),
      archived_by: user.id,
      archive_reason: reason,
    })
    .eq("id", leagueId);
  if (res.error) return leagueRedirect(leagueSlug, undefined, res.error.message);
  revalidatePath("/internal-admin/leagues");
  revalidatePath(`/internal-admin/leagues/${encodeURIComponent(leagueSlug)}`);
  return leagueRedirect(leagueSlug, "League archived.");
}

export async function adminUnarchiveLeagueAction(formData: FormData): Promise<void> {
  await requireSiteAdmin();
  const admin = getAdminClient();
  const leagueId = String(formData.get("leagueId") ?? "").trim();
  const leagueSlug = String(formData.get("leagueSlug") ?? "").trim();
  if (!admin || !leagueId || !leagueSlug) return;
  const res = await admin
    .from("leagues")
    .update({
      is_archived: false,
      archived_at: null,
      archived_by: null,
      archive_reason: null,
    })
    .eq("id", leagueId);
  if (res.error) return leagueRedirect(leagueSlug, undefined, res.error.message);
  revalidatePath("/internal-admin/leagues");
  revalidatePath(`/internal-admin/leagues/${encodeURIComponent(leagueSlug)}`);
  return leagueRedirect(leagueSlug, "League unarchived.");
}

export async function adminAddUserToLeagueAction(formData: FormData): Promise<void> {
  await requireSiteAdmin();
  const admin = getAdminClient();
  const leagueId = String(formData.get("leagueId") ?? "").trim();
  const leagueSlug = String(formData.get("leagueSlug") ?? "").trim();
  const userInput = String(formData.get("userInput") ?? "").trim();
  const role = String(formData.get("role") ?? "owner").trim() === "commissioner" ? "commissioner" : "owner";
  if (!admin || !leagueId || !leagueSlug) return;

  const resolved = await resolveUserIdFromInput(admin, userInput);
  if (!resolved.userId) return leagueRedirect(leagueSlug, undefined, resolved.error ?? "Could not resolve user.");

  const { count } = await admin
    .from("league_members")
    .select("*", { count: "exact", head: true })
    .eq("league_id", leagueId)
    .eq("user_id", resolved.userId);
  if ((count ?? 0) > 0) return leagueRedirect(leagueSlug, undefined, "User is already in this league.");

  const insertRes = await admin
    .from("league_members")
    .insert({ league_id: leagueId, user_id: resolved.userId, role, joined_at: new Date().toISOString() });
  if (insertRes.error) return leagueRedirect(leagueSlug, undefined, insertRes.error.message);

  if (role === "commissioner") {
    await admin.from("leagues").update({ commissioner_id: resolved.userId }).eq("id", leagueId);
    await admin
      .from("league_members")
      .update({ role: "owner" })
      .eq("league_id", leagueId)
      .neq("user_id", resolved.userId)
      .eq("role", "commissioner");
  }
  revalidatePath(`/internal-admin/leagues/${encodeURIComponent(leagueSlug)}`);
  revalidatePath(`/leagues/${encodeURIComponent(leagueSlug)}`);
  return leagueRedirect(leagueSlug, "User added to league.");
}

export async function adminRemoveUserFromLeagueAction(formData: FormData): Promise<void> {
  await requireSiteAdmin();
  const admin = getAdminClient();
  const leagueId = String(formData.get("leagueId") ?? "").trim();
  const leagueSlug = String(formData.get("leagueSlug") ?? "").trim();
  const userId = String(formData.get("userId") ?? "").trim();
  if (!admin || !leagueId || !leagueSlug || !userId) return;

  const commissionerCheck = await ensureCommissionerAfterRemoval(admin, leagueId, userId);
  if (!commissionerCheck.ok) return leagueRedirect(leagueSlug, undefined, commissionerCheck.error);

  // Remove user-linked rows first when tables exist.
  await admin.from("league_rosters").delete().eq("league_id", leagueId).eq("user_id", userId);
  await admin.from("league_draft_preferences").delete().eq("league_id", leagueId).eq("user_id", userId);
  const removeRes = await admin.from("league_members").delete().eq("league_id", leagueId).eq("user_id", userId);
  if (removeRes.error) return leagueRedirect(leagueSlug, undefined, removeRes.error.message);

  revalidatePath(`/internal-admin/leagues/${encodeURIComponent(leagueSlug)}`);
  revalidatePath(`/leagues/${encodeURIComponent(leagueSlug)}`);
  return leagueRedirect(leagueSlug, "User removed from league.");
}

export async function adminMoveUserToLeagueAction(formData: FormData): Promise<void> {
  await requireSiteAdmin();
  const admin = getAdminClient();
  const sourceLeagueId = String(formData.get("sourceLeagueId") ?? "").trim();
  const sourceLeagueSlug = String(formData.get("sourceLeagueSlug") ?? "").trim();
  const targetLeagueSlug = String(formData.get("targetLeagueSlug") ?? "").trim();
  const userId = String(formData.get("userId") ?? "").trim();
  if (!admin || !sourceLeagueId || !sourceLeagueSlug || !targetLeagueSlug || !userId) return;

  const { data: targetLeague, error: targetErr } = await admin
    .from("leagues")
    .select("id, slug, max_teams")
    .eq("slug", targetLeagueSlug)
    .maybeSingle();
  if (targetErr || !targetLeague) return leagueRedirect(sourceLeagueSlug, undefined, "Target league not found.");
  const targetLeagueId = (targetLeague as { id: string }).id;
  if (targetLeagueId === sourceLeagueId) return leagueRedirect(sourceLeagueSlug, undefined, "Source and target leagues are the same.");

  const { count: targetHas } = await admin
    .from("league_members")
    .select("*", { count: "exact", head: true })
    .eq("league_id", targetLeagueId)
    .eq("user_id", userId);
  if ((targetHas ?? 0) > 0) return leagueRedirect(sourceLeagueSlug, undefined, "User already exists in target league.");

  const { count: targetCount } = await admin
    .from("league_members")
    .select("*", { count: "exact", head: true })
    .eq("league_id", targetLeagueId);
  const cap = Number((targetLeague as { max_teams?: number | null }).max_teams ?? 0);
  if (cap > 0 && (targetCount ?? 0) >= cap) {
    return leagueRedirect(sourceLeagueSlug, undefined, "Target league is full.");
  }

  const commissionerCheck = await ensureCommissionerAfterRemoval(admin, sourceLeagueId, userId);
  if (!commissionerCheck.ok) return leagueRedirect(sourceLeagueSlug, undefined, commissionerCheck.error);

  const insertRes = await admin
    .from("league_members")
    .insert({ league_id: targetLeagueId, user_id: userId, role: "owner", joined_at: new Date().toISOString() });
  if (insertRes.error) return leagueRedirect(sourceLeagueSlug, undefined, insertRes.error.message);

  await admin
    .from("league_rosters")
    .update({ released_at: new Date().toISOString().slice(0, 10) })
    .eq("league_id", sourceLeagueId)
    .eq("user_id", userId)
    .is("released_at", null);
  await admin.from("league_draft_preferences").delete().eq("league_id", sourceLeagueId).eq("user_id", userId);
  const removeRes = await admin.from("league_members").delete().eq("league_id", sourceLeagueId).eq("user_id", userId);
  if (removeRes.error) return leagueRedirect(sourceLeagueSlug, undefined, removeRes.error.message);

  revalidatePath(`/internal-admin/leagues/${encodeURIComponent(sourceLeagueSlug)}`);
  revalidatePath(`/internal-admin/leagues/${encodeURIComponent(targetLeagueSlug)}`);
  revalidatePath(`/leagues/${encodeURIComponent(sourceLeagueSlug)}`);
  revalidatePath(`/leagues/${encodeURIComponent(targetLeagueSlug)}`);
  return leagueRedirect(sourceLeagueSlug, `User moved to ${targetLeagueSlug}.`);
}

export async function adminBulkMoveMembersAction(formData: FormData): Promise<void> {
  await requireSiteAdmin();
  const admin = getAdminClient();
  const sourceLeagueId = String(formData.get("sourceLeagueId") ?? "").trim();
  const sourceLeagueSlug = String(formData.get("sourceLeagueSlug") ?? "").trim();
  const targetLeagueSlug = String(formData.get("targetLeagueSlug") ?? "").trim();
  const includeCommissioner = String(formData.get("includeCommissioner") ?? "") === "on";
  const maxMovesRaw = Number.parseInt(String(formData.get("maxMoves") ?? "0"), 10);
  const maxMoves = Number.isFinite(maxMovesRaw) && maxMovesRaw > 0 ? Math.min(32, maxMovesRaw) : 32;
  if (!admin || !sourceLeagueId || !sourceLeagueSlug || !targetLeagueSlug) return;

  const { data: targetLeague, error: targetErr } = await admin
    .from("leagues")
    .select("id, slug, max_teams")
    .eq("slug", targetLeagueSlug)
    .maybeSingle();
  if (targetErr || !targetLeague) return leagueRedirect(sourceLeagueSlug, undefined, "Target league not found.");
  const targetLeagueId = (targetLeague as { id: string }).id;
  if (targetLeagueId === sourceLeagueId) return leagueRedirect(sourceLeagueSlug, undefined, "Source and target leagues are the same.");

  const { data: sourceMembers, error: sourceErr } = await admin
    .from("league_members")
    .select("user_id, role, joined_at")
    .eq("league_id", sourceLeagueId)
    .order("joined_at", { ascending: true });
  if (sourceErr) return leagueRedirect(sourceLeagueSlug, undefined, sourceErr.message);
  const members = (sourceMembers ?? []) as { user_id: string; role: string; joined_at: string }[];
  if (members.length === 0) return leagueRedirect(sourceLeagueSlug, undefined, "Source league has no members.");

  const moveCandidates = members.filter((m) => includeCommissioner || m.role !== "commissioner");
  if (moveCandidates.length === 0) {
    return leagueRedirect(sourceLeagueSlug, undefined, "No eligible members to move (commissioner excluded).");
  }

  const { count: targetCount } = await admin
    .from("league_members")
    .select("*", { count: "exact", head: true })
    .eq("league_id", targetLeagueId);
  const cap = Number((targetLeague as { max_teams?: number | null }).max_teams ?? 0);
  const available = cap > 0 ? Math.max(0, cap - (targetCount ?? 0)) : moveCandidates.length;
  if (available <= 0) return leagueRedirect(sourceLeagueSlug, undefined, "Target league has no open spots.");

  const planned = moveCandidates.slice(0, Math.min(available, maxMoves));
  let moved = 0;
  for (const member of planned) {
    const commissionerCheck = await ensureCommissionerAfterRemoval(admin, sourceLeagueId, member.user_id);
    if (!commissionerCheck.ok) continue;

    const ins = await admin
      .from("league_members")
      .insert({ league_id: targetLeagueId, user_id: member.user_id, role: "owner", joined_at: new Date().toISOString() });
    if (ins.error) continue;

    await admin
      .from("league_rosters")
      .update({ released_at: new Date().toISOString().slice(0, 10) })
      .eq("league_id", sourceLeagueId)
      .eq("user_id", member.user_id)
      .is("released_at", null);
    await admin.from("league_draft_preferences").delete().eq("league_id", sourceLeagueId).eq("user_id", member.user_id);
    await admin.from("league_members").delete().eq("league_id", sourceLeagueId).eq("user_id", member.user_id);
    moved += 1;
  }

  if (moved === 0) return leagueRedirect(sourceLeagueSlug, undefined, "No members were moved.");
  revalidatePath(`/internal-admin/leagues/${encodeURIComponent(sourceLeagueSlug)}`);
  revalidatePath(`/internal-admin/leagues/${encodeURIComponent(targetLeagueSlug)}`);
  revalidatePath(`/leagues/${encodeURIComponent(sourceLeagueSlug)}`);
  revalidatePath(`/leagues/${encodeURIComponent(targetLeagueSlug)}`);
  return leagueRedirect(
    sourceLeagueSlug,
    `Moved ${moved} member${moved === 1 ? "" : "s"} to ${targetLeagueSlug}.`
  );
}

export async function adminDeleteLeagueAction(formData: FormData): Promise<void> {
  await requireSiteAdmin();
  const admin = getAdminClient();
  const leagueId = String(formData.get("leagueId") ?? "").trim();
  const leagueSlug = String(formData.get("leagueSlug") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const confirmSlug = String(formData.get("confirmSlug") ?? "").trim();
  const forceDelete = String(formData.get("forceDelete") ?? "") === "on";
  if (!admin || !leagueId || !leagueSlug) return;
  if (!reason) return leagueRedirect(leagueSlug, undefined, "Delete reason is required.");
  if (confirmSlug !== leagueSlug) return leagueRedirect(leagueSlug, undefined, "Type the exact league slug to delete.");

  const { count: memberCount } = await admin
    .from("league_members")
    .select("*", { count: "exact", head: true })
    .eq("league_id", leagueId);
  if ((memberCount ?? 0) > 1 && !forceDelete) {
    return leagueRedirect(leagueSlug, undefined, "League has multiple members. Enable force delete after review.");
  }

  // Best effort child cleanup first.
  await admin.from("league_draft_preferences").delete().eq("league_id", leagueId);
  await admin.from("league_rosters").delete().eq("league_id", leagueId);
  await admin.from("league_members").delete().eq("league_id", leagueId);
  await admin.from("league_activity").delete().eq("league_id", leagueId);
  await admin.from("league_invites").delete().eq("league_id", leagueId);

  const delRes = await admin.from("leagues").delete().eq("id", leagueId);
  if (delRes.error) {
    return leagueRedirect(
      leagueSlug,
      undefined,
      `${delRes.error.message}. If this league has historic data, archive it instead of deleting.`
    );
  }
  revalidatePath("/internal-admin/leagues");
  redirect(`/internal-admin/leagues?q=${encodeURIComponent(leagueSlug)}`);
}
