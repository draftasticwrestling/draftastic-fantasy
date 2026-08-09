/**
 * Admin league list lifecycle classification (active / recently completed / inactive / archived).
 * Pure helpers — safe for server components.
 */

import { getMinimumTeamsForLeagueType } from "@/lib/leagueStructure";
import { addDaysToYmd } from "@/lib/publicLeagueSchedule";
import { getCivilYmdInPst, isPastEndOfDayPst } from "@/lib/pstCivilTime";
import { LEAGUE_AUTO_ARCHIVE_DAYS_AFTER_END } from "@/lib/leagueArchiveConstants";

/** Private leagues with too few owners / no completed draft → inactive after this many days. */
export const PRIVATE_LEAGUE_INACTIVE_AFTER_DAYS = 14;

/** Underfilled private leagues auto-archive this many days after creation. */
export const PRIVATE_LEAGUE_ABANDON_ARCHIVE_AFTER_DAYS = 28;

export type LeagueAdminView = "active" | "recently-completed" | "archived" | "inactive";

export const LEAGUE_ADMIN_VIEWS: readonly {
  id: LeagueAdminView;
  label: string;
}[] = [
  { id: "active", label: "Active Leagues" },
  { id: "recently-completed", label: "Recently Completed Leagues" },
  { id: "archived", label: "Archived Leagues" },
  { id: "inactive", label: "Inactive Leagues" },
] as const;

export type LeagueLifecycleFields = {
  visibility_type?: string | null;
  league_type?: string | null;
  draft_status?: string | null;
  end_date?: string | null;
  created_at?: string | null;
  is_archived?: boolean | null;
  is_inactive?: boolean | null;
  member_count?: number;
};

export function isPublicVisibility(visibilityType: string | null | undefined): boolean {
  return String(visibilityType ?? "").trim().toLowerCase() === "public";
}

/** Draft completed + at least the format minimum number of owners. */
export function isLeagueFullyStarted(row: LeagueLifecycleFields): boolean {
  const min = getMinimumTeamsForLeagueType(row.league_type);
  const members = Number(row.member_count ?? 0);
  const draftDone = String(row.draft_status ?? "").trim().toLowerCase() === "completed";
  return draftDone && members >= min;
}

/**
 * Private league that never reached enough owners (abandoned shell).
 * Draft status is ignored — unfinished offline drafts with enough owners stay Active.
 * Public leagues use a different registration lifecycle and are excluded.
 */
export function isPrivateLeagueUnderfilled(row: LeagueLifecycleFields): boolean {
  if (isPublicVisibility(row.visibility_type)) return false;
  const min = getMinimumTeamsForLeagueType(row.league_type);
  return Number(row.member_count ?? 0) < min;
}

export function createdOnYmd(createdAt: string | null | undefined): string | null {
  const raw = String(createdAt ?? "").trim();
  if (!raw) return null;
  // created_at is timestamptz — use Pacific civil date for grace windows.
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) {
    const ymd = raw.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
  }
  return getCivilYmdInPst(ms);
}

export function parseLeagueAdminView(raw: string | null | undefined): LeagueAdminView {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "recently-completed" || v === "recent" || v === "completed") return "recently-completed";
  if (v === "archived") return "archived";
  if (v === "inactive") return "inactive";
  if (v === "current") return "active"; // legacy query param
  return "active";
}

export function classifyLeagueAdminView(
  row: LeagueLifecycleFields,
  nowMs: number = Date.now()
): LeagueAdminView {
  if (Boolean(row.is_archived)) return "archived";
  if (Boolean(row.is_inactive)) return "inactive";
  const endYmd = String(row.end_date ?? "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(endYmd) && isPastEndOfDayPst(endYmd, nowMs)) {
    return "recently-completed";
  }
  return "active";
}

/** Sort key for private Active list: fully started leagues first, then newer created_at. */
export function comparePrivateActiveLeagues(
  a: LeagueLifecycleFields & { created_at?: string | null; name?: string | null },
  b: LeagueLifecycleFields & { created_at?: string | null; name?: string | null }
): number {
  const aStarted = isLeagueFullyStarted(a) ? 0 : 1;
  const bStarted = isLeagueFullyStarted(b) ? 0 : 1;
  if (aStarted !== bStarted) return aStarted - bStarted;
  const ac = String(a.created_at ?? "");
  const bc = String(b.created_at ?? "");
  if (ac !== bc) return bc.localeCompare(ac);
  return String(a.name ?? "").localeCompare(String(b.name ?? ""));
}

export function privateInactiveEligibleOnYmd(createdYmd: string): string {
  return addDaysToYmd(createdYmd, PRIVATE_LEAGUE_INACTIVE_AFTER_DAYS);
}

export function privateAbandonArchiveEligibleOnYmd(createdYmd: string): string {
  return addDaysToYmd(createdYmd, PRIVATE_LEAGUE_ABANDON_ARCHIVE_AFTER_DAYS);
}

export function isDueForPrivateInactive(
  row: LeagueLifecycleFields,
  nowMs: number = Date.now()
): boolean {
  if (Boolean(row.is_archived) || Boolean(row.is_inactive)) return false;
  if (!isPrivateLeagueUnderfilled(row)) return false;
  const createdYmd = createdOnYmd(row.created_at);
  if (!createdYmd) return false;
  return getCivilYmdInPst(nowMs) >= privateInactiveEligibleOnYmd(createdYmd);
}

export function isDueForPrivateAbandonArchive(
  row: LeagueLifecycleFields,
  nowMs: number = Date.now()
): boolean {
  if (Boolean(row.is_archived)) return false;
  if (!isPrivateLeagueUnderfilled(row)) return false;
  const createdYmd = createdOnYmd(row.created_at);
  if (!createdYmd) return false;
  return getCivilYmdInPst(nowMs) >= privateAbandonArchiveEligibleOnYmd(createdYmd);
}

/** Copy for admin UI about post-season archive window. */
export function recentlyCompletedArchiveHint(): string {
  return `Auto-archives ${LEAGUE_AUTO_ARCHIVE_DAYS_AFTER_END} days after season end (once a champion is recorded).`;
}
