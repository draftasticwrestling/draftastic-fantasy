"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

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
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "grid",
        placeItems: "center",
        zIndex: 1400,
        padding: 16,
      }}
    >
      <div
        style={{
          width: "min(520px, 100%)",
          background: "var(--color-bg, #fff)",
          border: "1px solid var(--color-border, #e5e7eb)",
          borderRadius: 12,
          padding: 18,
          boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
        }}
      >
        <h2 style={{ margin: "0 0 10px", fontSize: "1.15rem" }}>{current.title}</h2>
        <p style={{ margin: "0 0 14px", color: "var(--color-text-muted, #4b5563)", lineHeight: 1.45 }}>
          {current.body}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="app-btn" onClick={dismiss}>
            Dismiss
          </button>
          {current.secondaryCta ? (
            <Link href={current.secondaryCta.href} className="app-btn" onClick={dismiss}>
              {current.secondaryCta.label}
            </Link>
          ) : null}
          {current.primaryCta ? (
            <Link href={current.primaryCta.href} className="app-btn-primary" onClick={dismiss}>
              {current.primaryCta.label}
            </Link>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
