import { schedule } from "@netlify/functions";

/**
 * Daily league lifecycle maintenance (08:30 UTC, after finalize-league-placements):
 * - Archive completed seasons 2 weeks after end_date (once champion placement exists)
 * - Mark underfilled private leagues inactive after 2 weeks; archive after 4 weeks from creation
 *
 * Calls GET /api/cron/archive-completed-leagues with x-cron-secret.
 */
export const handler = schedule("30 8 * * *", async () => {
  const base = (process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? "").replace(/\/$/, "");
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    console.warn("[archive-completed-leagues] Missing URL/DEPLOY_PRIME_URL or CRON_SECRET — skipping");
    return { statusCode: 200, body: "skip" };
  }

  const url = `${base}/api/cron/archive-completed-leagues`;
  const res = await fetch(url, { headers: { "x-cron-secret": secret } });
  const text = await res.text();
  console.log("[archive-completed-leagues]", res.status, text.slice(0, 800));
  return { statusCode: res.ok || res.status === 207 ? 200 : res.status, body: text };
});
