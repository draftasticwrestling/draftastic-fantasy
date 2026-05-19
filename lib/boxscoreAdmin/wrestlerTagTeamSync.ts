import type { SupabaseClient } from "@supabase/supabase-js";
import { slugifyWrestlerName } from "@/lib/boxscoreAdmin/wrestlerSlug";

type TagTeamRow = { id: string; name: string };

async function getOrCreateTagTeam(
  admin: SupabaseClient,
  { teamName, brand, stableName }: { teamName: string; brand: string | null; stableName: string | null }
): Promise<TagTeamRow | null> {
  const normalizedTeamName = teamName.trim();
  if (!normalizedTeamName) return null;

  const cleanBrand = brand && brand !== "Unassigned" && brand !== "N/A" ? brand : null;

  const { data: existingTeam, error: lookupError } = await admin
    .from("tag_teams")
    .select("id,name")
    .eq("name", normalizedTeamName)
    .eq("active", true)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existingTeam) return existingTeam as TagTeamRow;

  const baseId = slugifyWrestlerName(normalizedTeamName).slice(0, 42) || `tag-team-${Date.now()}`;
  let teamId = baseId;
  for (let i = 2; i < 100; i += 1) {
    const { data: idCollision, error: idError } = await admin.from("tag_teams").select("id").eq("id", teamId).maybeSingle();
    if (idError) throw idError;
    if (!idCollision) break;
    teamId = `${baseId}-${i}`.slice(0, 50);
  }

  const isStable =
    !!stableName && stableName.trim().toLowerCase() === normalizedTeamName.toLowerCase();

  const { data: createdTeam, error: createError } = await admin
    .from("tag_teams")
    .insert({
      id: teamId,
      name: normalizedTeamName,
      brand: cleanBrand,
      is_stable: isStable,
      active: true,
    })
    .select("id,name")
    .single();
  if (createError) throw createError;
  return createdTeam as TagTeamRow;
}

async function upsertTagTeamMember(
  admin: SupabaseClient,
  tagTeamId: string,
  wrestlerSlug: string,
  memberOrder: number
) {
  const { data: existingMember, error: memberLookupError } = await admin
    .from("tag_team_members")
    .select("tag_team_id,wrestler_slug")
    .eq("tag_team_id", tagTeamId)
    .eq("wrestler_slug", wrestlerSlug)
    .maybeSingle();
  if (memberLookupError) throw memberLookupError;

  if (existingMember) {
    const { error: memberUpdateError } = await admin
      .from("tag_team_members")
      .update({ member_order: memberOrder, active: true })
      .eq("tag_team_id", tagTeamId)
      .eq("wrestler_slug", wrestlerSlug);
    if (memberUpdateError) throw memberUpdateError;
    return;
  }

  const { error: memberInsertError } = await admin.from("tag_team_members").insert({
    tag_team_id: tagTeamId,
    wrestler_slug: wrestlerSlug,
    member_order: memberOrder,
    active: true,
  });
  if (memberInsertError) throw memberInsertError;
}

/** After create — mirrors PWBS WrestlerAddModal. */
export async function syncTagTeamForNewWrestler(
  admin: SupabaseClient,
  opts: {
    wrestlerSlug: string;
    teamName: string | null;
    partnerSlug: string | null;
    brand: string | null;
    stableName: string | null;
  }
) {
  const normalizedTeamName = (opts.teamName ?? "").trim();
  const normalizedPartnerSlug = (opts.partnerSlug ?? "").trim();
  if (!normalizedTeamName || !normalizedPartnerSlug || normalizedPartnerSlug === opts.wrestlerSlug) return;

  const { data: partner, error: partnerLookupError } = await admin
    .from("wrestlers")
    .select("id")
    .eq("id", normalizedPartnerSlug)
    .maybeSingle();
  if (partnerLookupError) throw partnerLookupError;
  if (!partner) return;

  const tagTeam = await getOrCreateTagTeam(admin, {
    teamName: normalizedTeamName,
    brand: opts.brand,
    stableName: opts.stableName,
  });
  if (!tagTeam) return;

  await upsertTagTeamMember(admin, tagTeam.id, opts.wrestlerSlug, 0);
  await upsertTagTeamMember(admin, tagTeam.id, normalizedPartnerSlug, 1);

  const syncRow = {
    tag_team_id: tagTeam.id,
    tag_team_name: tagTeam.name,
    tag_team_partner_slug: normalizedPartnerSlug,
  };
  const { error: wrestlerSyncError } = await admin.from("wrestlers").update(syncRow).eq("id", opts.wrestlerSlug);
  if (wrestlerSyncError) throw wrestlerSyncError;

  const { error: partnerSyncError } = await admin
    .from("wrestlers")
    .update({ ...syncRow, tag_team_partner_slug: opts.wrestlerSlug })
    .eq("id", normalizedPartnerSlug);
  if (partnerSyncError) throw partnerSyncError;
}

/** After edit — mirrors PWBS WrestlerEditModal. */
export async function syncTagTeamForEditedWrestler(
  admin: SupabaseClient,
  opts: {
    oldSlug: string;
    wrestlerSlug: string;
    teamName: string | null;
    partnerSlug: string | null;
    brand: string | null;
    stableName: string | null;
  }
) {
  const normalizedTeamName = (opts.teamName ?? "").trim();
  const normalizedPartnerSlug = (opts.partnerSlug ?? "").trim();

  if (opts.oldSlug && opts.oldSlug !== opts.wrestlerSlug) {
    const { error: slugMemberUpdateError } = await admin
      .from("tag_team_members")
      .update({ wrestler_slug: opts.wrestlerSlug })
      .eq("wrestler_slug", opts.oldSlug);
    if (slugMemberUpdateError) throw slugMemberUpdateError;
  }

  if (!normalizedTeamName || !normalizedPartnerSlug || normalizedPartnerSlug === opts.wrestlerSlug) {
    const { error: memberDeactivateError } = await admin
      .from("tag_team_members")
      .update({ active: false })
      .eq("wrestler_slug", opts.wrestlerSlug)
      .eq("active", true);
    if (memberDeactivateError) throw memberDeactivateError;

    const { error: clearWrestlerTeamError } = await admin
      .from("wrestlers")
      .update({ tag_team_id: null, tag_team_name: null, tag_team_partner_slug: null })
      .eq("id", opts.wrestlerSlug);
    if (clearWrestlerTeamError) throw clearWrestlerTeamError;
    return;
  }

  const { data: partner, error: partnerLookupError } = await admin
    .from("wrestlers")
    .select("id")
    .eq("id", normalizedPartnerSlug)
    .maybeSingle();
  if (partnerLookupError) throw partnerLookupError;
  if (!partner) return;

  const tagTeam = await getOrCreateTagTeam(admin, {
    teamName: normalizedTeamName,
    brand: opts.brand,
    stableName: opts.stableName,
  });
  if (!tagTeam) return;

  const { error: deactivateOtherTeamsError } = await admin
    .from("tag_team_members")
    .update({ active: false })
    .eq("wrestler_slug", opts.wrestlerSlug)
    .neq("tag_team_id", tagTeam.id)
    .eq("active", true);
  if (deactivateOtherTeamsError) throw deactivateOtherTeamsError;

  await upsertTagTeamMember(admin, tagTeam.id, opts.wrestlerSlug, 0);
  await upsertTagTeamMember(admin, tagTeam.id, normalizedPartnerSlug, 1);

  const syncRow = {
    tag_team_id: tagTeam.id,
    tag_team_name: tagTeam.name,
    tag_team_partner_slug: normalizedPartnerSlug,
  };
  const { error: wrestlerSyncError } = await admin.from("wrestlers").update(syncRow).eq("id", opts.wrestlerSlug);
  if (wrestlerSyncError) throw wrestlerSyncError;

  const { error: partnerSyncError } = await admin
    .from("wrestlers")
    .update({ ...syncRow, tag_team_partner_slug: opts.wrestlerSlug })
    .eq("id", normalizedPartnerSlug);
  if (partnerSyncError) throw partnerSyncError;
}
