import "server-only";

import { getAdminClient } from "@/lib/supabase/admin";

export type BoxscoreWrestlerRow = {
  id: string;
  name: string;
  gender?: string | null;
  brand?: string | null;
};

/** Tag team map keyed by team id — same shape as PWBS VisualMatchBuilder `tagTeamData`. */
export type BoxscoreTagTeamDataMap = Record<
  string,
  {
    id: string;
    name?: string;
    members: Array<{
      tag_team_id?: string;
      wrestler_slug: string;
      member_order?: number;
      wrestler_name?: string;
      wrestler_gender?: string;
      wrestler_brand?: string;
    }>;
  }
>;

export async function fetchWrestlersForBoxscoreEditor(): Promise<BoxscoreWrestlerRow[]> {
  const admin = getAdminClient();
  if (!admin) return [];
  const { data, error } = await admin.from("wrestlers").select("id, name, gender, brand").order("name");
  if (error || !data) return [];
  return data as BoxscoreWrestlerRow[];
}

export async function buildTagTeamDataForVisualBuilder(): Promise<BoxscoreTagTeamDataMap> {
  const admin = getAdminClient();
  if (!admin) return {};

  const { data: tagTeams, error: teamsErr } = await admin.from("tag_teams").select("*");
  if (teamsErr || !tagTeams?.length) return {};

  const { data: tagTeamMembers, error: membersErr } = await admin.from("tag_team_members").select("*");
  if (membersErr) return {};

  const { data: wrestlers, error: wErr } = await admin.from("wrestlers").select("id, name, gender, brand");
  if (wErr) return {};

  const wList = (wrestlers || []) as Array<{ id: string; name?: string; gender?: string; brand?: string }>;
  const teamData: BoxscoreTagTeamDataMap = {};

  for (const team of tagTeams as Array<{ id: string; name?: string }>) {
    const teamMembers = (tagTeamMembers || [])
      .filter((m: { tag_team_id: string }) => m.tag_team_id === team.id)
      .sort((a: { member_order?: number }, b: { member_order?: number }) => (a.member_order || 0) - (b.member_order || 0))
      .map((member: { wrestler_slug: string; member_order?: number }) => {
        const wrestler = wList.find((w) => w.id === member.wrestler_slug);
        return {
          ...member,
          wrestler_name: wrestler?.name || member.wrestler_slug,
          wrestler_gender: wrestler?.gender || "male",
          wrestler_brand: wrestler?.brand || "",
        };
      });

    teamData[team.id] = {
      ...team,
      members: teamMembers,
    };
  }

  return teamData;
}
