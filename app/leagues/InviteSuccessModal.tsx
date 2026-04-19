"use client";

import { useEffect, useState, useCallback } from "react";
import { INVITE_LINK_EXPIRY_DAYS } from "@/lib/leagueJoinCode";

type Props = {
  show: boolean;
  leagueId: string;
  leagueName: string;
  /** Permanent code (XXXX-XXXX); shown when column is present. */
  joinCode?: string | null;
  onClose: () => void;
};

export function InviteSuccessModal({ show, leagueId, leagueName, joinCode, onClose }: Props) {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  /** Filled from invite API when page didn’t pass join_code (e.g. older cache). */
  const [joinCodeFromInvite, setJoinCodeFromInvite] = useState<string | null>(null);

  const displayJoinCode = joinCode?.trim() || joinCodeFromInvite?.trim() || null;

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
      if (res.ok && typeof data.join_code === "string" && data.join_code.trim()) {
        setJoinCodeFromInvite(data.join_code.trim());
      }
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

  const handleCopyCode = useCallback(async () => {
    if (!displayJoinCode) return;
    try {
      await navigator.clipboard.writeText(displayJoinCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      // ignore
    }
  }, [displayJoinCode]);

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
          <span>Let&apos;s Play!</span>
        </div>
        <h2 id="invite-success-title" className="invite-success-title">
          Congrats, you created a league!
        </h2>
        <p className="invite-success-subtitle">
          Now invite friends to join <strong>{leagueName}</strong>.
        </p>

        {displayJoinCode ? (
          <div style={{ marginBottom: 20, textAlign: "left" }}>
            <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 600 }}>League code (doesn’t expire)</p>
            <p style={{ margin: "0 0 10px", fontSize: 13, color: "#555" }}>
              Managers can join at{" "}
              <a href="/leagues/join" style={{ color: "#1a73e8" }}>
                Join a league
              </a>{" "}
              and enter this code — no link required.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input
                readOnly
                value={displayJoinCode}
                aria-label="League code"
                style={{
                  flex: 1,
                  minWidth: 140,
                  padding: "10px 12px",
                  fontSize: 17,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  boxSizing: "border-box",
                }}
              />
              <button
                type="button"
                className="invite-success-btn invite-success-btn-secondary"
                onClick={handleCopyCode}
              >
                {copiedCode ? "Copied!" : "Copy code"}
              </button>
            </div>
          </div>
        ) : null}

        <p style={{ margin: "0 0 16px", fontSize: 13, color: "#666", textAlign: "left" }}>
          Invite links stay valid for {INVITE_LINK_EXPIRY_DAYS} days and can be used by multiple people until they
          expire or the league is full.
        </p>

        <div className="invite-success-actions">
          <button
            type="button"
            className="invite-success-btn invite-success-btn-primary"
            onClick={handleCopy}
            disabled={!inviteUrl || loading}
          >
            {loading ? "Generating link…" : copied ? "Copied!" : "Copy invite link"}
          </button>
        </div>
      </div>
    </div>
  );
}
