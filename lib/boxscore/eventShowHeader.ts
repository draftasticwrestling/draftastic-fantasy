/**
 * Boxscore-style event page header helpers (mirrors wrestling-boxscore App.jsx EventBoxScore).
 */

import { classifyEventType } from "@/lib/scoring/parsers/eventClassifier.js";
import { getEventLogoUrl } from "@/lib/howItWorksImages";

export type EventShowFilter = "raw" | "smackdown" | "nxt" | "ple";

/** Classify event for show filter: raw | smackdown | ple (from name only). */
export function getEventShowType(event: { name?: string | null } | null | undefined): EventShowFilter {
  const name = (event?.name || "").toLowerCase().trim();
  if (name.includes("raw") && !name.includes("tag team")) return "raw";
  if (name.includes("smackdown") || name.includes("smack down")) return "smackdown";
  if (name === "nxt" || name.includes("wwe nxt") || name.startsWith("nxt ")) return "nxt";
  return "ple";
}

const EVENT_LOGO_MAP: Record<string, string> = {
  raw: "raw_logo.png",
  smackdown: "smackdown_logo.png",
  "wrestlemania night 1": "wrestlemania_logo.png",
  "wrestlemania night 2": "wrestlemania_logo.png",
  "summer slam night 1": "summer_slam.png",
  "summer slam night 2": "summer_slam.png",
  "night of champions": "night_of_champions.png",
  "survivor series": "survivor_series.png",
  "saturday night's main event": "saturday_nights_main_event.png",
};

/**
 * Logo URL for an event card or header. Prefer `classifyEventType` + `/images/event-logos/` (same as hub
 * EventListBar); fall back to legacy `/images/*.png` names when type is unknown.
 */
export function getEventLogoPath(name: string | null | undefined, eventId?: string | null): string {
  if (!name) return "/images/raw_logo.png";
  const typed = classifyEventType(name, eventId ?? "");
  const fromLogos = getEventLogoUrl(typed);
  if (fromLogos) return fromLogos;

  const key = name.trim().toLowerCase();
  if (EVENT_LOGO_MAP[key]) return `/images/${EVENT_LOGO_MAP[key]}`;
  const auto = `${key.replace(/[^a-z0-9]+/g, "_").replace(/_+$/, "")}.png`;
  return `/images/${auto}`;
}

export function formatEventHeaderDateLong(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split("-");
    const month = new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-US", {
      month: "long",
    });
    return `${month} ${d}, ${y}`;
  }
  const dateObj = new Date(dateStr);
  if (Number.isNaN(dateObj.getTime())) return String(dateStr);
  return dateObj.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatEventHeaderDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  let dateObj: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split("-").map(Number);
    dateObj = new Date(year, month - 1, day);
  } else {
    dateObj = new Date(dateStr);
  }
  if (Number.isNaN(dateObj.getTime())) return "";
  return dateObj.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function isTodayEvent(event: { date?: string | null }): boolean {
  if (!event?.date) return false;
  const parts = event.date.split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return false;
  const [year, month, day] = parts;
  const eventDate = new Date(year, month - 1, day);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return eventDate.getTime() === today.getTime();
}

function isYesterdayEvent(event: { date?: string | null }): boolean {
  if (!event?.date) return false;
  const parts = event.date.split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return false;
  const [year, month, day] = parts;
  const eventDate = new Date(year, month - 1, day);
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return eventDate.getTime() === yesterday.getTime();
}

export function getEventDateRecency(event: { date?: string | null } | null | undefined): "last night" | "tonight" | null {
  if (!event?.date) return null;
  if (isYesterdayEvent(event)) return "last night";
  if (isTodayEvent(event)) return "tonight";
  return null;
}

export function formatBroadcastDateTime(isoTs: string | null | undefined): string {
  if (!isoTs) return "";
  const d = new Date(isoTs);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function buildTitleShow(event: { name?: string | null }): string {
  const showType = getEventShowType(event);
  const showLabel =
    showType === "raw"
      ? "Raw"
      : showType === "smackdown"
        ? "SmackDown"
        : showType === "nxt"
          ? "NXT"
          : null;
  return showLabel ? `WWE ${showLabel}` : `WWE ${(event.name || "").trim() || "Event"}`;
}

export function buildBrandPrefix(event: { name?: string | null }): string {
  const showType = getEventShowType(event);
  const showLabel =
    showType === "raw"
      ? "Raw"
      : showType === "smackdown"
        ? "SmackDown"
        : showType === "nxt"
          ? "NXT"
          : null;
  return showLabel || (event.name || "").split(" ")[0] || "WWE";
}

/** Listing card title (Boxscore-style): RAW / SmackDown / full PLE or special event name. */
export function getEventResultsCardTitle(event: { name?: string | null }): string {
  const showType = getEventShowType(event);
  if (showType === "raw") return "RAW";
  if (showType === "smackdown") return "SmackDown";
  if (showType === "nxt") return "NXT";
  const n = (event.name || "").trim();
  return n || "WWE Event";
}

/** One line under card title: March 27, 2026 — Pittsburgh, PA */
export function formatEventResultsListMetaLine(event: { date?: string | null; location?: string | null }): string {
  const datePart = formatEventHeaderDateLong(event.date);
  const loc = event.location?.trim();
  if (datePart && loc) return `${datePart} — ${loc}`;
  return datePart || loc || "";
}

/** Grey meta line under H1 (Boxscore EventBoxScore). */
export function buildEventHeaderMetaDescription(event: {
  name?: string | null;
  date?: string | null;
  location?: string | null;
}): string {
  const formattedDate = formatEventHeaderDateLong(event.date);
  const recency = getEventDateRecency(event);
  const showType = getEventShowType(event);
  const showLabel =
    showType === "raw"
      ? "Raw"
      : showType === "smackdown"
        ? "SmackDown"
        : showType === "nxt"
          ? "NXT"
          : null;
  const loc = event.location?.trim();
  const locSuffix = loc ? ` in ${loc}` : "";

  if (recency && showLabel) {
    return `Full WWE ${showLabel} results from ${recency} (${formattedDate})${loc ? ` in ${loc}` : ""}. Match card, winners, times, and title changes.`;
  }
  if (recency) {
    return `Full WWE results from ${recency} (${formattedDate})${locSuffix}. Match card, winners, times, and title changes.`;
  }
  if (showLabel) {
    return `Full WWE ${showLabel} results for ${formattedDate}${locSuffix}. Match card, winners, methods, and championship updates.`;
  }
  return `Full WWE results for ${formattedDate}${locSuffix}. Match card, winners, methods, and championship updates.`;
}

/** Browser tab title (~60 chars), Boxscore-style. */
export function buildEventSeoTitle(event: { name?: string | null; date?: string | null }): string {
  const titleShow = buildTitleShow(event);
  const short = formatEventHeaderDateShort(event.date);
  return `${titleShow} Results — ${short} | Draftastic Fantasy`;
}
