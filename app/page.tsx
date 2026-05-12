import type { Metadata } from "next";
import Link from "next/link";
import { FantasyHomeLink } from "@/app/components/FantasyHomeLink";
import { AdsenseDisplayAd } from "@/app/components/AdsenseDisplayAd";
import HubLatestHeadlinesSection from "@/app/components/HubLatestHeadlinesSection";
import HubSiteLeaderboards from "@/app/components/HubSiteLeaderboards";
import FantasyHubHero from "@/app/components/FantasyHubHero";
import { getAdsenseSlotHubHome } from "@/lib/adsenseConfig";
import {
  SEO_DEFAULT_DESCRIPTION,
  SEO_DEFAULT_KEYWORDS,
  SEO_DEFAULT_OG_IMAGE_PATH,
  SEO_SITE_NAME,
} from "@/lib/seoDefaults";
import { absoluteUrl } from "@/lib/sitePublicOrigin";

/** Cache homepage shell and revalidate frequently to reduce SSR compute. */
export const revalidate = 120;

const homeTitle = "Results, fantasy leagues & news";

export const metadata: Metadata = {
  title: { absolute: `${SEO_SITE_NAME} — ${homeTitle}` },
  description: SEO_DEFAULT_DESCRIPTION,
  keywords: [...SEO_DEFAULT_KEYWORDS, "wrestling news", "WWE results", "NXT results"],
  alternates: { canonical: absoluteUrl("/") },
  openGraph: {
    title: `${SEO_SITE_NAME} — ${homeTitle}`,
    description: SEO_DEFAULT_DESCRIPTION,
    url: absoluteUrl("/"),
    type: "website",
    siteName: SEO_SITE_NAME,
    images: [{ url: SEO_DEFAULT_OG_IMAGE_PATH, alt: `${SEO_SITE_NAME} hub` }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SEO_SITE_NAME} — ${homeTitle}`,
    description: SEO_DEFAULT_DESCRIPTION,
    images: [SEO_DEFAULT_OG_IMAGE_PATH],
  },
};

/**
 * Do not treat `?code=` on `/` as Constant Contact OAuth. Supabase sign-in (Google, etc.) also returns
 * an authorization `code` when the redirect lands on the site root, and forwarding that to the
 * Constant Contact callback breaks normal login. Use redirect URIs that point to `/callback` or
 * `/constant-contact-callback` only (see docs/CONSTANT_CONTACT_SETUP.md).
 */
export default async function HubHomePage({
  searchParams,
}: {
  searchParams?: Promise<{ leaderboard_week?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const adsSlotHub = getAdsenseSlotHubHome();

  return (
    <>
      <FantasyHubHero />

      <div className="hub-shell-wrap">
        <div className="hub-shell">
          <div className="hub-col hub-left-rail">
            <HubSiteLeaderboards leaderboardWeek={sp.leaderboard_week ?? null} />
            <aside className="hub-col-side" aria-label="Quick links">
              <h2 className="hub-col-title">Quick links</h2>
              <nav className="hub-quick-nav">
                <Link href="/event-results">Events</Link>
                <Link href="/wrestlers">Wrestlers</Link>
                <FantasyHomeLink>Fantasy home</FantasyHomeLink>
                <Link href="/how-it-works">Fantasy rules</Link>
              </nav>
            </aside>
          </div>

          <HubLatestHeadlinesSection headlineVariant="hub" />
        </div>
      </div>

      <AdsenseDisplayAd slot={adsSlotHub} className="hub-adsense-slot" />
    </>
  );
}
