"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/* Common IANA timezones for the dropdown. */
const TIMEZONE_OPTIONS = [
  { value: "", label: "Select your timezone" },
  { value: "America/New_York", label: "Eastern (New York)" },
  { value: "America/Chicago", label: "Central (Chicago)" },
  { value: "America/Denver", label: "Mountain (Denver)" },
  { value: "America/Los_Angeles", label: "Pacific (Los Angeles)" },
  { value: "America/Phoenix", label: "Arizona (no DST)" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Paris", label: "Central European (Paris)" },
  { value: "Europe/Berlin", label: "Central European (Berlin)" },
  { value: "Asia/Tokyo", label: "Tokyo" },
  { value: "Australia/Sydney", label: "Sydney" },
  { value: "UTC", label: "UTC" },
];

type Props = {
  userId: string;
  initialDisplayName: string;
  initialTimezone: string;
  initialNotifyTradeProposals: boolean;
  initialNotifyDraftReminder: boolean;
  initialNotifyWeeklyResults: boolean;
  email: string;
};

export function AccountForm({
  initialDisplayName,
  initialTimezone,
  initialNotifyTradeProposals,
  initialNotifyDraftReminder,
  initialNotifyWeeklyResults,
  email,
}: Props) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [notifyTradeProposals, setNotifyTradeProposals] = useState(initialNotifyTradeProposals);
  const [notifyDraftReminder, setNotifyDraftReminder] = useState(initialNotifyDraftReminder);
  const [notifyWeeklyResults, setNotifyWeeklyResults] = useState(initialNotifyWeeklyResults);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName.trim() || null,
          timezone: timezone.trim() || null,
          notify_trade_proposals: notifyTradeProposals,
          notify_draft_reminder: notifyDraftReminder,
          notify_weekly_results: notifyWeeklyResults,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "err", text: data.error ?? "Update failed." });
        return;
      }
      setMessage({ type: "ok", text: "Profile updated." });
      router.refresh();
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
        </div>

        <div>
          <label htmlFor="account-timezone" style={labelStyle}>
            Timezone
          </label>
          <select
            id="account-timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            style={inputStyle}
          >
            {TIMEZONE_OPTIONS.map((opt) => (
              <option key={opt.value || "empty"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#666" }}>
            Used for draft times and weekly matchup windows.
          </p>
        </div>

        <div>
          <span style={labelStyle}>Email notifications</span>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "#666" }}>
            Choose when you want to receive emails (once we enable them).
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={notifyTradeProposals}
                onChange={(e) => setNotifyTradeProposals(e.target.checked)}
              />
              <span>When someone proposes a trade with me</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={notifyDraftReminder}
                onChange={(e) => setNotifyDraftReminder(e.target.checked)}
              />
              <span>Before a scheduled draft (reminder)</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={notifyWeeklyResults}
                onChange={(e) => setNotifyWeeklyResults(e.target.checked)}
              />
              <span>Weekly matchup results</span>
            </label>
          </div>
        </div>

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
