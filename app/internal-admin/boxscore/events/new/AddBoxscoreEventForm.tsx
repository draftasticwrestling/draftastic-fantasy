"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { useState } from "react";
import type { BoxscoreTagTeamDataMap, BoxscoreWrestlerRow } from "@/lib/boxscoreAdmin/boxscoreEditorData";
import type { MergedBoxscoreUiOptions } from "@/lib/boxscoreAdmin/boxscoreUiOptionsCore";
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
      {pending ? "Saving…" : "Create event"}
    </button>
  );
}

async function submitWithBroadcast(
  prev: InsertBoxscoreEventState,
  formData: FormData
): Promise<InsertBoxscoreEventState> {
  const local = formData.get("broadcast_local")?.toString().trim() ?? "";
  if (local) {
    const d = new Date(local);
    if (!Number.isNaN(d.getTime())) {
      formData.set("broadcast_start_ts", d.toISOString());
    }
  }
  formData.delete("broadcast_local");
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
  const [state, formAction] = useFormState(submitWithBroadcast, null);
  const [status, setStatus] = useState("upcoming");
  const [eventDate, setEventDate] = useState("");
  const [matches, setMatches] = useState<Record<string, unknown>[]>([]);

  return (
    <form action={formAction} style={{ maxWidth: 720 }}>
      <input type="hidden" name="status" value={status} />
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

      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle} htmlFor="name">
          Event name
        </label>
        <input id="name" name="name" required style={fieldStyle} placeholder="e.g. RAW, SmackDown, WrestleMania night 1" />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 18 }}>
        <div>
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
            style={{ ...fieldStyle, maxWidth: 200 }}
          />
        </div>
        <div style={{ flex: "1 1 240px" }}>
          <label style={labelStyle} htmlFor="location">
            Location
          </label>
          <input id="location" name="location" required style={fieldStyle} placeholder="Arena / city" />
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle} htmlFor="event_type">
          Event type (optional)
        </label>
        <select id="event_type" name="event_type" style={{ ...fieldStyle, maxWidth: 420 }}>
          <option value="">— Not set —</option>
          {mergedOptions.eventTypeLabels.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "8px 0 0", maxWidth: 560 }}>
          Catalog label for this show (RAW, SmackDown, PLE, etc.). Fantasy scoring still uses{" "}
          <code style={{ fontSize: 11 }}>classifyEventType</code> from the event name. Add new labels in{" "}
          <Link href="/internal-admin/boxscore/options" className="app-link">
            Boxscore dropdown options
          </Link>
          .
        </p>
      </div>

      <fieldset style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: 16, marginBottom: 18 }}>
        <legend style={{ fontSize: 14, fontWeight: 600, padding: "0 8px" }}>Status</legend>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
            <input type="radio" checked={status === "upcoming"} onChange={() => setStatus("upcoming")} />
            Upcoming (empty card allowed)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
            <input type="radio" checked={status === "completed"} onChange={() => setStatus("completed")} />
            Completed
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
            <input type="radio" checked={status === "live"} onChange={() => setStatus("live")} />
            Live
          </label>
        </div>
      </fieldset>

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
          Raw matches JSON (read-only)
        </summary>
        <textarea
          readOnly
          rows={8}
          value={JSON.stringify(matches, null, 2)}
          style={{
            ...fieldStyle,
            maxWidth: "100%",
            fontFamily: "ui-monospace, monospace",
            fontSize: 12,
            lineHeight: 1.45,
          }}
          spellCheck={false}
        />
      </details>

      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle} htmlFor="broadcast_local">
          Broadcast start (optional, your local timezone)
        </label>
        <input id="broadcast_local" name="broadcast_local" type="datetime-local" style={{ ...fieldStyle, maxWidth: 280 }} />
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle} htmlFor="preview">
          Preview
        </label>
        <textarea id="preview" name="preview" rows={3} style={{ ...fieldStyle, maxWidth: "100%" }} />
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle} htmlFor="recap">
          Recap
        </label>
        <textarea id="recap" name="recap" rows={3} style={{ ...fieldStyle, maxWidth: "100%" }} />
      </div>

      <div style={{ marginBottom: 18 }}>
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

      <fieldset style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: 16, marginBottom: 18 }}>
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

      <SubmitButton />
    </form>
  );
}
