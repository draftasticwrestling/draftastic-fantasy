"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PROFILE_TIMEZONE_OPTIONS } from "@/lib/profileTimezone";
import { EmailNotificationPreferences } from "@/app/account/EmailNotificationPreferences";

type Props = {
  userId: string;
  initialDisplayName: string;
  initialTimezone: string;
  initialNotifyTradeProposals: boolean;
  initialNotifyTradeAccepted: boolean;
  initialNotifyTradeFinalized: boolean;
  initialNotifyGmTradeApproval: boolean;
  initialNotifyEventScores: boolean;
  initialNotifyDraftReminder: boolean;
  initialNotifyWeeklyResults: boolean;
  initialMarketingOptIn: boolean;
  initialAcceptedTermsAt: string | null;
  initialAcceptedPrivacyAt: string | null;
  email: string;
};

export function AccountForm({
  initialDisplayName,
  initialTimezone,
  initialNotifyTradeProposals,
  initialNotifyTradeAccepted,
  initialNotifyTradeFinalized,
  initialNotifyGmTradeApproval,
  initialNotifyEventScores,
  initialNotifyDraftReminder,
  initialNotifyWeeklyResults,
  initialMarketingOptIn,
  initialAcceptedTermsAt,
  initialAcceptedPrivacyAt,
  email,
}: Props) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [notifyTradeProposals, setNotifyTradeProposals] = useState(initialNotifyTradeProposals);
  const [notifyTradeAccepted, setNotifyTradeAccepted] = useState(initialNotifyTradeAccepted);
  const [notifyTradeFinalized, setNotifyTradeFinalized] = useState(initialNotifyTradeFinalized);
  const [notifyGmTradeApproval, setNotifyGmTradeApproval] = useState(initialNotifyGmTradeApproval);
  const [notifyEventScores, setNotifyEventScores] = useState(initialNotifyEventScores);
  const [notifyDraftReminder, setNotifyDraftReminder] = useState(initialNotifyDraftReminder);
  const [notifyWeeklyResults, setNotifyWeeklyResults] = useState(initialNotifyWeeklyResults);
  const [marketingOptIn, setMarketingOptIn] = useState(initialMarketingOptIn);
  const [acceptedTermsChecked, setAcceptedTermsChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const needsRequiredAcceptance = !initialAcceptedTermsAt || !initialAcceptedPrivacyAt;

  useEffect(() => {
    if (initialTimezone.trim()) return;
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected && PROFILE_TIMEZONE_OPTIONS.some((o) => o.value === detected)) {
        setTimezone(detected);
      }
    } catch {
      /* ignore */
    }
  }, [initialTimezone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    if (needsRequiredAcceptance && !acceptedTermsChecked) {
      setMessage({ type: "err", text: "You must accept the Terms and Privacy Policy to continue." });
      setLoading(false);
      return;
    }
    if (!timezone.trim()) {
      setMessage({ type: "err", text: "Select your timezone (required)." });
      setLoading(false);
      return;
    }
    try {
      const acceptedAt = needsRequiredAcceptance && acceptedTermsChecked ? new Date().toISOString() : null;
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName.trim() || null,
          timezone: timezone.trim(),
          notify_trade_proposals: notifyTradeProposals,
          notify_trade_accepted: notifyTradeAccepted,
          notify_trade_finalized: notifyTradeFinalized,
          notify_gm_trade_approval: notifyGmTradeApproval,
          notify_event_scores: notifyEventScores,
          notify_draft_reminder: notifyDraftReminder,
          notify_weekly_results: notifyWeeklyResults,
          marketing_opt_in: marketingOptIn,
          accepted_terms_at: acceptedAt,
          accepted_privacy_at: acceptedAt,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "err", text: data.error ?? "Update failed." });
        return;
      }
      setMessage({ type: "ok", text: "Profile updated." });
      router.refresh();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("draftastic-profile-updated"));
      }
    } catch {
      setMessage({ type: "err", text: "Request failed." });
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%" as const,
    padding: "10px 12px",
    fontSize: 16,
    border: "1px solid #ccc",
    borderRadius: 6,
    boxSizing: "border-box" as const,
  };

  const labelStyle = { display: "block" as const, marginBottom: 4, fontWeight: 500 };

  return (
    <>
      <div style={{ marginBottom: 20, fontSize: 14, color: "#555" }}>
        <strong>Email:</strong> {email}
      </div>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <label htmlFor="account-display-name" style={labelStyle}>
            Display name
          </label>
          <input
            id="account-display-name"
            type="text"
            autoComplete="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="How you appear in leagues"
            maxLength={100}
            style={inputStyle}
          />
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#666" }}>
            Display names are moderated and must follow community standards.
          </p>
        </div>

        <div>
          <label htmlFor="account-timezone" style={labelStyle}>
            Timezone <span style={{ color: "#b91c1c" }} aria-hidden>*</span>
          </label>
          <select
            id="account-timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            style={inputStyle}
            required
            aria-required="true"
          >
            <option value="" disabled>
              Select your timezone
            </option>
            {PROFILE_TIMEZONE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#666" }}>
            Required. Used for draft times and weekly matchup windows.
          </p>
        </div>

        <div>
          <span style={labelStyle}>Marketing emails</span>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "#666" }}>
            Optional updates about league openings, product launches, and beta announcements.
          </p>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={marketingOptIn}
              onChange={(e) => setMarketingOptIn(e.target.checked)}
            />
            <span>Email me Draftastic marketing updates (unsubscribe anytime)</span>
          </label>
        </div>
        <div>
          <span style={labelStyle}>Email notifications</span>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "#666" }}>
            Turn categories on or off, then save. Unchecked items will not be emailed.
          </p>
          <EmailNotificationPreferences
            notifyTradeProposals={notifyTradeProposals}
            notifyTradeAccepted={notifyTradeAccepted}
            notifyTradeFinalized={notifyTradeFinalized}
            notifyGmTradeApproval={notifyGmTradeApproval}
            notifyEventScores={notifyEventScores}
            notifyDraftReminder={notifyDraftReminder}
            notifyWeeklyResults={notifyWeeklyResults}
            setNotifyTradeProposals={setNotifyTradeProposals}
            setNotifyTradeAccepted={setNotifyTradeAccepted}
            setNotifyTradeFinalized={setNotifyTradeFinalized}
            setNotifyGmTradeApproval={setNotifyGmTradeApproval}
            setNotifyEventScores={setNotifyEventScores}
            setNotifyDraftReminder={setNotifyDraftReminder}
            setNotifyWeeklyResults={setNotifyWeeklyResults}
          />
        </div>
        {needsRequiredAcceptance ? (
          <div>
            <span style={labelStyle}>Required</span>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "#444", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={acceptedTermsChecked}
                onChange={(e) => setAcceptedTermsChecked(e.target.checked)}
              />
              <span>
                I agree to the{" "}
                <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "#1a73e8" }}>
                  Terms
                </a>{" "}
                and{" "}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#1a73e8" }}>
                  Privacy Policy
                </a>
                .
              </span>
            </label>
          </div>
        ) : null}

        {message && (
          <p style={{ margin: 0, color: message.type === "err" ? "#b91c1c" : "#166534", fontSize: 14 }}>
            {message.text}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "12px 16px",
            fontSize: 16,
            fontWeight: 600,
            border: "none",
            borderRadius: 8,
            background: "#1a73e8",
            color: "#fff",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Saving…" : "Save changes"}
        </button>
      </form>
    </>
  );
}
