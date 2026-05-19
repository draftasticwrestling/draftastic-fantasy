"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useState } from "react";
import type { BoxscoreTagTeamDataMap, BoxscoreWrestlerRow } from "@/lib/boxscoreAdmin/boxscoreEditorData";
import {
  LOCATION_HELPER,
  LOCATION_PLACEHOLDER,
  type MergedBoxscoreUiOptions,
} from "@/lib/boxscoreAdmin/boxscoreUiOptionsCore";
import { insertBoxscoreEventAction, type InsertBoxscoreEventState } from "../actions";
import { BoxscoreEventCardPanel } from "./BoxscoreEventCardPanel";

const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "var(--color-text-muted)" } as const;
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
const helperStyle = { fontSize: 12, color: "var(--color-text-muted)", margin: "8px 0 0", maxWidth: 560, lineHeight: 1.45 } as const;

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

async function submitWithBroadcast(
  prev: InsertBoxscoreEventState,
  formData: FormData
): Promise<InsertBoxscoreEventState> {
  const date = formData.get("date")?.toString().trim() ?? "";
  const time = formData.get("broadcast_time")?.toString().trim() ?? "";
  if (date && time) {
    const d = new Date(`${date}T${time}:00`);
    if (!Number.isNaN(d.getTime())) {
      formData.set("broadcast_start_ts", d.toISOString());
    }
  }
  formData.delete("broadcast_time");
  return insertBoxscoreEventAction(prev, formData);
}

export function AddBoxscoreEventForm({
  wrestlers,
  initialTagTeamData,
  mergedOptions,
}: {
  wrestlers: BoxscoreWrestlerRow[];
  initialTagTeamData: BoxscoreTagTeamDataMap;
  mergedOptions: MergedBoxscoreUiOptions;
}) {
  const [state, formAction] = useActionState(submitWithBroadcast, null);
  const [status, setStatus] = useState("upcoming");
  const [eventType, setEventType] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [broadcastTime, setBroadcastTime] = useState("");
  const [matches, setMatches] = useState<Record<string, unknown>[]>([]);

  return (
    <form action={formAction} style={{ maxWidth: 720 }}>
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="name" value={eventType} readOnly />
      <input type="hidden" name="matches_json" value={JSON.stringify(matches)} readOnly onChange={() => {}} />

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

      <EventStatusButtons status={status} onChange={setStatus} />
      {status === "live" ? (
        <button
          type="submit"
          style={{
            marginBottom: 24,
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

      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle} htmlFor="event_type">
          Event type
        </label>
        <select
          id="event_type"
          name="event_type"
          required
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          style={{ ...fieldStyle, maxWidth: 420 }}
        >
          <option value="">Select an event type</option>
          {mergedOptions.eventTypeLabels.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <p style={helperStyle}>
          RAW, SmackDown, NXT weekly, and NXT premium events (Stand and Deliver, Deadline, etc.). Add labels in{" "}
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
        <input id="location" name="location" required style={fieldStyle} placeholder={LOCATION_PLACEHOLDER} />
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
        stipulationOptions={mergedOptions.stipulationOptions}
        specialWinnerOptions={mergedOptions.specialWinnerOptions}
      />

      <details style={{ marginBottom: 18 }}>
        <summary style={{ cursor: "pointer", fontSize: 14, color: "var(--color-text-muted)", marginBottom: 8 }}>
          Advanced: custom id, special winner, raw JSON
        </summary>
        <div style={{ display: "grid", gap: 14, marginTop: 10 }}>
          <div>
            <label style={labelStyle} htmlFor="custom_id">
              Custom id (optional)
            </label>
            <input
              id="custom_id"
              name="custom_id"
              style={{ ...fieldStyle, fontFamily: "ui-monospace, monospace", fontSize: 13 }}
              placeholder="Leave blank to auto-generate like PWBS"
            />
          </div>
          <fieldset style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: 16, margin: 0 }}>
            <legend style={{ fontSize: 14, fontWeight: 600, padding: "0 8px" }}>Special winner (optional)</legend>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle} htmlFor="special_winner_type">
                Type
              </label>
              <select id="special_winner_type" name="special_winner_type" style={fieldStyle}>
                {mergedOptions.specialWinnerOptions.map((t) => (
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
              <input id="special_winner_name" name="special_winner_name" style={fieldStyle} placeholder="Wrestler or team name" />
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
