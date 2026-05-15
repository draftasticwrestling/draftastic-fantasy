"use client";

import Image from "next/image";
import { useState } from "react";
import type { LevelUpCelebration } from "@/lib/xp/xpLevelUpFlavor";
import type { LeagueHomeXpBannerKind } from "@/lib/xp/leagueHomeXpBannerKind";
import { ackXpLeagueBannerLevelAction } from "./ackXpLeagueBannerLevel";

type Props = {
  celebration: LevelUpCelebration | null;
  bannerKind: LeagueHomeXpBannerKind | null;
  className?: string;
};

export function LeagueLevelUpBanner({ celebration, bannerKind, className }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [ackPending, setAckPending] = useState(false);

  if (!celebration || dismissed) return null;

  async function dismiss() {
    setAckPending(true);
    try {
      await ackXpLeagueBannerLevelAction({
        markIntroSeen: bannerKind === "intro",
      });
    } finally {
      setAckPending(false);
    }
    setDismissed(true);
  }

  const kicker =
    bannerKind === "intro" ? "YOUR LEVEL" : "YOU'VE LEVELED UP!";

  return (
    <div
      className={["lm-level-up-banner", className].filter(Boolean).join(" ")}
      role="status"
      aria-live="polite"
    >
      <button
        type="button"
        className="lm-level-up-banner__dismiss"
        onClick={() => void dismiss()}
        disabled={ackPending}
        aria-label={bannerKind === "intro" ? "Dismiss level banner" : "Dismiss level-up message"}
      >
        ×
      </button>
      <div className="lm-level-up-banner__inner">
        <div className="lm-level-up-banner__icon-wrap">
          <Image
            src="/images/leveled-up.png"
            alt=""
            width={90}
            height={90}
            className="lm-level-up-banner__icon"
            priority
          />
        </div>
        <div className="lm-level-up-banner__body">
          <p className="lm-level-up-banner__kicker">{kicker}</p>
          <h2 className="lm-level-up-banner__title">{celebration.label}</h2>
          <p className="lm-level-up-banner__copy">{celebration.flavor}</p>
        </div>
      </div>
    </div>
  );
}
