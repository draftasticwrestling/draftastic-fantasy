import { fromZonedTime } from "date-fns-tz";
import { validateProfileTimezone } from "@/lib/profileTimezone";
import { BELT_HOLD_TIMEZONE, getCivilYmdInPst } from "@/lib/pstCivilTime";

export type DraftScheduleInput = {
  draft_date?: string | null;
  draft_time?: string | null;
  draft_timezone?: string | null;
};

/** "HH:MM" from an HTML time value, or from a stored "HH:MM|Timezone" value. */
export function normalizeDraftClock(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!/^\d{1,2}:\d{2}/.test(s)) return null;
  const [h, m] = s.slice(0, 5).split(":");
  return `${h.padStart(2, "0")}:${m}`;
}

/** Timezone packed into draft_time when the draft_timezone column is not in the database yet. */
function embeddedDraftTimezone(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  const bar = s.indexOf("|");
  if (bar < 0) return null;
  return normalizeDraftTimezone(s.slice(bar + 1));
}

export function storedDraftTimezone(league: DraftScheduleInput): string | null {
  return normalizeDraftTimezone(league.draft_timezone) ?? embeddedDraftTimezone(league.draft_time);
}

export function normalizeDraftTimezone(raw: string | null | undefined): string | null {
  const check = validateProfileTimezone(raw);
  return check.ok ? check.value : null;
}

/**
 * Absolute draft start. A saved timezone is interpreted in that zone.
 * Rows saved before timezones existed stay on the previous server-local parse.
 */
export function getDraftStartMs(league: DraftScheduleInput): number | null {
  const datePart = league.draft_date ? String(league.draft_date).slice(0, 10) : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
  const time = normalizeDraftClock(league.draft_time) ?? (String(league.draft_date).length > 10 ? String(league.draft_date).slice(11, 16) : "00:00");
  const clock = /^\d{2}:\d{2}$/.test(time) ? time : "00:00";
  const zone = storedDraftTimezone(league);
  if (zone) {
    const ms = fromZonedTime(`${datePart}T${clock}:00`, zone).getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  const candidate = new Date(`${datePart}T${clock}:00`);
  return Number.isNaN(candidate.getTime()) ? null : candidate.getTime();
}

/** Calendar day used for "on or after draft day". Saved timezone, otherwise Pacific (the previous rule). */
export function getDraftDayYmd(nowMs: number, timezone: string | null | undefined): string {
  const zone = normalizeDraftTimezone(timezone) ?? embeddedDraftTimezone(timezone);
  if (!zone) return getCivilYmdInPst(nowMs);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(nowMs));
}

export type DraftScheduleLabels = {
  dateLabel: string | null;
  /** Clock the GM set, with its abbreviation. Example: "4:30 PM PST". */
  leagueTimeLabel: string | null;
  /** Viewer's own clock when their profile timezone differs. Example: "7:30 PM EST". */
  viewerTimeLabel: string | null;
};

function clockInZone(ms: number, timeZone: string): { time: string; zone: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).formatToParts(new Date(ms));
  const hour = parts.find((p) => p.type === "hour")?.value ?? "";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "";
  const dayPeriod = parts.find((p) => p.type === "dayPeriod")?.value ?? "";
  const zone = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  return { time: `${hour}:${minute} ${dayPeriod}`.trim(), zone };
}

function bareClockLabel(clock: string): string {
  const [h, m] = clock.split(":").map(Number);
  const hour = h % 12 || 12;
  const ampm = h < 12 ? "AM" : "PM";
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function formatDraftSchedule(
  league: DraftScheduleInput,
  viewerTimezone?: string | null
): DraftScheduleLabels {
  const datePart = league.draft_date ? String(league.draft_date).slice(0, 10) : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return { dateLabel: null, leagueTimeLabel: null, viewerTimeLabel: null };
  }
  const zone = storedDraftTimezone(league);
  const dateZone = zone ?? "UTC";
  const noon = zone ? fromZonedTime(`${datePart}T12:00:00`, zone) : new Date(`${datePart}T12:00:00Z`);
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: dateZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(noon);

  const clock = normalizeDraftClock(league.draft_time);
  if (!clock) return { dateLabel, leagueTimeLabel: null, viewerTimeLabel: null };
  if (!zone) return { dateLabel, leagueTimeLabel: bareClockLabel(clock), viewerTimeLabel: null };

  const startMs = fromZonedTime(`${datePart}T${clock}:00`, zone).getTime();
  const leagueClock = clockInZone(startMs, zone);
  const leagueTimeLabel = `${leagueClock.time} ${leagueClock.zone}`.trim();
  const viewerZone = normalizeDraftTimezone(viewerTimezone);
  let viewerTimeLabel: string | null = null;
  if (viewerZone && viewerZone !== zone) {
    const viewerClock = clockInZone(startMs, viewerZone);
    viewerTimeLabel = `${viewerClock.time} ${viewerClock.zone}`.trim();
  }
  return { dateLabel, leagueTimeLabel, viewerTimeLabel };
}

/** One line for banners and the draft room. Same-zone viewers see only the league time. */
export function draftScheduleTimeLine(labels: DraftScheduleLabels): string | null {
  if (!labels.leagueTimeLabel) return null;
  if (labels.viewerTimeLabel) return `${labels.leagueTimeLabel} · ${labels.viewerTimeLabel} your time`;
  return labels.leagueTimeLabel;
}

export function defaultDraftTimezone(saved: string | null | undefined, profileTimezone: string | null | undefined): string {
  return normalizeDraftTimezone(saved) ?? normalizeDraftTimezone(profileTimezone) ?? BELT_HOLD_TIMEZONE;
}

export function readDraftScheduleFromForm(
  formData: FormData
):
  | { ok: true; draft_date: string | null; draft_time: string | null; draft_timezone: string | null }
  | { ok: false; error: string } {
  const draft_date = (formData.get("draft_date") as string)?.trim() || null;
  if (draft_date && !/^\d{4}-\d{2}-\d{2}$/.test(draft_date)) {
    return { ok: false, error: "Enter a valid draft date." };
  }
  const draft_time = draft_date ? normalizeDraftClock((formData.get("draft_time") as string) ?? "") : null;
  const tzRaw = ((formData.get("draft_timezone") as string) ?? "").trim();
  if (draft_time) {
    const draft_timezone = normalizeDraftTimezone(tzRaw);
    if (!draft_timezone) return { ok: false, error: "Choose the timezone for this draft time." };
    return { ok: true, draft_date, draft_time, draft_timezone };
  }
  return {
    ok: true,
    draft_date,
    draft_time: null,
    draft_timezone: draft_date ? normalizeDraftTimezone(tzRaw) : null,
  };
}
