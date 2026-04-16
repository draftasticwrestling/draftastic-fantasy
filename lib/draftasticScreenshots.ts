/** Public bucket URLs for marketing screenshots (same images as About Us / coming-soon story). */
export const DRAFTASTIC_SCREENSHOTS_BASE =
  "https://qvbqxietcmweltxoonvh.supabase.co/storage/v1/object/public/draftastic-screenshots";

export const DRAFTASTIC_SCREENSHOTS = {
  roster: `${DRAFTASTIC_SCREENSHOTS_BASE}/draftastic-roster.png`,
  standings: `${DRAFTASTIC_SCREENSHOTS_BASE}/draftastic-standings.png`,
  leaderboard: `${DRAFTASTIC_SCREENSHOTS_BASE}/draftastic-leaderboard.png`,
  profile: `${DRAFTASTIC_SCREENSHOTS_BASE}/draftastic-profile.png`,
} as const;
