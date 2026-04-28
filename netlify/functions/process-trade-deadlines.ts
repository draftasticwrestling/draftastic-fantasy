import { schedule } from "@netlify/functions";

/**
 * Calls the Next.js API route that expires stale pending trades and auto-executes
 * trades awaiting GM approval after 48h. Requires CRON_SECRET and URL in env.
 */
// Hourly is sufficient for 48h trade windows; cuts baseline scheduled compute by ~75%.
export const handler = schedule("0 * * * *", async () => {
  const base = (process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? "").replace(/\/$/, "");
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    console.warn("[process-trade-deadlines] Missing URL/DEPLOY_PRIME_URL or CRON_SECRET — skipping");
    return { statusCode: 200, body: "skip" };
  }

  const url = `${base}/api/cron/process-trades`;
  const res = await fetch(url, { headers: { "x-cron-secret": secret } });
  const text = await res.text();
  console.log("[process-trade-deadlines]", res.status, text.slice(0, 500));

  return { statusCode: res.ok ? 200 : res.status, body: text };
});
