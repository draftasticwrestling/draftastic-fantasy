"use client";

import { useEffect, useState, useCallback } from "react";

type Props = {
  show: boolean;
  leagueId: string;
  leagueName: string;
  onClose: () => void;
};

export function InviteSuccessModal({ show, leagueId, leagueName, onClose }: Props) {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [toEmail, setToEmail] = useState("");
  const [message, setMessage] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<{ ok?: boolean; error?: string } | null>(null);

  const fetchInvite = useCallback(async () => {
    setLoading(true);
    setInviteUrl(null);
    try {
      const res = await fetch("/api/leagues/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ league_id: leagueId }),
      });
      const data = await res.json();
      if (res.ok && data.url) setInviteUrl(data.url);
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    if (show && leagueId) fetchInvite();
  }, [show, leagueId, fetchInvite]);

  const handleCopy = useCallback(async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore
    }
  }, [inviteUrl]);

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteUrl || !toEmail.trim()) return;
    setEmailSending(true);
    setEmailResult(null);
    try {
      const res = await fetch("/api/leagues/invite/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          league_id: leagueId,
          invite_url: inviteUrl,
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

  if (!show) return null;

  return (
    <div className="invite-success-overlay" role="dialog" aria-modal="true" aria-labelledby="invite-success-title">
      <div className="invite-success-backdrop" onClick={onClose} aria-hidden />
      <div className="invite-success-modal">
        <button
          type="button"
          className="invite-success-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <div className="invite-success-icon">
          <span>Go!</span>
        </div>
        <h2 id="invite-success-title" className="invite-success-title">
          Congrats, you created a league!
        </h2>
        <p className="invite-success-subtitle">Now invite friends.</p>

        <div className="invite-success-actions">
          <button
            type="button"
            className="invite-success-btn invite-success-btn-primary"
            onClick={() => setShowEmailForm((v) => !v)}
          >
            Invite via email
          </button>
          <button
            type="button"
            className="invite-success-btn invite-success-btn-secondary"
            onClick={handleCopy}
            disabled={!inviteUrl || loading}
          >
            {loading ? "Generating link…" : copied ? "Copied!" : "Copy invite link"}
          </button>
        </div>

        {showEmailForm && inviteUrl && (
          <form onSubmit={handleSendEmail} className="invite-success-email-form">
            <label htmlFor="invite-modal-email">Email address</label>
            <input
              id="invite-modal-email"
              type="email"
              required
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="friend@example.com"
            />
            <label htmlFor="invite-modal-message">Optional message</label>
            <textarea
              id="invite-modal-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a personal note…"
              rows={2}
            />
            {emailResult?.ok && <p className="invite-success-email-ok">Invite sent!</p>}
            {emailResult?.error && <p className="invite-success-email-err">{emailResult.error}</p>}
            <button type="submit" disabled={emailSending} className="invite-success-btn invite-success-btn-primary">
              {emailSending ? "Sending…" : "Send invite email"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
