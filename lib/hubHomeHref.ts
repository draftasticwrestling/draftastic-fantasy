import { headers } from "next/headers";

import {
  DEFAULT_APP_HUB_ORIGIN,
  DRAFTASTIC_MARKETING_LANDING_DOMAIN,
} from "@/lib/siteDomains";

/**
 * Href for “Site home” / results hub. On the marketing custom domain, `/` is the coming-soon landing,
 * so this points to the main app origin (Netlify by default, or NEXT_PUBLIC_APP_HUB_ORIGIN).
 */
export async function getHubHomeHref(): Promise<string> {
  const host = (await headers()).get("host") ?? "";
  if (!host.toLowerCase().includes(DRAFTASTIC_MARKETING_LANDING_DOMAIN)) {
    return "/";
  }
  const configured = process.env.NEXT_PUBLIC_APP_HUB_ORIGIN?.trim();
  const base = (configured || DEFAULT_APP_HUB_ORIGIN).replace(/\/$/, "");
  return base || DEFAULT_APP_HUB_ORIGIN;
}
