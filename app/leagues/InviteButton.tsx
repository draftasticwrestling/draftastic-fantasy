"use client";

import { useState } from "react";
import { INVITE_LINK_EXPIRY_DAYS } from "@/lib/leagueJoinCode";

type Props = { leagueId: string; leagueName: string; joinCode?: string | null };

export function InviteButton({ leagueId, leagueName, joinCode }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCreateInvite = async () => {
    setLoading(true);
    setUrl(null);
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
        Share this link. Anyone with the link can join <strong>{leagueName}</strong> (valid {INVITE_LINK_EXPIRY_DAYS}{" "}
        days; reusable until full or expired). Or share the league code below — it never expires.
      </p>
      {joinCode ? (
        <div style={{ marginBottom: 12, padding: 10, background: "#fff", borderRadius: 6, border: "1px solid #e0e0e0" }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>League code</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <code style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.05em" }}>{joinCode}</code>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(joinCode);
                  setCopiedCode(true);
                  setTimeout(() => setCopiedCode(false), 2000);
                } catch {
                  /* ignore */
                }
              }}
              style={{
                padding: "4px 10px",
                fontSize: 12,
                background: "#333",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              {copiedCode ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      ) : null}
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
          </div>
        </div>
      )}
    </div>
  );
}
