"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateLeagueForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Enter a league name.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          start_date: startDate.trim() || null,
          end_date: endDate.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create league.");
        return;
      }
      router.push(`/leagues/${data.league.slug}`);
      router.refresh();
    } catch {
      setError("Request failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <label htmlFor="league-name" style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
          League name *
        </label>
        <input
          id="league-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. The Road to SummerSlam"
          maxLength={120}
          style={{
            width: "100%",
            padding: "10px 12px",
            fontSize: 16,
            border: "1px solid #ccc",
            borderRadius: 6,
            boxSizing: "border-box",
          }}
        />
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 140px" }}>
          <label htmlFor="league-start" style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
            Start date
          </label>
          <input
            id="league-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              fontSize: 16,
              border: "1px solid #ccc",
              borderRadius: 6,
              boxSizing: "border-box",
            }}
          />
        </div>
        <div style={{ flex: "1 1 140px" }}>
          <label htmlFor="league-end" style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
            End date
          </label>
          <input
            id="league-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              fontSize: 16,
              border: "1px solid #ccc",
              borderRadius: 6,
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>
      {error && (
        <p style={{ margin: 0, color: "#b91c1c", fontSize: 14 }}>{error}</p>
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
        {loading ? "Creating…" : "Create league"}
      </button>
    </form>
  );
}
