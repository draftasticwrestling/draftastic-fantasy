import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getEventShowType, type EventShowFilter } from "@/lib/boxscore/eventShowHeader";
import { siteAdminGetEventByParam } from "@/lib/internalAdmin/siteAdminEvents";

/**
 * Use `select('*')` so missing optional columns (e.g. `specialWinner`, `isLive` not yet migrated)
 * do not make the whole query fail — a narrow column list caused 404s on /boxscore/events/.../edit.
 */
export type BoxscoreEventEditorRow = Record<string, unknown> & {
  id: string;
  name?: string | null;
  date?: string | null;
  location?: string | null;
  preview?: string | null;
  recap?: string | null;
  matches?: unknown[] | null;
  status?: string | null;
  isLive?: boolean | null;
  broadcast_start_ts?: string | null;
  broadcast_start_ts_source?: string | null;
  event_type?: string | null;
  specialWinner?: unknown | null;
};

/**
 * PWBS-style id: `{showSlug}-{YYYYMMDD}-{timestamp}` e.g. `smackdown-20260403-1774190445299`.
 * When canonical slug `smackdown-2026-04-03` is used in public URLs, users may still paste the DB id.
 * If direct `eq('id')` fails (unlikely after select *), resolve by date + show and exact id or single candidate.
 */
async function tryLoadByPwbsCompositeId(
  admin: SupabaseClient,
  decoded: string
): Promise<BoxscoreEventEditorRow | null> {
  const m = decoded.match(/^(raw|smackdown|ple)-(\d{4})(\d{2})(\d{2})-(\d+)$/i);
  if (!m) return null;
  const show = m[1].toLowerCase() as EventShowFilter;
  const date = `${m[2]}-${m[3]}-${m[4]}`;

  const { data: rows, error } = await admin.from("events").select("*").eq("date", date);
  if (error || !rows?.length) return null;

  const candidates = rows.filter((e) => getEventShowType(e as { name?: string | null }) === show);
  const exact = candidates.find((e) => String((e as { id?: string }).id) === decoded);
  if (exact) return exact as unknown as BoxscoreEventEditorRow;
  if (candidates.length === 1) return candidates[0] as unknown as BoxscoreEventEditorRow;
  return null;
}

export async function loadBoxscoreEventForEditor(
  admin: SupabaseClient,
  param: string
): Promise<BoxscoreEventEditorRow | null> {
  const decoded = decodeURIComponent(param.trim());

  const { data: byId } = await admin.from("events").select("*").eq("id", decoded).maybeSingle();
  if (byId) return byId as unknown as BoxscoreEventEditorRow;

  const resolved = await siteAdminGetEventByParam(admin, decoded);
  if (resolved?.id) {
    const { data: full } = await admin.from("events").select("*").eq("id", resolved.id).maybeSingle();
    return (full as unknown as BoxscoreEventEditorRow) ?? null;
  }

  return tryLoadByPwbsCompositeId(admin, decoded);
}
