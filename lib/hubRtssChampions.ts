import "server-only";

import { unstable_cache } from "next/cache";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  RTSS_2026_SEASON_KEY,
  listSeasonChampionsForHub,
  type ChampionDisplayRow,
} from "@/lib/leagueSeasonPlacements";

export type HubRtssChampionsPayload = {
  available: boolean;
  champions: ChampionDisplayRow[];
};

async function loadHubRtssChampionsUncached(): Promise<HubRtssChampionsPayload> {
  const admin = getAdminClient();
  if (!admin) return { available: false, champions: [] };
  try {
    const champions = await listSeasonChampionsForHub(admin, RTSS_2026_SEASON_KEY);
    return { available: true, champions };
  } catch {
    return { available: true, champions: [] };
  }
}

export const getHubRtssChampions = unstable_cache(
  loadHubRtssChampionsUncached,
  ["hub-rtss-2026-champions"],
  { revalidate: 120 }
);
