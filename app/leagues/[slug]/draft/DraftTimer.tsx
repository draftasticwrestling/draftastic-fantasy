"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const DEADLINE_SECONDS = 2 * 60; // 2 minutes

function secondsLeft(startedAt: string): number {
  const start = new Date(startedAt).getTime();
  const deadline = start + DEADLINE_SECONDS * 1000;
  const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  return left;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function DraftTimer({ startedAt, leagueSlug }: { startedAt: string; leagueSlug: string }) {
  const router = useRouter();
  const [left, setLeft] = useState(() => secondsLeft(startedAt));

  useEffect(() => {
    const interval = setInterval(() => {
      const next = secondsLeft(startedAt);
      setLeft(next);
      if (next <= 0) {
        clearInterval(interval);
        router.refresh();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt, router]);

  if (left <= 0) return <span style={{ marginLeft: 8 }}>Time’s up — auto-pick in progress…</span>;
  return (
    <span style={{ marginLeft: 8, fontWeight: 600, color: left <= 30 ? "#c62828" : "#1a73e8" }}>
      ({formatTime(left)} left)
    </span>
  );
}
