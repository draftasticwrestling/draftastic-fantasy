"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = { token: string };

export function JoinLeagueForm({ token }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  const handleJoin = async () => {
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

  if (joined) {
    return (
      <p style={{ color: "#166534" }}>Joining… redirecting to the league.</p>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleJoin}
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
