"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function secondsLeft(startedAt: string, deadlineSeconds: number): number {
  const start = new Date(startedAt).getTime();
  const deadline = start + deadlineSeconds * 1000;
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function DraftTimer({
  startedAt,
  leagueSlug,
  secondsPerPick = 120,
}: {
  startedAt: string;
  leagueSlug: string;
  /** For autopick use 5; for live use league time_per_pick_seconds. */
  secondsPerPick?: number;
}) {
  const router = useRouter();
  const [left, setLeft] = useState(() => secondsLeft(startedAt, secondsPerPick));

  useEffect(() => {
    const interval = setInterval(() => {
      const next = secondsLeft(startedAt, secondsPerPick);
      setLeft(next);
      if (next <= 0) {
        clearInterval(interval);
        router.refresh();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt, secondsPerPick, router]);

  if (left <= 0) return <span style={{ marginLeft: 8 }}>Time’s up — auto-pick in progress…</span>;
  return (
    <span
      style={{
        fontSize: "1.5rem",
        fontWeight: 700,
        fontVariantNumeric: "tabular-nums",
        color: left <= 10 ? "var(--color-red)" : "var(--color-text)",
      }}
      aria-live="polite"
    >
      {formatTime(left)}
    </span>
  );
}
