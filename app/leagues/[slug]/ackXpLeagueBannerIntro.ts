"use server";

import { ackXpLeagueBannerLevelAction } from "./ackXpLeagueBannerLevel";

/** @deprecated Use ackXpLeagueBannerLevelAction({ markIntroSeen: true }) */
export async function ackXpLeagueBannerIntroAction(): Promise<{ ok: boolean }> {
  return ackXpLeagueBannerLevelAction({ markIntroSeen: true });
}
