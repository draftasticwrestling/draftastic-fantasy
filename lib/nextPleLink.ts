import "server-only";

import { eventResultsHref } from "@/lib/event-results/eventResultsRoute";
import { leagueIncludesNxt, ROAD_TO_SUMMERSLAM_SEASON_SLUG } from "@/lib/leagueStructure";
import { pickNextPleOnSchedule, type PleScheduleRow } from "@/lib/nextPleSchedule";
import { pleDefaultHref } from "@/lib/pleLeagueMenu";
import { getCivilYmdInPst } from "@/lib/pstCivilTime";
import { supabase } from "@/lib/supabase";

const UPCOMING_PLE_LISTING = "/event-results?tab=upcoming&show=ple";

export type NextPleLeague = {
  slug: string;
  season_slug?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  include_nxt?: boolean | null;
  league_type?: string | null;
};

export type NextPleLink = {
  href: string;
  label: string;
};

/**
 * Where "Next PLE" should go.
 * Road to SummerSlam keeps its season PLE pages.
 * Every other league opens the next premium live event on the events schedule.
 */
export async function resolveNextPleLink(league: NextPleLeague): Promise<NextPleLink> {
  if ((league.season_slug ?? null) === ROAD_TO_SUMMERSLAM_SEASON_SLUG) {
    return {
      href: pleDefaultHref(league.slug, league.season_slug, league.start_date, league.end_date),
      label: "PLEs",
    };
  }

  const todayYmd = getCivilYmdInPst(Date.now());
  const includeNxt = leagueIncludesNxt(league);
  const { data, error } = await supabase
    .from("events")
    .select("id, name, date, status")
    .gte("date", todayYmd)
    .order("date", { ascending: true })
    .order("name", { ascending: true })
    .limit(120);

  if (error || !data?.length) {
    return { href: UPCOMING_PLE_LISTING, label: "Next PLE" };
  }

  const next = pickNextPleOnSchedule(data as PleScheduleRow[], { todayYmd, includeNxt });
  if (!next) {
    return { href: UPCOMING_PLE_LISTING, label: "Next PLE" };
  }

  const name = String(next.name ?? "").trim();
  return {
    href: eventResultsHref(next),
    label: name || "Next PLE",
  };
}
