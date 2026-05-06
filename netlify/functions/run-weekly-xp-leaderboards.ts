import { schedule } from "@netlify/functions";

/**
 * Calls weekly XP + leaderboard cron route.
 *
 * Schedule is weekly in UTC; intended to run shortly after Sunday close.
 * Current expression maps to Monday 00:30 PT during daylight time.
 */
export const handler = schedule("30 7 * * 1", async () => {
  const base = (process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? "").replace(/\/$/, "");
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    console.warn("[run-weekly-xp-leaderboards] Missing URL/DEPLOY_PRIME_URL or CRON_SECRET — skipping");
    return { statusCode: 200, body: "skip" };
  }

  const url = `${base}/api/cron/weekly-xp-leaderboards`;
  const res = await fetch(url, { headers: { "x-cron-secret": secret } });
  const text = await res.text();
  console.log("[run-weekly-xp-leaderboards]", res.status, text.slice(0, 500));
  return { statusCode: res.ok ? 200 : res.status, body: text };
});
