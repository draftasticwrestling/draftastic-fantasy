import type { EventShowFilter } from "@/lib/boxscore/eventShowHeader";

export const SITE_ADMIN_EVENTS_DEFAULT_LIMIT = 25;

export const SITE_ADMIN_EVENTS_LIMIT_OPTIONS = [25, 50, 100, 150, 200] as const;

export type SiteAdminEventsLimit = (typeof SITE_ADMIN_EVENTS_LIMIT_OPTIONS)[number];

export type SiteAdminEventStatusFilter = "all" | "upcoming" | "completed" | "live";

export const SITE_ADMIN_EVENTS_DEFAULT_STATUS: SiteAdminEventStatusFilter = "completed";

export type SiteAdminEventShowFilter = "all" | EventShowFilter;

export type BoxscoreEventsListSearchParams = {
  q?: string;
  date?: string;
  id?: string;
  ok?: string;
  status?: string;
  show?: string;
  limit?: string;
};

export function parseSiteAdminEventsLimit(raw: string | undefined): SiteAdminEventsLimit {
  const n = Number.parseInt(raw ?? "", 10);
  if (SITE_ADMIN_EVENTS_LIMIT_OPTIONS.includes(n as SiteAdminEventsLimit)) {
    return n as SiteAdminEventsLimit;
  }
  return SITE_ADMIN_EVENTS_DEFAULT_LIMIT;
}

export function parseSiteAdminEventStatusFilter(raw: string | undefined): SiteAdminEventStatusFilter {
  if (raw === undefined || raw.trim() === "") {
    return SITE_ADMIN_EVENTS_DEFAULT_STATUS;
  }
  const v = raw.trim().toLowerCase();
  if (v === "upcoming" || v === "completed" || v === "live" || v === "all") return v;
  return SITE_ADMIN_EVENTS_DEFAULT_STATUS;
}

export function parseSiteAdminEventShowFilter(raw: string | undefined): SiteAdminEventShowFilter {
  const v = (raw ?? "all").trim().toLowerCase();
  if (v === "raw" || v === "smackdown" || v === "nxt" || v === "ple") return v;
  return "all";
}

/** Build list URL preserving active filters (omit defaults). */
export function buildBoxscoreEventsListHref(params: {
  q?: string;
  date?: string;
  id?: string;
  ok?: string;
  status?: SiteAdminEventStatusFilter;
  show?: SiteAdminEventShowFilter;
  limit?: SiteAdminEventsLimit | number;
}): string {
  const sp = new URLSearchParams();
  const id = params.id?.trim();
  const date = params.date?.trim();
  const q = params.q?.trim();
  if (id) sp.set("id", id);
  if (date) sp.set("date", date);
  if (q) sp.set("q", q);
  if (params.status === "all") {
    sp.set("status", "all");
  } else if (params.status && params.status !== SITE_ADMIN_EVENTS_DEFAULT_STATUS) {
    sp.set("status", params.status);
  }
  if (params.show && params.show !== "all") sp.set("show", params.show);
  const limit = parseSiteAdminEventsLimit(
    params.limit !== undefined ? String(params.limit) : undefined
  );
  if (limit !== SITE_ADMIN_EVENTS_DEFAULT_LIMIT) sp.set("limit", String(limit));
  if (params.ok) sp.set("ok", params.ok);
  const qs = sp.toString();
  return `/internal-admin/boxscore/events${qs ? `?${qs}` : ""}`;
}

export function nextSiteAdminEventsLimit(current: SiteAdminEventsLimit): SiteAdminEventsLimit | null {
  const idx = SITE_ADMIN_EVENTS_LIMIT_OPTIONS.indexOf(current);
  if (idx < 0 || idx >= SITE_ADMIN_EVENTS_LIMIT_OPTIONS.length - 1) return null;
  return SITE_ADMIN_EVENTS_LIMIT_OPTIONS[idx + 1];
}
