"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { updateDraftSettingsFormAction } from "../actions";
import type { DraftOrderMethod } from "@/lib/leagues";

/** Draft Type: how the draft runs. Stored as draft_type (offline | live→linear/snake | autopick). */
const DRAFT_TYPE_OPTIONS: { value: "offline" | "live" | "autopick"; label: string; description: string }[] = [
  { value: "offline", label: "Offline", description: "Your league conducts its own offline draft. You submit the results manually." },
  { value: "live", label: "Live", description: "Schedule a day and time and host your draft live on the site." },
  { value: "autopick", label: "Autopick", description: "Your league's rosters are automatically drafted based on each team's pre-draft rankings list. Each team owner will receive an email upon the draft's completion." },
];

/** Draft Style: only when type is Live. Stored as draft_type (linear/snake) + draft_style. */
const DRAFT_STYLE_OPTIONS: { value: "linear" | "snake"; label: string }[] = [
  { value: "linear", label: "Linear" },
  { value: "snake", label: "Snake" },
];

const TIME_PER_PICK_OPTIONS: { value: number; label: string }[] = [
  { value: 30, label: "30 seconds" },
  { value: 60, label: "1 minute" },
  { value: 90, label: "90 seconds" },
  { value: 120, label: "2 minutes" },
  { value: 150, label: "2 mins 30 seconds" },
  { value: 180, label: "3 minutes" },
];

const DRAFT_ORDER_OPTIONS: { value: DraftOrderMethod; label: string }[] = [
  { value: "random_one_hour_before", label: "Randomized one hour before draft time" },
  { value: "manual_by_gm", label: "Manually set by General Manager" },
];

type Props = {
  leagueSlug: string;
  /** Stored draft_type: offline | linear | snake | autopick */
  draftType: string | null | undefined;
  /** Stored draft_style: linear | snake (used when type is live) */
  draftStyle: "linear" | "snake" | null | undefined;
  timePerPickSeconds: number | null | undefined;
  draftOrderMethod: DraftOrderMethod | null | undefined;
  draftDate: string | null | undefined;
};

/** Map stored draft_type to UI type (offline | live | autopick). */
function toUiType(stored: string | null | undefined): "offline" | "live" | "autopick" {
  if (stored === "offline" || stored === "autopick") return stored;
  return "live"; // linear or snake → live
}

export function DraftSettingsSection({
  leagueSlug,
  draftType,
  draftStyle,
  timePerPickSeconds,
  draftOrderMethod,
  draftDate,
}: Props) {
  const uiType = toUiType(draftType);
  const effectiveStyle = draftStyle ?? (draftType === "linear" ? "linear" : "snake");
  const effectiveTime = timePerPickSeconds ?? 120;
  const effectiveOrder = draftOrderMethod ?? "random_one_hour_before";
  const draftTimeDefault =
    draftDate && draftDate.length > 10
      ? draftDate.slice(11, 16)
      : "";

  const [state, formAction] = useFormState(updateDraftSettingsFormAction, null as { error?: string } | null);

  return (
    <section aria-labelledby="draft-settings-heading" style={{ marginBottom: 32 }}>
      <h2 id="draft-settings-heading" style={{ fontSize: "1.25rem", marginBottom: 12 }}>
        Draft
      </h2>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 24, maxWidth: 560 }}>
        Draft settings can be changed until one hour before the scheduled start time.
        In order for your draft to take place, all team managers must be joined by the scheduled start time.
      </p>

      <form action={formAction}>
        <input type="hidden" name="league_slug" value={leagueSlug} />

        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 12 }}>Draft Type</h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {DRAFT_TYPE_OPTIONS.map((opt) => (
              <li key={opt.value} style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="draft_type_ui"
                    value={opt.value}
                    defaultChecked={uiType === opt.value}
                    style={{ marginTop: 4, flexShrink: 0 }}
                  />
                  <span>
                    <span style={{ fontWeight: 600 }}>{opt.label}</span>
                    {opt.description && (
                      <>: <span style={{ color: "var(--color-text-muted)" }}>{opt.description}</span></>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 12 }}>Draft Style</h3>
          <p style={{ color: "var(--color-text-muted)", fontSize: 14, marginBottom: 12 }}>
            Applies when draft type is Live. Linear: same pick order every round. Snake: order reverses each round.
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {DRAFT_STYLE_OPTIONS.map((opt) => (
              <li key={opt.value}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="draft_style"
                    value={opt.value}
                    defaultChecked={effectiveStyle === opt.value}
                    style={{ width: 18, height: 18 }}
                  />
                  <span style={{ fontWeight: 500 }}>{opt.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 12 }}>Draft Settings</h3>
          <p style={{ color: "var(--color-text-muted)", fontSize: 14, marginBottom: 16 }}>
            Reminder: You must fill your league prior to your draft. Your league will not draft if it is not full one hour before the scheduled draft time.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
            <div>
              <label htmlFor="draft_date" style={{ display: "block", fontWeight: 500, marginBottom: 6 }}>
                Draft Date
              </label>
              <input
                id="draft_date"
                type="date"
                name="draft_date"
                defaultValue={draftDate ?? ""}
                className="app-input"
                style={{ minWidth: 160 }}
              />
            </div>
            <div>
              <label htmlFor="draft_time" style={{ display: "block", fontWeight: 500, marginBottom: 6 }}>
                Draft Time
              </label>
              <input
                id="draft_time"
                type="time"
                name="draft_time"
                defaultValue={draftTimeDefault}
                className="app-input"
                style={{ minWidth: 140 }}
              />
            </div>
            <div>
              <label htmlFor="time_per_pick_seconds" style={{ display: "block", fontWeight: 500, marginBottom: 6 }}>
                Time Per Pick
              </label>
              <select
                id="time_per_pick_seconds"
                name="time_per_pick_seconds"
                className="app-input"
                defaultValue={String(effectiveTime)}
                style={{ minWidth: 180 }}
              >
                {TIME_PER_PICK_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="draft_order_method" style={{ display: "block", fontWeight: 500, marginBottom: 6 }}>
                Draft Order
              </label>
              <select
                id="draft_order_method"
                name="draft_order_method"
                className="app-input"
                defaultValue={effectiveOrder}
                style={{ minWidth: 260 }}
              >
                {DRAFT_ORDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {effectiveOrder === "manual_by_gm" && (
                <p style={{ marginTop: 8, fontSize: 14, color: "var(--color-text-muted)" }}>
                  After saving, use <Link href={`/leagues/${leagueSlug}/draft/set-order`} className="app-link">Set draft order</Link> on the Draft page to choose the pick order.
                </p>
              )}
            </div>
          </div>
        </div>

        {state?.error && (
          <p style={{ color: "var(--color-red)", marginBottom: 12 }}>{state.error}</p>
        )}
        <button type="submit" className="app-btn-primary">
          Save Draft Settings
        </button>
      </form>
    </section>
  );
}
