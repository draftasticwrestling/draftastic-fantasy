import "server-only";

import { unstable_cache } from "next/cache";
import { getAdminClient } from "@/lib/supabase/admin";
import { ROAD_TO_WAR_GAMES_2026 } from "@/lib/leagueSeasons";
import {
  RTSS_2026_SEASON_KEY,
  listRoadToWarGames2026ChampionsForHub,
  listSeasonChampionsForHub,
  type ChampionDisplayRow,
} from "@/lib/leagueSeasonPlacements";
import { isPastEndOfDayPst } from "@/lib/pstCivilTime";

export type HubRtssChampionsPayload = {
  available: boolean;
  season: "rtss" | "rtwg";
  champions: ChampionDisplayRow[];
};

async function loadHubRtssChampionsUncached(): Promise<HubRtssChampionsPayload> {
  const admin = getAdminClient();
  if (!admin) return { available: false, season: "rtss", champions: [] };
  const showWarGames = isPastEndOfDayPst(ROAD_TO_WAR_GAMES_2026.season_end_ymd);
  try {
    if (showWarGames) {
      const champions = await listRoadToWarGames2026ChampionsForHub(admin);
      return { available: true, season: "rtwg", champions };
    }
    const champions = await listSeasonChampionsForHub(admin, RTSS_2026_SEASON_KEY);
    return { available: true, season: "rtss", champions };
  } catch {
    return { available: true, season: showWarGames ? "rtwg" : "rtss", champions: [] };
  }
}

export const getHubRtssChampions = unstable_cache(
  loadHubRtssChampionsUncached,
  ["hub-season-champions-v2"],
  { revalidate: 120 }
);
