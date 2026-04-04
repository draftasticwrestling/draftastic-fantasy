"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

export function JumpToBoxscoreEventEditor() {
  const router = useRouter();
  const [id, setId] = useState("");

  const go = useCallback(() => {
    const trimmed = id.trim();
    if (!trimmed) return;
    router.push(`/internal-admin/boxscore/events/${encodeURIComponent(trimmed)}/edit`);
  }, [id, router]);

  return (
    <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
      <label htmlFor="jump-event-id" style={{ fontSize: 14, color: "var(--color-text-muted)", width: "100%", maxWidth: 420 }}>
        <span style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Or jump straight to the editor</span>
        <input
          id="jump-event-id"
          type="text"
          value={id}
          onChange={(e) => setId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), go())}
          placeholder="Paste events.id (or slug that resolves in the inspector)"
          style={{
            width: "100%",
            maxWidth: 420,
            padding: "10px 12px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-border)",
            background: "var(--color-bg-surface)",
            color: "var(--color-text)",
            fontSize: 14,
            fontFamily: "ui-monospace, monospace",
          }}
        />
      </label>
      <button
        type="button"
        onClick={go}
        disabled={!id.trim()}
        style={{
          padding: "10px 18px",
          fontWeight: 600,
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--color-border)",
          background: "var(--color-blue)",
          color: "#fff",
          cursor: id.trim() ? "pointer" : "not-allowed",
          opacity: id.trim() ? 1 : 0.55,
          fontSize: 14,
        }}
      >
        Open editor
      </button>
    </div>
  );
}
