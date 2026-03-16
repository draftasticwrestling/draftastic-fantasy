"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const POLL_INTERVAL_MS = 5000;
const AUTOPICK_POLL_INTERVAL_MS = 2000;

export function DraftPolling({ isAutopick = false }: { isAutopick?: boolean }) {
  const router = useRouter();
  const intervalMs = isAutopick ? AUTOPICK_POLL_INTERVAL_MS : POLL_INTERVAL_MS;

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, intervalMs);
    return () => clearInterval(interval);
  }, [router, intervalMs]);

  return null;
}
