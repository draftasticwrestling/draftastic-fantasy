"use client";

import Link from "next/link";
import { useState, useActionState, useEffect } from "react";
import { updateDraftSettingsFormAction } from "../actions";
import { PROFILE_TIMEZONE_OPTIONS } from "@/lib/profileTimezone";

/** Offline, Autopick, and Live (stored as draft_type). Live is private leagues only. */
const DRAFT_TYPE_OPTIONS: { value: "offline" | "autopick" | "live"; label: string; description: string }[] = [
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
      "Each manager sets auto-draft preferences (everyone defaults to the site All-time Big Board until they choose another Big Board or My own list). On draft day, the GM starts the draft from the Draft tab.",
  },
  {
    value: "live",
    label: "Live",
    description:
      "Private leagues only. Managers meet in the draft lobby, mark ready, and the GM starts the draft. Everyone picks in turn on draft day.",
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
  /** Saved IANA timezone, or the GM profile timezone when none is stored yet. */
  draftTimezone: string;
  /** True when this league already has a timezone saved with the draft time. */
  timezoneSaved: boolean;
  isPublicLeague: boolean;
  draftNotStarted: boolean;
};

function toUiDraftType(stored: string | null | undefined): "offline" | "autopick" | "live" {
  if (stored === "offline") return "offline";
  if (stored === "live") return "live";
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
  draftTimezone,
  timezoneSaved,
  isPublicLeague,
  draftNotStarted,
}: Props) {
  const storedUi = toUiDraftType(draftType);
  const initialType: "offline" | "autopick" | "live" =
    isPublicLeague && storedUi !== "autopick" ? "autopick" : storedUi;
  const [selectedType, setSelectedType] = useState<"offline" | "autopick" | "live">(initialType);
  const [dateValue, setDateValue] = useState(normalizeDateInput(draftDate));
  const [timeValue, setTimeValue] = useState(normalizeTimeInput(draftTime));
  const [timezoneValue, setTimezoneValue] = useState(draftTimezone);

  useEffect(() => {
    const next = toUiDraftType(draftType);
    setSelectedType(isPublicLeague && next !== "autopick" ? "autopick" : next);
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
            Choose <strong>Offline</strong>, <strong>Autopick</strong>, or <strong>Live</strong>, then set a{" "}
            <strong>draft date</strong>. Members are emailed when you save a date and should set their draft
            preferences. Before draft day, open the{" "}
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
              const disabled = isPublicLeague && opt.value !== "autopick";
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

        {!isPublicLeague && (selectedType === "autopick" || selectedType === "live") ? (
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
              Time
            </label>
            <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginBottom: 8, lineHeight: 1.5 }}>
              The GM clicks <strong>Begin Draft</strong> on or after this date
              {selectedType === "live" ? " from the live draft lobby" : ""}. Everyone sees this time in the timezone
              you choose. A manager whose account timezone is different also sees their own local time.
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
                marginBottom: 12,
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
              }}
            />
            <label htmlFor="draft_timezone" style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
              Timezone
            </label>
            {timeValue && !timezoneSaved ? (
              <p style={{ color: "var(--color-text)", fontSize: 13, marginBottom: 8, lineHeight: 1.5 }}>
                This time does not have a timezone yet. Choose one and save so the league shares the same moment.
              </p>
            ) : (
              <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginBottom: 8, lineHeight: 1.5 }}>
                Required when you set a time. Defaults to your account timezone.
              </p>
            )}
            <select
              id="draft_timezone"
              name="draft_timezone"
              value={timezoneValue}
              onChange={(e) => setTimezoneValue(e.target.value)}
              disabled={!draftNotStarted}
              required={Boolean(timeValue)}
              style={{
                display: "block",
                width: "100%",
                maxWidth: 320,
                padding: "8px 10px",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                background: "var(--color-bg)",
                color: "var(--color-text)",
              }}
            >
              <option value="">Select a timezone</option>
              {PROFILE_TIMEZONE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
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
