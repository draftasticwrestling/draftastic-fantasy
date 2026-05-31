import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";

export type BreakingNewsRow = {
  id: string;
  message: string;
  link_href: string | null;
  link_label: string | null;
  enabled: boolean;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BreakingNewsItem = {
  id: string;
  message: string;
  linkHref: string | null;
  linkLabel: string | null;
};

function isWithinSchedule(row: BreakingNewsRow, nowMs: number): boolean {
  if (row.starts_at) {
    const startMs = Date.parse(row.starts_at);
    if (Number.isFinite(startMs) && nowMs < startMs) return false;
  }
  if (row.ends_at) {
    const endMs = Date.parse(row.ends_at);
    if (Number.isFinite(endMs) && nowMs > endMs) return false;
  }
  return true;
}

function toItem(row: BreakingNewsRow): BreakingNewsItem {
  return {
    id: row.id,
    message: row.message,
    linkHref: row.link_href,
    linkLabel: row.link_label,
  };
}

/** Active rows for the homepage chyron (enabled + within optional schedule window). */
export async function getActiveBreakingNews(): Promise<BreakingNewsItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_breaking_news")
    .select("id, message, link_href, link_label, enabled, sort_order, starts_at, ends_at, created_at")
    .eq("enabled", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  const nowMs = Date.now();
  return (data as BreakingNewsRow[])
    .filter((row) => isWithinSchedule(row, nowMs))
    .map(toItem);
}

export type BreakingNewsAdminStatus = "active" | "scheduled" | "expired" | "disabled";

export function breakingNewsAdminStatus(row: BreakingNewsRow, nowMs = Date.now()): BreakingNewsAdminStatus {
  if (!row.enabled) return "disabled";
  if (row.starts_at) {
    const startMs = Date.parse(row.starts_at);
    if (Number.isFinite(startMs) && nowMs < startMs) return "scheduled";
  }
  if (row.ends_at) {
    const endMs = Date.parse(row.ends_at);
    if (Number.isFinite(endMs) && nowMs > endMs) return "expired";
  }
  return "active";
}

/** All rows for site admin list (service role). */
export async function listBreakingNewsForAdmin(): Promise<BreakingNewsRow[]> {
  const admin = getAdminClient();
  if (!admin) return [];

  const { data, error } = await admin
    .from("site_breaking_news")
    .select("id, message, link_href, link_label, enabled, sort_order, starts_at, ends_at, created_at, updated_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as BreakingNewsRow[];
}

export async function getBreakingNewsByIdForAdmin(id: string): Promise<BreakingNewsRow | null> {
  const admin = getAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("site_breaking_news")
    .select("id, message, link_href, link_label, enabled, sort_order, starts_at, ends_at, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return data as BreakingNewsRow;
}
