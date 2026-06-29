import { fromZonedTime } from "date-fns-tz";

const ET_ZONE = "America/New_York";

function inferDefaultStartHourEt(name: string | null | undefined): number {
  const n = (name || "").toLowerCase();
  if (n.includes("raw") || n.includes("smackdown")) return 20;
  return 19;
}

export type EventBroadcastStartInput = {
  name?: string | null;
  date?: string | null;
  broadcast_start_ts?: string | null;
};

/**
 * Broadcast start as UTC ms: explicit `broadcast_start_ts` when set, else default ET start
 * (Raw / SmackDown 8:00 PM ET ≈ 5:00 PM PT; other shows 7:00 PM ET).
 */
export function getEventBroadcastStartMs(e: EventBroadcastStartInput): number | null {
  const raw = e.broadcast_start_ts;
  if (typeof raw === "string" && raw.trim()) {
    const ms = Date.parse(raw);
    if (Number.isFinite(ms)) return ms;
  }
  const date = String(e.date ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const hour = inferDefaultStartHourEt(e.name);
  return fromZonedTime(`${date}T${String(hour).padStart(2, "0")}:00:00`, ET_ZONE).getTime();
}
