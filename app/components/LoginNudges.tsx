"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { siteLogoHref } from "@/lib/siteLogo";

type Nudge = {
  key: string;
  title: string;
  body: string;
  primaryCta: { label: string; href: string } | null;
  secondaryCta: { label: string; href: string } | null;
  /** From server: `once` = show at most one time ever in this browser after dismiss. */
  persist?: "daily" | "once";
};

/** YYYY-MM-DD in the user's local timezone — used to show each nudge at most once per day. */
function localCalendarDayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function nudgeSeenStorageKey(nudgeKey: string): string {
  return `draftastic-login-nudge-seen:${nudgeKey}`;
}

function wasNudgeSeenToday(nudgeKey: string): boolean {
  try {
    const day = localStorage.getItem(nudgeSeenStorageKey(nudgeKey));
    return day === localCalendarDayKey();
  } catch {
    return false;
  }
}

function markNudgeSeenToday(nudgeKey: string): void {
  try {
    localStorage.setItem(nudgeSeenStorageKey(nudgeKey), localCalendarDayKey());
  } catch {
    // no-op (private mode, etc.)
  }
}

function nudgeDismissedForeverKey(nudgeKey: string): string {
  return `draftastic-login-nudge-dismissed-forever:${nudgeKey}`;
}

function wasNudgeDismissedForever(nudgeKey: string): boolean {
  try {
    return localStorage.getItem(nudgeDismissedForeverKey(nudgeKey)) === "1";
  } catch {
    return false;
  }
}

function markNudgeDismissedForever(nudgeKey: string): void {
  try {
    localStorage.setItem(nudgeDismissedForeverKey(nudgeKey), "1");
  } catch {
    // no-op
  }
}

function shouldShowNudge(n: Nudge): boolean {
  if (n.persist === "once") return !wasNudgeDismissedForever(n.key);
  return !wasNudgeSeenToday(n.key);
}

export default function LoginNudges() {
  const [loaded, setLoaded] = useState(false);
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me/nudges")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data?.nudges) ? (data.nudges as Nudge[]) : [];
        // Default: at most once per calendar day (local). `persist: once` = one lifetime dismiss per browser.
        const filtered = list.filter(shouldShowNudge);
        setNudges(filtered);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const current = useMemo(() => nudges[idx] ?? null, [nudges, idx]);

  const dismiss = () => {
    if (!current) return;
    if (current.persist === "once") markNudgeDismissedForever(current.key);
    else markNudgeSeenToday(current.key);
    setIdx((v) => v + 1);
  };

  if (!loaded || !current || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={current.title}
      className="login-nudge-overlay"
    >
      <div className="login-nudge-card">
        <div className="login-nudge-header">
          <img src={siteLogoHref()} alt="" className="login-nudge-logo" />
          <p className="login-nudge-kicker">Draftastic reminder</p>
        </div>
        <h2 className="login-nudge-title">{current.title}</h2>
        <p className="login-nudge-body">{current.body}</p>
        <div className="login-nudge-actions">
          <div className="login-nudge-cta-row">
            {current.primaryCta ? (
              <Link href={current.primaryCta.href} className="hub-hero-btn hub-hero-btn-primary" onClick={dismiss}>
                {current.primaryCta.label}
              </Link>
            ) : null}
            {current.secondaryCta ? (
              <Link href={current.secondaryCta.href} className="hub-hero-btn hub-hero-btn-outline" onClick={dismiss}>
                {current.secondaryCta.label}
              </Link>
            ) : null}
          </div>
          <button type="button" className="login-nudge-dismiss" onClick={dismiss}>
            Dismiss
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
