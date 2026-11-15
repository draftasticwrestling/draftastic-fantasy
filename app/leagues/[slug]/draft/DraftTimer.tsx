"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
  onExpire,
}: {
  startedAt: string;
  leagueSlug: string;
  /** For autopick use 5; for live use league time_per_pick_seconds. */
  secondsPerPick?: number;
  /** Live drafts make one pick from here. Autopick still reloads the page. */
  onExpire?: () => void;
}) {
  const router = useRouter();
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;
  const [left, setLeft] = useState(() => secondsLeft(startedAt, secondsPerPick));

  useEffect(() => {
    let fired = false;
    const tick = () => {
      const next = secondsLeft(startedAt, secondsPerPick);
      setLeft(next);
      if (next > 0 || fired) return;
      fired = true;
      if (onExpireRef.current) onExpireRef.current();
      else router.refresh();
    };
    tick();
    const interval = setInterval(tick, 1000);
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
