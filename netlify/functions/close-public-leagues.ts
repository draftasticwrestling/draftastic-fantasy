import { schedule } from "@netlify/functions";

/**
 * Closes public leagues when Monday RAW registration ends (5 PM PT).
 * Requires CRON_SECRET and URL in env.
 */
export const handler = schedule("*/15 * * * *", async () => {
  const base = (process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? "").replace(/\/$/, "");
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    console.warn("[close-public-leagues] Missing URL/DEPLOY_PRIME_URL or CRON_SECRET — skipping");
    return { statusCode: 200, body: "skip" };
  }

  const url = `${base}/api/cron/close-public-leagues`;
  const res = await fetch(url, { headers: { "x-cron-secret": secret } });
  const text = await res.text();
  console.log("[close-public-leagues]", res.status, text.slice(0, 500));

  return { statusCode: res.ok ? 200 : res.status, body: text };
});
