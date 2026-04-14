"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireSiteAdmin } from "@/lib/auth/siteAdmin";
import { addWrestlerToRoster, removeWrestlerFromRoster } from "@/lib/leagues";
import { getRosterRulesForLeague } from "@/lib/leagueStructure";

type Failure = { userId: string; expectedSize: number; actualSize: number; female: number; male: number; minFemale: number; minMale: number };

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
