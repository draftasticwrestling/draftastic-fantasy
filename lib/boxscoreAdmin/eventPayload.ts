/** Aligns with PWBS `addEvent` / `updateEvent` allowlists in `App.jsx`. */

const ALLOWED_TOP_LEVEL = [
  "id",
  "name",
  "date",
  "location",
  "event_type",
  "broadcast_start_ts",
  "broadcast_start_ts_source",
  "preview",
  "recap",
  "matches",
  "status",
] as const;

export type SanitizedBoxscoreEventRow = Record<string, unknown>;

/** Same id pattern as PWBS AddEvent `handleSaveEvent`. */
export function buildBoxscoreEventId(name: string, date: string): string {
  const slug = name.toLowerCase().replace(/\s+/g, "-");
  const dateDigits = date.replace(/[^0-9]/g, "");
  return `${slug}-${dateDigits}-${Date.now()}`;
}

export function sanitizeBoxscoreEventForSupabase(event: Record<string, unknown>): SanitizedBoxscoreEventRow {
  const out: Record<string, unknown> = {};
  for (const key of ALLOWED_TOP_LEVEL) {
    if (event[key] !== undefined) out[key] = event[key];
  }
  if (event.event_type !== undefined) {
    const et = typeof event.event_type === "string" ? event.event_type.trim() : "";
    out.event_type = et || null;
  }
  return out;
}

export function normalizeEventDateInput(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
