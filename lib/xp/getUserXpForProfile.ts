import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getXpLevelInfo } from "@/lib/xp/xpLevels";

export type UserXpProfile = {
  totalXp: number;
  level: ReturnType<typeof getXpLevelInfo>;
};

export async function getUserXpForProfile(userId: string): Promise<UserXpProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("user_xp_state").select("total_xp").eq("user_id", userId).maybeSingle();
  if (error && /user_xp_state|does not exist|relation/i.test(error.message ?? "")) {
    return { totalXp: 0, level: getXpLevelInfo(0) };
  }
  if (error) return null;
  const xp = Math.max(0, Number((data as { total_xp?: number } | null)?.total_xp ?? 0));
  return { totalXp: xp, level: getXpLevelInfo(xp) };
}
