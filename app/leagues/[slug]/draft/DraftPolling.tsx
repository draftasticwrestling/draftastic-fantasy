"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/** Live draft: balance freshness vs serverless/RSC invocations (each refresh = full draft page render). */
const LIVE_POLL_INTERVAL_MS = 18_000;

/** Autopick when not using a custom interval (e.g. slim board uses faster refresh). */
const AUTOPICK_POLL_INTERVAL_MS = 120_000;

type Props = { isAutopick?: boolean; /** Override default live / autopick intervals (ms). */ intervalMs?: number };

export function DraftPolling({ isAutopick = false, intervalMs: intervalMsProp }: Props) {
  const router = useRouter();
  const intervalMs =
    intervalMsProp ?? (isAutopick ? AUTOPICK_POLL_INTERVAL_MS : LIVE_POLL_INTERVAL_MS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const clear = () => {
      if (intervalRef.current != null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const refresh = () => {
      router.refresh();
    };

    const start = () => {
      clear();
      intervalRef.current = setInterval(refresh, intervalMs);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        clear();
        return;
      }
      refresh();
      start();
    };

    if (document.visibilityState === "visible") {
      refresh();
      start();
    }

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clear();
    };
  }, [router, intervalMs]);

  return null;
}
