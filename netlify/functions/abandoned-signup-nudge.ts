import { schedule } from "@netlify/functions";

/**
 * Sends a one-time "you were almost there" email to users who signed up but never joined a league.
 * Requires CRON_SECRET and URL in env.
 */
export const handler = schedule("0 17 * * *", async () => {
  const base = (process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? "").replace(/\/$/, "");
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    console.warn("[abandoned-signup-nudge] Missing URL/DEPLOY_PRIME_URL or CRON_SECRET — skipping");
    return { statusCode: 200, body: "skip" };
  }

  const url = `${base}/api/cron/abandoned-signup-nudge`;
  const res = await fetch(url, { headers: { "x-cron-secret": secret } });
  const text = await res.text();
  console.log("[abandoned-signup-nudge]", res.status, text.slice(0, 500));

  return { statusCode: res.ok ? 200 : res.status, body: text };
});
