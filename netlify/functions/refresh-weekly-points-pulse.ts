import { schedule } from "@netlify/functions";

/**
 * Keep current-week fantasy points snapshots fresh for the hub FOMO pulse.
 * Every 3 hours UTC. Calls GET /api/cron/refresh-weekly-points-pulse with x-cron-secret.
 */
export const handler = schedule("0 */3 * * *", async () => {
  const base = (process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? "").replace(/\/$/, "");
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    console.warn("[refresh-weekly-points-pulse] Missing URL/DEPLOY_PRIME_URL or CRON_SECRET — skipping");
    return { statusCode: 200, body: "skip" };
  }

  const url = `${base}/api/cron/refresh-weekly-points-pulse`;
  const res = await fetch(url, { headers: { "x-cron-secret": secret } });
  const text = await res.text();
  console.log("[refresh-weekly-points-pulse]", res.status, text.slice(0, 500));
  return { statusCode: res.ok || res.status === 207 ? 200 : res.status, body: text };
});
