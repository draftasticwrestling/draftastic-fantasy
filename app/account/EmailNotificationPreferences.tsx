"use client";

import type { ReactNode } from "react";

type CheckboxProps = {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
};

function PrefCheckbox({ id, checked, onChange, label, description }: CheckboxProps) {
  return (
    <label
      htmlFor={id}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        cursor: "pointer",
        padding: "10px 12px",
        borderRadius: 8,
        border: "1px solid #e5e7eb",
        background: "#fafafa",
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 3, flexShrink: 0 }}
      />
      <span>
        <span style={{ display: "block", fontWeight: 500 }}>{label}</span>
        {description ? (
          <span style={{ display: "block", marginTop: 4, fontSize: 13, color: "#666", lineHeight: 1.4 }}>
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}

function PrefSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section style={{ marginBottom: 20 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600 }}>{title}</h3>
      <p style={{ margin: "0 0 10px", fontSize: 13, color: "#666", lineHeight: 1.4 }}>{description}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </section>
  );
}

export type EmailNotificationPrefs = {
  notifyTradeProposals: boolean;
  notifyTradeAccepted: boolean;
  notifyTradeFinalized: boolean;
  notifyGmTradeApproval: boolean;
  notifyEventScores: boolean;
  notifyDraftReminder: boolean;
  notifyWeeklyResults: boolean;
};

export type EmailNotificationPrefsHandlers = {
  setNotifyTradeProposals: (v: boolean) => void;
  setNotifyTradeAccepted: (v: boolean) => void;
  setNotifyTradeFinalized: (v: boolean) => void;
  setNotifyGmTradeApproval: (v: boolean) => void;
  setNotifyEventScores: (v: boolean) => void;
  setNotifyDraftReminder: (v: boolean) => void;
  setNotifyWeeklyResults: (v: boolean) => void;
};

type Props = EmailNotificationPrefs & EmailNotificationPrefsHandlers;

export function EmailNotificationPreferences(props: Props) {
  return (
    <div>
      <PrefSection
        title="Trades"
        description="Offers, responses, and commissioner approval for league trades."
      >
        <PrefCheckbox
          id="notify-trade-proposals"
          checked={props.notifyTradeProposals}
          onChange={props.setNotifyTradeProposals}
          label="Incoming trade offers"
          description="When another manager proposes a trade with you."
        />
        <PrefCheckbox
          id="notify-trade-accepted"
          checked={props.notifyTradeAccepted}
          onChange={props.setNotifyTradeAccepted}
          label="Responses to my trades"
          description="When someone accepts or declines a trade you proposed."
        />
        <PrefCheckbox
          id="notify-trade-finalized"
          checked={props.notifyTradeFinalized}
          onChange={props.setNotifyTradeFinalized}
          label="GM decision on my trades"
          description="When the league GM approves or declines a trade you are involved in."
        />
        <PrefCheckbox
          id="notify-gm-trade-approval"
          checked={props.notifyGmTradeApproval}
          onChange={props.setNotifyGmTradeApproval}
          label="Trades awaiting my approval (GM)"
          description="When both managers have agreed and you need to approve as commissioner."
        />
      </PrefSection>

      <PrefSection
        title="Event scoring"
        description="Fantasy points after WWE events are finalized in our boxscore."
      >
        <PrefCheckbox
          id="notify-event-scores"
          checked={props.notifyEventScores}
          onChange={props.setNotifyEventScores}
          label="New event scores posted"
          description="When a show is marked complete and fantasy scores are available."
        />
      </PrefSection>

      <PrefSection
        title="League schedule"
        description="Draft timing and weekly matchup summaries (sent when those features run)."
      >
        <PrefCheckbox
          id="notify-draft-reminder"
          checked={props.notifyDraftReminder}
          onChange={props.setNotifyDraftReminder}
          label="Draft reminders"
          description="Before a scheduled league draft starts."
        />
        <PrefCheckbox
          id="notify-weekly-results"
          checked={props.notifyWeeklyResults}
          onChange={props.setNotifyWeeklyResults}
          label="Weekly matchup results"
          description="End-of-week scores and standings for your leagues."
        />
      </PrefSection>
    </div>
  );
}
