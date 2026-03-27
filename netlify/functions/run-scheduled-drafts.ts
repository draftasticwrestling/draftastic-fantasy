/**
 * Netlify function: calls the app's cron API to start autopick drafts whose scheduled
 * time has passed (order generation + kicking off due drafts).
 *
 * Scheduled runs are OFF while no leagues use scheduled drafts — avoids 15‑minute
 * invocations. Re-enable: export config with schedule every 15 minutes (cron: star/15 * * * *).
 * and `import type { Config } from "@netlify/functions"`.
 *
 * Manual run: Netlify Dashboard → Functions → run-scheduled-drafts, or any GET to
 * `/api/cron/run-scheduled-drafts` with `x-cron-secret: <CRON_SECRET>`.
 *
 * Set CRON_SECRET in Netlify env; URL from Netlify as URL / SITE_URL.
 *
 * @see https://docs.netlify.com/build/functions/scheduled-functions/
 */

export default async (req: Request) => {
  const secret = process.env.CRON_SECRET;
  const baseUrl = process.env.URL || process.env.SITE_URL;
  if (!secret || !baseUrl) {
    console.error("run-scheduled-drafts: CRON_SECRET or URL not set");
    return;
  }
  const url = `${baseUrl.replace(/\/$/, "")}/api/cron/run-scheduled-drafts`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "x-cron-secret": secret },
    });
    if (!res.ok) {
      console.error("run-scheduled-drafts:", res.status, await res.text());
      return;
    }
    const data = (await res.json()) as { ran?: number; due?: number; errors?: string[] };
    if (data.ran !== undefined && data.ran > 0) {
      console.log("run-scheduled-drafts: ran", data.ran, "draft(s)");
    }
    if (data.errors?.length) {
      console.error("run-scheduled-drafts errors:", data.errors);
    }
  } catch (err) {
    console.error("run-scheduled-drafts fetch failed:", err);
  }
};
