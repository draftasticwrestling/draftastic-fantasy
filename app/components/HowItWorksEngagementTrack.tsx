"use client";

import { useEffect, useRef } from "react";
import {
  clearAnonymousHowItWorksViewed,
  markAnonymousHowItWorksViewed,
} from "@/lib/client/howItWorksEngagement";

/** Records a how-it-works page view for the onboarding checklist (once per mount). */
export function HowItWorksEngagementTrack() {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void (async () => {
      try {
        const res = await fetch("/api/engagement/how-it-works-view", {
          method: "POST",
          credentials: "same-origin",
        });
        if (res.ok) {
          clearAnonymousHowItWorksViewed();
          return;
        }
        if (res.status === 401) {
          markAnonymousHowItWorksViewed();
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  return null;
}
