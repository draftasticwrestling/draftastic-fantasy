import type { SupabaseClient } from "@supabase/supabase-js";

import { getEffectiveLeagueStartDate } from "@/lib/leagues";
import { getTodayTomorrowYmdET } from "@/lib/home/hubHomeEvents";
import {
  buildRelevantMatchOrdersForRosterOnEvent,
  eventPreviewVariantFromStatus,
  type LeagueEventDayCondensedItem,
  type LeagueEventDayRow,
} from "@/lib/league/eventDayRosterMatches";

export type LeagueEventDaySectionPayload = {
  todayLabelEt: string;
  items: LeagueEventDayCondensedItem[];
  wrestlerRows: { id: string; name: string | null; image_url: string | null }[];
};

type LeagueLike = {
  start_date: string | null;
  end_date: string | null;
  draft_date?: string | null;
  created_at?: string;
};

/**
 * Condensed “today’s card” for whichever faction’s `rosterUserId` you pass (league hub: yours; faction page: the page owner).
 * Returns null when outside the league season window or when there are no PWBS events dated today (ET).
 */
export async function getLeagueEventDayViewerSection(
  supabase: SupabaseClient,
  league: LeagueLike,
  rosterUserId: string,
  rosters: Record<string, { wrestler_id: string }[]>,
  wrestlerCatalog: { id: string; name: string | null; image_url: string | null }[]
): Promise<LeagueEventDaySectionPayload | null> {
  const todayYmd = getTodayTomorrowYmdET().today;
  const etNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const todayLabelEt = etNow.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const leagueStartYmd = getEffectiveLeagueStartDate(league);
  const leagueEndYmd = league.end_date ? String(league.end_date).trim().slice(0, 10) : null;
  const inSeason = todayYmd >= leagueStartYmd && (!leagueEndYmd || todayYmd <= leagueEndYmd);
  if (!inSeason) return null;

  const { data: todayEvents } = await supabase
    .from("events")
    .select("id, name, date, matches, status, location")
    .eq("date", todayYmd)
    .order("name", { ascending: true });

  const todayEventsRows = (todayEvents ?? []) as LeagueEventDayRow[];
  if (todayEventsRows.length === 0) return null;

  const wrestlerNameById = Object.fromEntries(
    wrestlerCatalog.map((w) => [w.id, (w.name ?? w.id).trim()])
  );
  const rosterWrestlerIds = (rosters[rosterUserId] ?? []).map((e) => e.wrestler_id);

  const items: LeagueEventDayCondensedItem[] = todayEventsRows.map((ev) => ({
    event: ev,
    allowedMatchOrders: buildRelevantMatchOrdersForRosterOnEvent(ev, rosterWrestlerIds, wrestlerNameById),
    variant: eventPreviewVariantFromStatus(ev.status),
  }));

  const wrestlerRows = wrestlerCatalog.map((w) => ({
    id: w.id,
    name: w.name,
    image_url: w.image_url ?? null,
  }));

  return { todayLabelEt, items, wrestlerRows };
}
