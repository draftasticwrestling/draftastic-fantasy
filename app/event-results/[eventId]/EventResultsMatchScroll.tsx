"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/** Scroll to `#match-{n}` when URL has `?match=n` (same 1-based index as MatchCard navigation). */
export function EventResultsMatchScroll() {
  const searchParams = useSearchParams();
  const raw = searchParams.get("match");
  useEffect(() => {
    if (raw == null || raw === "") return;
    const n = String(raw).trim();
    if (!/^\d+$/.test(n)) return;
    const el = document.getElementById(`match-${n}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [raw]);
  return null;
}
