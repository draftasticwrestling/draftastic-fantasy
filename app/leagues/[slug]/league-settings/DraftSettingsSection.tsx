"use client";

import Link from "next/link";
import { useState, useActionState, useEffect } from "react";
import { updateDraftSettingsFormAction } from "../actions";

/** Offline and Autopick (stored as draft_type). */
const DRAFT_TYPE_OPTIONS: { value: "offline" | "autopick"; label: string; description: string }[] = [
  {
    value: "offline",
    label: "Offline",
    description:
      "Your league runs its own draft outside the site. When you are ready, the GM adds wrestlers to each roster (roster tools on each team page).",
  },
  {
    value: "autopick",
    label: "Autopick",
    description:
      "Each manager sets auto-draft preferences (everyone defaults to the site Default Big Board until they choose another Big Board or My own list). On draft day, the GM starts the draft from the Draft tab.",
  },
];

const OFFLINE_DRAFT_SHEET_EXPORT_URL =
  "https://docs.google.com/spreadsheets/d/19v4VhgG0kYhHr1HGbAPb29flqIPxeNgY/export?format=xlsx";

type Props = {
  leagueSlug: string;
  /** Stored draft_type: offline | autopick | legacy linear/snake (treated as Autopick in UI). */
  draftType: string | null | undefined;
  draftDate: string | null | undefined;
  draftTime: string | null | undefined;
  isPublicLeague: boolean;
  draftNotStarted: boolean;
};

function toUiDraftType(stored: string | null | undefined): "offline" | "autopick" {
  if (stored === "offline") return "offline";
  if (stored === "autopick") return "autopick";
  return "autopick";
}

function normalizeDateInput(raw: string | null | undefined): string {
  if (!raw) return "";
  return String(raw).slice(0, 10);
}

function normalizeTimeInput(raw: string | null | undefined): string {
  if (!raw) return "";
  const s = String(raw).trim();
  if (/^\d{1,2}:\d{2}/.test(s)) return s.slice(0, 5);
  return "";
}

export function DraftSettingsSection({
  leagueSlug,
  draftType,
  draftDate,
  draftTime,
  isPublicLeague,
  draftNotStarted,
}: Props) {
  const storedUi = toUiDraftType(draftType);
  const initialType: "offline" | "autopick" =
    isPublicLeague && storedUi === "offline" ? "autopick" : storedUi;
  const [selectedType, setSelectedType] = useState<"offline" | "autopick">(initialType);
  const [dateValue, setDateValue] = useState(normalizeDateInput(draftDate));
  const [timeValue, setTimeValue] = useState(normalizeTimeInput(draftTime));

  useEffect(() => {
    const next = toUiDraftType(draftType);
    setSelectedType(isPublicLeague && next === "offline" ? "autopick" : next);
  }, [draftType, isPublicLeague]);

  useEffect(() => {
    setDateValue(normalizeDateInput(draftDate));
    setTimeValue(normalizeTimeInput(draftTime));
  }, [draftDate, draftTime]);

  const [state, formAction] = useActionState(updateDraftSettingsFormAction, null as { error?: string } | null);

  return (
    <section aria-labelledby="draft-settings-heading" style={{ marginBottom: 32 }}>
      <h2 id="draft-settings-heading" style={{ fontSize: "1.25rem", marginBottom: 12 }}>
        Draft
      </h2>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 16, maxWidth: 640 }}>
        {isPublicLeague ? (
          <>
            Public leagues use <strong>Autopick</strong>. Draft timing follows the site schedule.
          </>
        ) : (
          <>
            Choose <strong>Offline</strong> or <strong>Autopick</strong>, then set a <strong>draft date</strong>. Members
            are emailed when you save a date and should set their draft preferences. Before draft day, open the{" "}
            <Link href={`/leagues/${leagueSlug}/draft`} className="app-link">
              Draft
            </Link>{" "}
            tab to <strong>Set draft order</strong>. On draft day, click <strong>Begin Draft</strong> to start.
          </>
        )}
      </p>
      {isPublicLeague ? (
        <p style={{ color: "var(--color-text-muted)", marginBottom: 16, maxWidth: 640, fontSize: 14 }}>
          Public leagues are limited to <strong>Autopick</strong> so managers across different regions/time zones can
          participate fairly.
        </p>
      ) : null}

      <p style={{ color: "var(--color-text-muted)", marginBottom: 20, maxWidth: 640, fontSize: 14 }}>
        <strong>Snake draft order</strong> is used for on-site autopick (order reverses each round). The GM sets the
        order once from the Draft tab so managers can see their slot while building lists. That order cannot be changed
        after it is generated.
      </p>

      <div
        style={{
          marginBottom: 20,
          padding: "14px 16px",
          background: "var(--color-bg-elevated)",
          borderRadius: "var(--radius)",
          border: "1px solid var(--color-border)",
          fontSize: 14,
        }}
      >
        <p style={{ margin: "0 0 8px", fontWeight: 600 }}>Offline draft resources</p>
        <p style={{ margin: 0, color: "var(--color-text-muted)", lineHeight: 1.6 }}>
          <a href={OFFLINE_DRAFT_SHEET_EXPORT_URL} className="app-link">
            Download Offline Draft Tracker (Excel)
          </a>
          {" · "}
          <Link href="/how-it-works/offline-draft" className="app-link">
            Offline Draft How-To
          </Link>
        </p>
      </div>

      <form action={formAction}>
        <input type="hidden" name="league_slug" value={leagueSlug} />
        <input type="hidden" name="draft_type_ui" value={selectedType} readOnly />
        <input type="hidden" name="draft_style" value="snake" readOnly />

        <div style={{ marginBottom: 28 }}>
          <h3 id="draft-type-options-heading" style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 12 }}>
            Draft type
          </h3>
          <ul
            role="radiogroup"
            aria-labelledby="draft-type-options-heading"
            style={{ listStyle: "none", padding: 0, margin: 0 }}
          >
            {DRAFT_TYPE_OPTIONS.map((opt) => {
              const disabled = isPublicLeague && opt.value === "offline";
              return (
                <li key={opt.value} style={{ marginBottom: 16 }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      cursor: disabled ? "not-allowed" : "pointer",
                      opacity: disabled ? 0.65 : 1,
                    }}
                  >
                    <input
                      type="radio"
                      name="draft_type_ui_display"
                      value={opt.value}
                      checked={selectedType === opt.value}
                      onChange={() => setSelectedType(opt.value)}
                      disabled={disabled}
                      style={{ marginTop: 4, flexShrink: 0 }}
                    />
                    <span>
                      <span style={{ fontWeight: 600 }}>{opt.label}</span>
                      {opt.description && (
                        <>
                          : <span style={{ color: "var(--color-text-muted)" }}>{opt.description}</span>
                        </>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>

        {!isPublicLeague && selectedType === "autopick" ? (
          <div style={{ marginBottom: 28, maxWidth: 420 }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 12 }}>Draft date</h3>
            <p style={{ color: "var(--color-text-muted)", fontSize: 14, marginBottom: 12, lineHeight: 1.5 }}>
              Saving a date emails league members (if they have draft reminders on) and prompts them to set preferences.
              {!draftNotStarted ? " The draft has already started, so the date is locked." : null}
            </p>
            <label htmlFor="draft_date" style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
              Date
            </label>
            <input
              id="draft_date"
              name="draft_date"
              type="date"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              disabled={!draftNotStarted}
              style={{
                display: "block",
                width: "100%",
                maxWidth: 240,
                padding: "8px 10px",
                marginBottom: 12,
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
              }}
            />
            <label htmlFor="draft_time" style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
              Optional meeting time
            </label>
            <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginBottom: 8, lineHeight: 1.5 }}>
              Display only for your group. The draft does not start automatically — the GM clicks{" "}
              <strong>Begin Draft</strong> on or after draft day.
            </p>
            <input
              id="draft_time"
              name="draft_time"
              type="time"
              value={timeValue}
              onChange={(e) => setTimeValue(e.target.value)}
              disabled={!draftNotStarted}
              style={{
                display: "block",
                width: "100%",
                maxWidth: 240,
                padding: "8px 10px",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
              }}
            />
          </div>
        ) : null}

        {state?.error && <p style={{ color: "var(--color-red)", marginBottom: 12 }}>{state.error}</p>}
        {state && !state.error && (
          <p style={{ color: "var(--color-success)", marginBottom: 12 }}>Draft settings saved.</p>
        )}
        <button type="submit" className="app-btn-primary">
          Save draft settings
        </button>
      </form>
    </section>
  );
}
