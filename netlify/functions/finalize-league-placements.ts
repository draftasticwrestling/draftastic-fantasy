import { schedule } from "@netlify/functions";

/**
 * Daily champion finalization after Pacific midnight.
 * Schedule: 08:15 UTC ≈ 00:15 PT (PDT) / 01:15 PT (PST) — after end-of-day
 * gates flip so leagues whose season ended yesterday get placements + XP.
 *
 * Calls GET /api/cron/finalize-league-placements with x-cron-secret.
 */
export const handler = schedule("15 8 * * *", async () => {
  const base = (process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? "").replace(/\/$/, "");
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    console.warn("[finalize-league-placements] Missing URL/DEPLOY_PRIME_URL or CRON_SECRET — skipping");
    return { statusCode: 200, body: "skip" };
  }

  const url = `${base}/api/cron/finalize-league-placements`;
  const res = await fetch(url, { headers: { "x-cron-secret": secret } });
  const text = await res.text();
  console.log("[finalize-league-placements]", res.status, text.slice(0, 800));
  return { statusCode: res.ok || res.status === 207 ? 200 : res.status, body: text };
});
