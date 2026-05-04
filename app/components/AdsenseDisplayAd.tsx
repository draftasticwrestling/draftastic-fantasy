"use client";

import { useEffect, useRef } from "react";
import { getAdsenseClientCa, isAdsenseScriptEnabled } from "@/lib/adsenseConfig";

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

type Props = {
  /** Numeric slot id from AdSense → Ads → By ad unit */
  slot: string;
  className?: string;
};

/**
 * One responsive display unit. Renders nothing unless `slot` is set and the AdSense script is enabled
 * (production, or NEXT_PUBLIC_ADSENSE_DEV=1 locally).
 */
export function AdsenseDisplayAd({ slot, className }: Props) {
  const pushed = useRef(false);

  useEffect(() => {
    if (!slot || !isAdsenseScriptEnabled() || pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      /* ignore */
    }
  }, [slot]);

  if (!slot || !isAdsenseScriptEnabled()) return null;

  return (
    <aside className={className} aria-label="Advertisement" style={{ margin: "24px auto", maxWidth: 970 }}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={getAdsenseClientCa()}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
