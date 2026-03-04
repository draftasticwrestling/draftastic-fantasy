"use client";

import { useFormState } from "react-dom";
import { updateDraftSettingsFormAction } from "../actions";
import type { DraftOrderMethod, DraftType } from "@/lib/leagues";

const DRAFT_TYPES: { value: DraftType; label: string; description: string }[] = [
  {
    value: "offline",
    label: "Offline",
    description:
      "Your league conducts its own offline draft. You submit the results manually.",
  },
  {
    value: "linear",
    label: "Linear",
    description:
      "Each round uses the same pick order. The team that picks first in round one picks first in every round.",
  },
  {
    value: "snake",
    label: "Snake",
    description:
      "Your league will participate in a live online draft. Based on a predetermined draft order, each team takes a turn selecting a player in a set amount of time. This type of draft is sometimes called a Snake Draft, as the draft order reverses each round.",
  },
  {
    value: "autopick",
    label: "Autopick",
    description:
      "Your league's rosters are automatically drafted based on each team's pre-draft rankings list. Each team owner will receive an email upon the draft's completion.",
  },
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
  draftType: DraftType | null | undefined;
  timePerPickSeconds: number | null | undefined;
  draftOrderMethod: DraftOrderMethod | null | undefined;
  draftDate: string | null | undefined;
};

export function DraftSettingsSection({
  leagueSlug,
  draftType,
  timePerPickSeconds,
  draftOrderMethod,
  draftDate,
}: Props) {
  const effectiveDraftType = draftType ?? "snake";
  const effectiveTime = timePerPickSeconds ?? 120;
  const effectiveOrder = draftOrderMethod ?? "random_one_hour_before";

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
            {DRAFT_TYPES.map((opt) => (
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
                    name="draft_type"
                    value={opt.value}
                    defaultChecked={effectiveDraftType === opt.value}
                    style={{ marginTop: 4, flexShrink: 0 }}
                  />
                  <span>
                    <span style={{ fontWeight: 600 }}>{opt.label}:</span>{" "}
                    <span style={{ color: "var(--color-text-muted)" }}>{opt.description}</span>
                  </span>
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
