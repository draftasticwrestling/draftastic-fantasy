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
};

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
        // Show once per browser tab session; they'll reappear on the next login/session.
        const filtered = list.filter((n) => {
          try {
            const k = `draftastic-login-nudge-seen:${n.key}`;
            return sessionStorage.getItem(k) !== "1";
          } catch {
            return true;
          }
        });
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
    try {
      sessionStorage.setItem(`draftastic-login-nudge-seen:${current.key}`, "1");
    } catch {
      // no-op
    }
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
          <button type="button" className="login-nudge-dismiss" onClick={dismiss}>
            Dismiss
          </button>
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
      </div>
    </div>,
    document.body
  );
}
