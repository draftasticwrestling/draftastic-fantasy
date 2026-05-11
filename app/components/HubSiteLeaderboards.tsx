import { getHubSiteLeaderboards } from "@/lib/hubSiteLeaderboards";
import HubSiteLeaderboardsClient from "@/app/components/HubSiteLeaderboardsClient";

type Props = {
  leaderboardWeek?: string | null;
};

export default async function HubSiteLeaderboards({ leaderboardWeek = null }: Props) {
  const initial = await getHubSiteLeaderboards({ leaderboardWeek });
  if (!initial.hubLeaderboardsAvailable) {
    return null;
  }
  return <HubSiteLeaderboardsClient initial={initial} />;
}
