"use client";

import { useState } from "react";

type Props = { leagueId: string; leagueName: string };

export function InviteButton({ leagueId, leagueName }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [toEmail, setToEmail] = useState("");
  const [message, setMessage] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<{ ok?: boolean; error?: string } | null>(null);

  const handleCreateInvite = async () => {
    setLoading(true);
    setUrl(null);
    setEmailResult(null);
    try {
      const res = await fetch("/api/leagues/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ league_id: leagueId }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setUrl(data.url);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select the input
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || !toEmail.trim()) return;
    setEmailSending(true);
    setEmailResult(null);
    try {
      const res = await fetch("/api/leagues/invite/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          league_id: leagueId,
          invite_url: url,
          league_name: leagueName,
          to_email: toEmail.trim(),
          message: message.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setEmailResult({ ok: true });
        setToEmail("");
        setMessage("");
      } else {
        setEmailResult({ error: data.error ?? "Failed to send" });
      }
    } catch {
      setEmailResult({ error: "Failed to send" });
    } finally {
      setEmailSending(false);
    }
  };

  return (
    <div
      style={{
        padding: 16,
        background: "#f8f8f8",
        borderRadius: 8,
        border: "1px solid #e8e8e8",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Invite friends</div>
      <p style={{ margin: "0 0 12px", fontSize: 14, color: "#555" }}>
        Share this link. Anyone with the link can join <strong>{leagueName}</strong> (link expires in 7 days).
      </p>
      {!url ? (
        <button
          type="button"
          onClick={handleCreateInvite}
          disabled={loading}
          style={{
            padding: "8px 16px",
            background: "#1a73e8",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Generating…" : "Generate invite link"}
        </button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="text"
            readOnly
            value={url}
            style={{
              width: "100%",
              padding: "8px 12px",
              fontSize: 14,
              border: "1px solid #ccc",
              borderRadius: 6,
              boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button
              type="button"
              onClick={handleCopy}
              style={{
                padding: "8px 16px",
                background: copied ? "#166534" : "#333",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              {copied ? "Copied!" : "Copy link"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowEmailForm((v) => !v);
                setEmailResult(null);
              }}
              style={{
                padding: "8px 16px",
                background: "#1a73e8",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              {showEmailForm ? "Hide email form" : "Email invite"}
            </button>
          </div>

          {showEmailForm && (
            <form
              onSubmit={handleSendEmail}
              style={{
                marginTop: 8,
                padding: 12,
                background: "#fff",
                border: "1px solid #e0e0e0",
                borderRadius: 6,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div>
                <label htmlFor="invite-to-email" style={{ display: "block", fontSize: 12, marginBottom: 4, fontWeight: 500 }}>
                  To (email)
                </label>
                <input
                  id="invite-to-email"
                  type="email"
                  required
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  placeholder="friend@example.com"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    fontSize: 14,
                    border: "1px solid #ccc",
                    borderRadius: 6,
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label htmlFor="invite-message" style={{ display: "block", fontSize: 12, marginBottom: 4, fontWeight: 500 }}>
                  Optional message
                </label>
                <textarea
                  id="invite-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Add a personal note…"
                  rows={2}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    fontSize: 14,
                    border: "1px solid #ccc",
                    borderRadius: 6,
                    boxSizing: "border-box",
                    resize: "vertical",
                  }}
                />
              </div>
              {emailResult?.ok && (
                <p style={{ margin: 0, fontSize: 14, color: "#166534" }}>Email sent. They can reply to reach you.</p>
              )}
              {emailResult?.error && (
                <p style={{ margin: 0, fontSize: 14, color: "#b91c1c" }}>{emailResult.error}</p>
              )}
              <button
                type="submit"
                disabled={emailSending}
                style={{
                  padding: "8px 16px",
                  background: "#1a73e8",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: emailSending ? "not-allowed" : "pointer",
                  alignSelf: "flex-start",
                }}
              >
                {emailSending ? "Sending…" : "Send invite email"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
