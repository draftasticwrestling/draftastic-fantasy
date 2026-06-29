import { fromZonedTime } from "date-fns-tz";

import { BELT_HOLD_TIMEZONE } from "@/lib/pstCivilTime";
import { getEventBroadcastStartMs } from "@/lib/eventBroadcastStart";
import type { HubPreviewEventRow } from "@/lib/home/hubHomeEvents";

const ET_ZONE = "America/New_York";
const SHOW_DURATION_MS = 4 * 60 * 60 * 1000;
const POST_SHOW_GRACE_MS = 12 * 60 * 60 * 1000;
const PRE_SHOW_LEAD_MS = 12 * 60 * 60 * 1000;

const etYmdFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ET_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Civil YYYY-MM-DD in America/New_York. */
export function getCivilYmdInEt(utcMs: number): string {
  return etYmdFormatter.format(new Date(utcMs));
}

function addDaysToYmd(ymd: string, days: number): string {
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(5, 7)) - 1;
  const d = Number(ymd.slice(8, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return "";
  const dt = new Date(Date.UTC(y, m, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** First instant of 8:00am PT on the calendar day **after** `eventDateYmd` (listed show date). */
export function eightAmPtMorningAfterListedEventDateMs(eventDateYmd: string): number | null {
  const d = String(eventDateYmd ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const next = addDaysToYmd(d, 1);
  if (!next) return null;
  return fromZonedTime(`${next}T08:00:00`, BELT_HOLD_TIMEZONE).getTime();
}

/** Broadcast start as UTC ms: DB column when set, else same ET default as boxscore backfill. */
export function getHubEventBroadcastStartMs(e: HubPreviewEventRow): number | null {
  return getEventBroadcastStartMs(e);
}

/**
 * End of “results / pre-show spotlight” window for a show: min(start + duration + 12h, 8am PT the morning after listed event date).
 */
export function hubLatestShowcasePinUntilMs(e: HubPreviewEventRow): number | null {
  const start = getHubEventBroadcastStartMs(e);
  if (start == null) return null;
  const date = String(e.date ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const softEnd = start + SHOW_DURATION_MS + POST_SHOW_GRACE_MS;
  const eightAm = eightAmPtMorningAfterListedEventDateMs(date);
  if (eightAm == null) return softEnd;
  return Math.min(softEnd, eightAm);
}

/** Through show + post grace / 8am cap (same upper bound as {@link hubLatestShowcasePinUntilMs}). */
export function hubLatestIsInShowcasePinWindow(e: HubPreviewEventRow, nowMs: number): boolean {
  const until = hubLatestShowcasePinUntilMs(e);
  if (until == null) return false;
  const start = getHubEventBroadcastStartMs(e);
  if (start == null) return false;
  return nowMs >= start - PRE_SHOW_LEAD_MS && nowMs < until;
}

export function hubLatestCompletedResultsShouldPinTop(e: HubPreviewEventRow, nowMs: number): boolean {
  const until = hubLatestShowcasePinUntilMs(e);
  if (until == null) return false;
  return nowMs < until;
}
