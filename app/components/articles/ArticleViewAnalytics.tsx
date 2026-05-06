"use client";

import { useEffect, useRef } from "react";

const VISITOR_KEY = "draftastic_analytics_visitor_v1";
const VIEW_DEBOUNCE_KEY = "draftastic_article_view_debounce";

function getOrCreateVisitorKey(): string {
  try {
    let k = window.localStorage.getItem(VISITOR_KEY)?.trim();
    if (!k) {
      k = crypto.randomUUID();
      window.localStorage.setItem(VISITOR_KEY, k);
    }
    return k;
  } catch {
    return crypto.randomUUID();
  }
}

function shouldSkipDuplicateView(slug: string): boolean {
  try {
    const key = `${VIEW_DEBOUNCE_KEY}:${slug}`;
    const now = Date.now();
    const last = Number(window.sessionStorage.getItem(key) ?? "0");
    if (now - last < 2500) return true;
    window.sessionStorage.setItem(key, String(now));
    return false;
  } catch {
    return false;
  }
}

type Props = { slug: string };

/**
 * Records article views (signed-in + anonymous when service role is configured) and dwell time on leave.
 */
export function ArticleViewAnalytics({ slug }: Props) {
  const startRef = useRef<number | null>(null);
  const dwellSentRef = useRef(false);

  useEffect(() => {
    const visitorKey = getOrCreateVisitorKey();
    if (!shouldSkipDuplicateView(slug)) {
      void fetch("/api/engagement/article-track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        keepalive: true,
        body: JSON.stringify({ slug, visitorKey, event: "view" }),
      }).catch(() => {});
    }

    startRef.current = Date.now();
    dwellSentRef.current = false;

    const sendDwell = () => {
      if (dwellSentRef.current || startRef.current == null) return;
      const sec = Math.round((Date.now() - startRef.current) / 1000);
      if (sec < 3) return;
      dwellSentRef.current = true;
      const body = JSON.stringify({ slug, visitorKey, event: "dwell", dwellSeconds: sec });
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(
          "/api/engagement/article-track",
          new Blob([body], { type: "application/json" })
        );
      } else {
        void fetch("/api/engagement/article-track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          keepalive: true,
          body,
        }).catch(() => {});
      }
    };

    const onVis = () => {
      if (document.visibilityState === "hidden") sendDwell();
    };
    window.addEventListener("pagehide", sendDwell);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", sendDwell);
      sendDwell();
    };
  }, [slug]);

  return null;
}
