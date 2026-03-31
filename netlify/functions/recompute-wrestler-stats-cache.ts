import { schedule } from "@netlify/functions";

/**
 * Refresh wrestler_stats_cache twice daily.
 * 30 4,16 * * * UTC = 8:30 PM / 8:30 AM PST (9:30 PM / 9:30 AM during PDT).
 * Calls GET /api/cron/recompute-wrestler-stats-cache with x-cron-secret.
 */
export const handler = schedule("30 4,16 * * *", async () => {
  const base = (process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? "").replace(/\/$/, "");
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    console.warn("[recompute-wrestler-stats-cache] Missing URL/DEPLOY_PRIME_URL or CRON_SECRET — skipping");
    return { statusCode: 200, body: "skip" };
  }

  const url = `${base}/api/cron/recompute-wrestler-stats-cache`;
  const res = await fetch(url, { headers: { "x-cron-secret": secret } });
  const text = await res.text();
  console.log("[recompute-wrestler-stats-cache]", res.status, text.slice(0, 500));
  return { statusCode: res.ok ? 200 : res.status, body: text };
});

