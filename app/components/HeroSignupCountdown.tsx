"use client";

import { useEffect, useMemo, useState } from "react";

/** Next local midnight (00:00:00) — i.e. end of “today” for the user’s device clock. */
function localMidnightTonightMs(fromMs: number): number {
  const d = new Date(fromMs);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0).getTime();
}

type ClockParts = { days: number; hours: number; minutes: number; seconds: number; expired: boolean };

function computeParts(nowMs: number): ClockParts {
  const targetMs = localMidnightTonightMs(nowMs);
  const diff = targetMs - nowMs;
  if (!Number.isFinite(diff) || diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds, expired: false };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export default function HeroSignupCountdown() {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const clock = useMemo(() => computeParts(nowMs), [nowMs]);

  if (clock.expired) {
    return (
      <div className="hub-hero-countdown hub-hero-countdown-expired" role="status" aria-live="polite">
        Signup window has closed.
      </div>
    );
  }

  return (
    <div className="hub-hero-countdown" role="timer" aria-live="polite" aria-atomic="true">
      <span className="hub-hero-countdown-label">Signup deadline in</span>
      <span className="hub-hero-countdown-time">
        {clock.days}d : {pad(clock.hours)}h : {pad(clock.minutes)}m : {pad(clock.seconds)}s
      </span>
    </div>
  );
}

