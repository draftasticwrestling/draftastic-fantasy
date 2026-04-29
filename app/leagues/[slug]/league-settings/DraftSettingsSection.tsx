"use client";

import Link from "next/link";
import { useState, useActionState, useEffect } from "react";
import { updateDraftSettingsFormAction } from "../actions";
import {
  BETA_AUTOPICK_DRAFT_WINDOW_LABEL,
  BETA_AUTOPICK_FIRST_EVENT_LABEL,
  BETA_AUTOPICK_PREF_DEADLINE_LABEL,
  BETA_AUTOPICK_ROSTERS_LIVE_LABEL,
} from "@/lib/betaAutopickSchedule";

/** Beta: only Offline and Autopick (stored as draft_type). Live drafts are disabled. */
const DRAFT_TYPE_OPTIONS: { value: "offline" | "autopick"; label: string; description: string }[] = [
  {
    value: "offline",
    label: "Offline",
    description:
      "Your league runs its own draft outside the site. When you are ready, the GM adds wrestlers to each roster (roster tools on each team page — more guidance coming soon).",
  },
  {
    value: "autopick",
    label: "Autopick",
    description:
      "Each manager sets auto-draft preferences (everyone defaults to the site Default Big Board until they deliberately choose another provided Big Board or My own list). Drafts run during the beta window, and rosters appear in your league in time for the first scored show.",
  },
];

const OFFLINE_DRAFT_SHEET_EXPORT_URL =
  "https://docs.google.com/spreadsheets/d/19v4VhgG0kYhHr1HGbAPb29flqIPxeNgY/export?format=xlsx";

type Props = {
  leagueSlug: string;
  /** Stored draft_type: offline | autopick | legacy linear/snake (treated as Autopick in UI). */
  draftType: string | null | undefined;
  isPublicLeague: boolean;
};

function toUiDraftType(stored: string | null | undefined): "offline" | "autopick" {
  if (stored === "offline") return "offline";
  if (stored === "autopick") return "autopick";
  return "autopick";
}

export function DraftSettingsSection({ leagueSlug, draftType, isPublicLeague }: Props) {
  const storedUi = toUiDraftType(draftType);
  const initialType: "offline" | "autopick" =
    isPublicLeague && storedUi === "offline" ? "autopick" : storedUi;
  const [selectedType, setSelectedType] = useState<"offline" | "autopick">(initialType);

  useEffect(() => {
    const next = toUiDraftType(draftType);
    setSelectedType(isPublicLeague && next === "offline" ? "autopick" : next);
  }, [draftType, isPublicLeague]);

  const [state, formAction] = useActionState(updateDraftSettingsFormAction, null as { error?: string } | null);

  return (
    <section aria-labelledby="draft-settings-heading" style={{ marginBottom: 32 }}>
      <h2 id="draft-settings-heading" style={{ fontSize: "1.25rem", marginBottom: 12 }}>
        Draft
      </h2>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 16, maxWidth: 640 }}>
        Road to SummerSlam beta: choose <strong>Offline</strong> or <strong>Autopick</strong>. There is no live on-site draft and no scheduled draft date — timing follows the beta schedule below.
      </p>
      {isPublicLeague ? (
        <p style={{ color: "var(--color-text-muted)", marginBottom: 16, maxWidth: 640, fontSize: 14 }}>
          Public leagues are limited to <strong>Autopick</strong> so managers across different regions/time zones can participate fairly.
        </p>
      ) : null}

      <div
        style={{
          marginBottom: 24,
          padding: "14px 16px",
          background: "var(--color-bg-elevated)",
          borderRadius: "var(--radius)",
          border: "1px solid var(--color-border)",
          fontSize: 14,
          color: "var(--color-text-muted)",
          lineHeight: 1.65,
        }}
      >
        <p style={{ margin: "0 0 10px", fontWeight: 600, color: "var(--color-text)" }}>Autopick beta schedule</p>
        <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
          <li>
            Managers can set preferences through end of day <strong>{BETA_AUTOPICK_PREF_DEADLINE_LABEL}</strong> (everyone defaults to the
            site Default Big Board until they deliberately choose another provided Big Board or &quot;My own list&quot;).
          </li>
          <li>Drafts are intended to run <strong>{BETA_AUTOPICK_DRAFT_WINDOW_LABEL}</strong>.</li>
          <li>Rosters should appear <strong>{BETA_AUTOPICK_ROSTERS_LIVE_LABEL}</strong>, ahead of <strong>{BETA_AUTOPICK_FIRST_EVENT_LABEL}</strong>.</li>
        </ul>
      </div>

      <p style={{ color: "var(--color-text-muted)", marginBottom: 20, maxWidth: 640, fontSize: 14 }}>
        <strong>Snake draft order</strong> is used for any on-site autopick run (same order reverses each round). The GM uses the{" "}
        <Link href={`/leagues/${leagueSlug}/draft`} className="app-link">
          Draft
        </Link>{" "}
        tab to <strong>randomize pick order once</strong> before the draft window so managers know their slot while building lists. That order cannot be changed after it is generated; if the GM never clicks it, a random order is created automatically when the autopick draft runs.
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
                      <>: <span style={{ color: "var(--color-text-muted)" }}>{opt.description}</span></>
                    )}
                  </span>
                </label>
              </li>
              );
            })}
          </ul>
        </div>

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
