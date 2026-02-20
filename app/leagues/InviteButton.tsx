"use client";

import { useState } from "react";

type Props = { leagueId: string; leagueName: string };

export function InviteButton({ leagueId, leagueName }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const subject = `You're invited to join ${leagueName} on Draftastic Fantasy`;
  const body = `You're invited to join my fantasy league "${leagueName}" on Draftastic Fantasy.\n\nClick the link below to join. The link expires in 7 days.\n\n${url ?? ""}`;
  const mailto = url
    ? `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : null;

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
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
            {mailto && (
              <a
                href={mailto}
                style={{
                  padding: "8px 16px",
                  background: "#1a73e8",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 14,
                  textDecoration: "none",
                  display: "inline-block",
                }}
              >
                Email invite
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
