/**
 * Netlify Scheduled Function: runs every 10 minutes (UTC) and triggers the app's
 * cron API to start any autopick drafts whose scheduled time has passed.
 *
 * Set CRON_SECRET in Netlify env and ensure it matches the value used by the API route.
 * The site URL is provided by Netlify as URL (e.g. https://your-site.netlify.app).
 *
 * @see https://docs.netlify.com/build/functions/scheduled-functions/
 */

import type { Config } from "@netlify/functions";

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

export const config: Config = {
  schedule: "*/10 * * * *", // Every 10 minutes (UTC)
};
