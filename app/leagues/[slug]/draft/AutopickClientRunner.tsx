"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { runAutopickTickAction } from "./actions";

const MAX_CHAINS = 40;
const PAUSE_MS = 250;

/**
 * Runs autopick in short server-action bursts after the page shell has loaded, so the initial RSC
 * response is not blocked for tens of seconds (which browsers often report as TypeError / network error).
 */
export function AutopickClientRunner({ leagueSlug, enabled }: { leagueSlug: string; enabled: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    setError(null);
    let cancelled = false;

    const chain = async () => {
      for (let i = 0; i < MAX_CHAINS && !cancelled; i++) {
        const r = await runAutopickTickAction(leagueSlug);
        if (cancelled) return;
        if (r.error) {
          setError(r.error);
          return;
        }
        if (!r.didAutoPick) return;
        router.refresh();
        await new Promise((res) => setTimeout(res, PAUSE_MS));
      }
    };

    void chain();
    return () => {
      cancelled = true;
    };
  }, [leagueSlug, enabled, router]);

  if (!enabled || !error) return null;

  return (
    <section
      style={{
        marginBottom: 16,
        padding: 14,
        background: "var(--color-error-bg, #fef2f2)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--color-error-muted, #fecaca)",
      }}
    >
      <p style={{ margin: 0, fontWeight: 600, color: "var(--color-red, #b91c1c)" }}>
        Auto-pick: {error}
      </p>
    </section>
  );
}
