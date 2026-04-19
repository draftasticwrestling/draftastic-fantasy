"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = { token?: string; initialCode?: string };

export function JoinLeagueForm({ token, initialCode = "" }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [code, setCode] = useState(initialCode);

  const handleJoinWithToken = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/leagues/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not join league.");
        return;
      }
      setJoined(true);
      if (data.league_slug) {
        router.push(`/leagues/${data.league_slug}`);
        router.refresh();
      } else {
        router.push("/leagues");
        router.refresh();
      }
    } catch {
      setError("Request failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinWithCode = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setError("Enter a league code.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/leagues/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not join league.");
        return;
      }
      setJoined(true);
      if (data.league_slug) {
        router.push(`/leagues/${data.league_slug}`);
        router.refresh();
      } else {
        router.push("/leagues");
        router.refresh();
      }
    } catch {
      setError("Request failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickJoinPublic = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/leagues/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_quick_join: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not join public league.");
        return;
      }
      setJoined(true);
      if (data.league_slug) {
        router.push(`/leagues/${data.league_slug}`);
        router.refresh();
      } else {
        router.push("/leagues");
        router.refresh();
      }
    } catch {
      setError("Request failed.");
    } finally {
      setLoading(false);
    }
  };

  if (joined) {
    return (
      <p style={{ color: "#166534" }}>Joining… redirecting to the league.</p>
    );
  }

  if (token) {
    return (
      <div>
        <button
          type="button"
          onClick={handleJoinWithToken}
          disabled={loading}
          style={{
            padding: "12px 20px",
            background: "#1a73e8",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 16,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Joining…" : "Join league"}
        </button>
        {error && (
          <p style={{ marginTop: 12, color: "#b91c1c", fontSize: 14 }}>{error}</p>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ padding: 14, border: "1px solid #ddd", borderRadius: 8, background: "#fafafa" }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Join a Public League</div>
        <p style={{ margin: "0 0 10px 0", color: "#555", fontSize: 14 }}>
          Quick Join auto-assigns you to the oldest open public league.
        </p>
        <button
          type="button"
          onClick={handleQuickJoinPublic}
          disabled={loading}
          style={{
            padding: "10px 16px",
            background: "#111827",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Joining…" : "Quick Join Public League"}
        </button>
      </div>

      <div style={{ fontWeight: 600, marginTop: 4 }}>Join a Private League</div>
      <p style={{ margin: 0, color: "#555", fontSize: 14 }}>
        Ask your GM for the code (format like ABCD-2FGH). Codes do not expire.
      </p>
      <input
        id="league-code"
        type="text"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder="XXXX-XXXX"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        style={{
          padding: "12px 14px",
          fontSize: 18,
          letterSpacing: "0.05em",
          fontWeight: 600,
          border: "1px solid #ccc",
          borderRadius: 8,
          maxWidth: 280,
        }}
      />
      <button
        type="button"
        onClick={handleJoinWithCode}
        disabled={loading}
        style={{
          padding: "12px 20px",
          background: "#1a73e8",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 16,
          fontWeight: 600,
          cursor: loading ? "not-allowed" : "pointer",
          alignSelf: "flex-start",
        }}
      >
        {loading ? "Joining…" : "Join with code"}
      </button>
      {error && (
        <p style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}>{error}</p>
      )}
    </div>
  );
}
