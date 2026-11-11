import { schedule } from "@netlify/functions";

/**
 * First of the month, 08:15 UTC.
 * That is 00:15 Pacific Standard Time and 01:15 Pacific Daylight Time, still the 1st in Los Angeles.
 *
 * Calls GET /api/cron/refresh-salary-cap-prices with x-cron-secret.
 */
export const handler = schedule("15 8 1 * *", async () => {
  const base = (process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? "").replace(/\/$/, "");
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    console.warn("[refresh-salary-cap-prices] Missing URL/DEPLOY_PRIME_URL or CRON_SECRET — skipping");
    return { statusCode: 200, body: "skip" };
  }

  const url = `${base}/api/cron/refresh-salary-cap-prices`;
  const res = await fetch(url, { headers: { "x-cron-secret": secret } });
  const text = await res.text();
  console.log("[refresh-salary-cap-prices]", res.status, text.slice(0, 800));
  return { statusCode: res.ok ? 200 : res.status, body: text };
});
