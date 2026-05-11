import HubSiteLeaderboardsClient from "@/app/components/HubSiteLeaderboardsClient";
import { getAdminClient } from "@/lib/supabase/admin";
import { getHubSiteLeaderboards, normalizeHubLeaderboardWeekStart } from "@/lib/hubSiteLeaderboards";
import { getCurrentWeekStartMondayPst } from "@/lib/weeklyLeaderboards";

type Props = {
  leaderboardWeek?: string | null;
};

export default async function HubSiteLeaderboards({ leaderboardWeek = null }: Props) {
  if (!getAdminClient()) {
    return null;
  }
  const currentMonday = getCurrentWeekStartMondayPst();
  const selected = normalizeHubLeaderboardWeekStart(leaderboardWeek ?? null, currentMonday);
  const initial = await getHubSiteLeaderboards({ leaderboardWeek: selected });
  if (!initial.hubLeaderboardsAvailable) {
    return null;
  }
  return <HubSiteLeaderboardsClient initial={initial} />;
}
