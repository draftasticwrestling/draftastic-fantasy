"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { BoxscoreEventEditorRow } from "@/lib/boxscoreAdmin/boxscoreEventEditorLoad";
import type { BoxscoreTagTeamDataMap, BoxscoreWrestlerRow } from "@/lib/boxscoreAdmin/boxscoreEditorData";
import {
  ensureOptionInList,
  LOCATION_HELPER,
  LOCATION_PLACEHOLDER,
  type MergedBoxscoreUiOptions,
} from "@/lib/boxscoreAdmin/boxscoreUiOptionsCore";
import { updateBoxscoreEventAction, type UpdateBoxscoreEventState } from "../../actions";
import { BoxscoreEventCardPanel } from "../../new/BoxscoreEventCardPanel";
import { eventResultsHref } from "@/lib/event-results/eventResultsRoute";

const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "var(--color-text-muted)" } as const;
const helperStyle = { fontSize: 12, color: "var(--color-text-muted)", margin: "8px 0 0", maxWidth: 560, lineHeight: 1.45 } as const;
const fieldStyle = {
  width: "100%",
  maxWidth: 520,
  padding: "10px 12px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--color-border)",
  background: "var(--color-bg-surface)",
  color: "var(--color-text)",
  fontSize: 15,
} as const;

function isoToDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${mo}-${day}T${h}:${min}`;
}

function isoToTimeValue(iso: string | null | undefined): string {
  const local = isoToDatetimeLocalValue(iso);
  if (!local || !local.includes("T")) return "";
  return local.split("T")[1] ?? "";
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        marginTop: 8,
        padding: "12px 22px",
        fontWeight: 700,
        borderRadius: "var(--radius-sm)",
        border: "none",
        cursor: pending ? "wait" : "pointer",
        background: "var(--color-blue)",
        color: "#fff",
        opacity: pending ? 0.75 : 1,
      }}
    >
      {pending ? "Saving…" : "Save Event"}
    </button>
  );
}

function EventStatusButtons({ status, onChange }: { status: string; onChange: (next: "upcoming" | "completed" | "live") => void }) {
  const buttonStyle = (isActive: boolean, isLive = false) =>
    ({
      padding: "8px 16px",
      background: isActive ? (isLive ? "#16a34a" : "#3b82f6") : "#232323",
      color: isActive ? "#fff" : "#bbb",
      border: `1px solid ${isLive ? "#16a34a" : "#888"}`,
      borderRadius: 4,
      cursor: "pointer",
      fontWeight: isActive ? 700 : 500,
    }) as const;

  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
      <button type="button" onClick={() => onChange("upcoming")} style={buttonStyle(status === "upcoming")}>
        Upcoming Event
      </button>
      <button type="button" onClick={() => onChange("completed")} style={buttonStyle(status === "completed")}>
        Completed Event
      </button>
      <button type="button" onClick={() => onChange("live")} style={buttonStyle(status === "live", true)}>
        Live Event
      </button>
    </div>
  );
}

async function submitUpdateWithBroadcast(
  prev: UpdateBoxscoreEventState,
  formData: FormData
): Promise<UpdateBoxscoreEventState> {
  const date = formData.get("date")?.toString().trim() ?? "";
  const time = formData.get("broadcast_time")?.toString().trim() ?? "";
  if (date && time) {
    const d = new Date(`${date}T${time}:00`);
    if (!Number.isNaN(d.getTime())) {
      formData.set("broadcast_start_ts", d.toISOString());
    }
  }
  formData.delete("broadcast_time");
  return updateBoxscoreEventAction(prev, formData);
}

function initialStatus(event: BoxscoreEventEditorRow): string {
  const s = (event.status ?? "upcoming").toString().trim().toLowerCase();
  if (s === "live" || event.isLive) return "live";
  if (s === "completed") return "completed";
  return "upcoming";
}

function initialEventTypeLabel(event: BoxscoreEventEditorRow, labels: string[]): string {
  const fromType = typeof event.event_type === "string" ? event.event_type.trim() : "";
  const fromName = (event.name ?? "").trim();
  const raw = fromType || fromName;
  if (!raw) return "";
  const match = labels.find((o) => o.toLowerCase() === raw.toLowerCase());
  return match ?? raw;
}

export function EditBoxscoreEventForm({
  event,
  wrestlers,
  initialTagTeamData,
  mergedOptions,
}: {
  event: BoxscoreEventEditorRow;
  wrestlers: BoxscoreWrestlerRow[];
  initialTagTeamData: BoxscoreTagTeamDataMap;
  mergedOptions: MergedBoxscoreUiOptions;
}) {
  const [state, formAction] = useActionState(submitUpdateWithBroadcast, null);
  const [status, setStatus] = useState(() => initialStatus(event));
  const [eventType, setEventType] = useState("");
  const [broadcastTime, setBroadcastTime] = useState(() => isoToTimeValue(event.broadcast_start_ts));
  const [eventDate, setEventDate] = useState(() => {
    const d = event.date?.trim() ?? "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    return "";
  });

  const [matches, setMatches] = useState<Record<string, unknown>[]>(() => {
    const m = event.matches;
    if (!Array.isArray(m)) return [];
    return m.map((row) => (row && typeof row === "object" ? { ...(row as Record<string, unknown>) } : {}));
  });

  const specialInit = useMemo(() => {
    const sw = event.specialWinner as { type?: string; name?: string } | null | undefined;
    if (!sw || typeof sw !== "object") return { type: "None", name: "" };
    return {
      type: typeof sw.type === "string" && sw.type ? sw.type : "None",
      name: typeof sw.name === "string" ? sw.name : "",
    };
  }, [event.specialWinner]);

  const eventTypeOptions = useMemo(
    () =>
      ensureOptionInList(
        mergedOptions.eventTypeLabels,
        typeof event.event_type === "string" ? event.event_type : (event.name ?? "")
      ),
    [mergedOptions.eventTypeLabels, event.event_type, event.name]
  );

  useEffect(() => {
    setEventType(initialEventTypeLabel(event, eventTypeOptions));
  }, [event.id, event.event_type, event.name, eventTypeOptions]);

  const specialWinnerSelectOptions = useMemo(
    () => ensureOptionInList(mergedOptions.specialWinnerOptions, specialInit.type),
    [mergedOptions.specialWinnerOptions, specialInit.type]
  );

  const publicHref = eventResultsHref({
    id: event.id,
    name: event.name,
    date: event.date,
  });

  return (
    <form action={formAction} style={{ maxWidth: 720 }}>
      <input type="hidden" name="event_id" value={event.id} readOnly />
      <input type="hidden" name="name" value={eventType} readOnly />

      {state?.error ? (
        <p
          role="alert"
          style={{
            padding: 12,
            marginBottom: 20,
            borderRadius: "var(--radius-sm)",
            background: "var(--color-red-bg, #fde8e8)",
            color: "var(--color-red)",
            fontSize: 14,
          }}
        >
          {state.error}
        </p>
      ) : null}

      <p style={{ fontSize: 14, marginBottom: 18, color: "var(--color-text-muted)" }}>
        <Link href={publicHref} className="app-link" target="_blank" rel="noopener noreferrer">
          View public page
        </Link>
        {" · "}
        <Link href={`/internal-admin/events/${encodeURIComponent(event.id)}`} className="app-link">
          Raw JSON
        </Link>
      </p>

      <p style={{ fontFamily: "monospace", fontSize: 13, color: "var(--color-text-muted)", marginBottom: 20 }}>
        id <strong style={{ color: "var(--color-text)" }}>{event.id}</strong>
      </p>

      <EventStatusButtons status={status} onChange={setStatus} />
      {status === "live" ? (
        <button
          type="submit"
          style={{
            marginBottom: 16,
            background: "#16a34a",
            color: "#fff",
            padding: "10px 24px",
            border: "none",
            borderRadius: 4,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Save Event Details
        </button>
      ) : null}

      <input type="hidden" name="status" value={status} readOnly />

      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle} htmlFor="event_type">
          Event type
        </label>
        <select
          id="event_type"
          name="event_type"
          required
          style={{ ...fieldStyle, maxWidth: 420 }}
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
        >
          <option value="">Select an event type</option>
          {eventTypeOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <p style={helperStyle}>
          RAW, SmackDown, NXT weekly, and NXT premium events. Manage options in{" "}
          <Link href="/internal-admin/boxscore/options" className="app-link">
            Boxscore dropdown options
          </Link>
          .
        </p>
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle} htmlFor="date">
          Date
        </label>
        <input
          id="date"
          name="date"
          type="date"
          required
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          style={{ ...fieldStyle, maxWidth: 220 }}
        />
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle} htmlFor="location">
          Location
        </label>
        <input
          id="location"
          name="location"
          required
          style={fieldStyle}
          defaultValue={event.location ?? ""}
          placeholder={LOCATION_PLACEHOLDER}
        />
        <p style={helperStyle}>{LOCATION_HELPER}</p>
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle} htmlFor="broadcast_time">
          Event time
        </label>
        <input
          id="broadcast_time"
          name="broadcast_time"
          type="time"
          value={broadcastTime}
          onChange={(e) => setBroadcastTime(e.target.value)}
          style={{ ...fieldStyle, maxWidth: 220 }}
        />
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle} htmlFor="preview">
          Event preview (optional)
        </label>
        <textarea
          id="preview"
          name="preview"
          rows={4}
          style={{ ...fieldStyle, maxWidth: "100%" }}
          defaultValue={event.preview ?? ""}
          placeholder="Briefly tease the matches, storylines, and why fans won't want to miss this event."
        />
        <p style={helperStyle}>Shown on event and match pages for upcoming shows.</p>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle} htmlFor="recap">
          Event recap (optional, after event finishes)
        </label>
        <textarea
          id="recap"
          name="recap"
          rows={5}
          style={{ ...fieldStyle, maxWidth: "100%" }}
          defaultValue={event.recap ?? ""}
          placeholder="Once the event is over, add a short recap highlighting what happened and why it mattered."
        />
        <p style={helperStyle}>Shown on completed event and match pages.</p>
      </div>

      <BoxscoreEventCardPanel
        wrestlers={wrestlers}
        initialTagTeamData={initialTagTeamData}
        eventStatus={status}
        eventDate={eventDate}
        matches={matches}
        setMatches={setMatches}
        eventId={event.id}
        stipulationOptions={mergedOptions.stipulationOptions}
        specialWinnerOptions={mergedOptions.specialWinnerOptions}
      />

      <input
        type="hidden"
        name="matches_json"
        value={JSON.stringify(matches)}
        readOnly
        onChange={() => {}}
      />

      <details style={{ marginBottom: 18 }}>
        <summary style={{ cursor: "pointer", fontSize: 14, color: "var(--color-text-muted)", marginBottom: 8 }}>
          Advanced: special winner, raw JSON
        </summary>
        <p style={{ ...helperStyle, marginTop: 8 }}>
          Special winner is not saved until the <code>specialWinner</code> column exists on{" "}
          <code>events</code> (run <code>supabase/events_special_winner.sql</code> in Supabase).
        </p>
        <div style={{ display: "grid", gap: 14, marginTop: 10 }}>
      <fieldset style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: 16, marginBottom: 18 }}>
        <legend style={{ fontSize: 14, fontWeight: 600, padding: "0 8px" }}>Special winner (optional)</legend>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle} htmlFor="special_winner_type">
            Type
          </label>
          <select id="special_winner_type" name="special_winner_type" style={fieldStyle} defaultValue={specialInit.type}>
            {specialWinnerSelectOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle} htmlFor="special_winner_name">
            Name
          </label>
          <input
            id="special_winner_name"
            name="special_winner_name"
            style={fieldStyle}
            placeholder="Wrestler or team name"
            defaultValue={specialInit.name}
          />
        </div>
      </fieldset>
          <textarea
            readOnly
            rows={6}
            value={JSON.stringify(matches, null, 2)}
            style={{
              ...fieldStyle,
              maxWidth: "100%",
              fontFamily: "ui-monospace, monospace",
              fontSize: 12,
              lineHeight: 1.45,
            }}
            spellCheck={false}
            aria-label="Raw matches JSON"
          />
        </div>
      </details>

      <SubmitButton />
    </form>
  );
}
