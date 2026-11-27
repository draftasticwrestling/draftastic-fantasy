import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { FantasyHomeLink } from "@/app/components/FantasyHomeLink";
import { AdsenseDisplayAd } from "@/app/components/AdsenseDisplayAd";
import HubLatestHeadlinesSection from "@/app/components/HubLatestHeadlinesSection";
import HubSiteActivityPulse from "@/app/components/HubSiteActivityPulse";
import HubSiteLeaderboards from "@/app/components/HubSiteLeaderboards";
import HubRtssChampions from "@/app/components/HubRtssChampions";
import FantasyHubHero from "@/app/components/FantasyHubHero";
import BreakingNewsBanner from "@/app/components/BreakingNewsBanner";
import { getAdsenseSlotHubHome } from "@/lib/adsenseConfig";
import { getActiveBreakingNews } from "@/lib/breakingNews";
import {
  SEO_DEFAULT_KEYWORDS,
  SEO_DEFAULT_OG_IMAGE_PATH,
  SEO_SITE_NAME,
} from "@/lib/seoDefaults";
import { absoluteUrl } from "@/lib/sitePublicOrigin";

/** Cache homepage shell and revalidate frequently to reduce SSR compute. */
export const revalidate = 120;

const homeTitle = "Fantasy Pro Wrestling";
const homeDescription =
  "Play fantasy pro wrestling on Draftastic. Draft real WWE and NXT wrestlers, score Raw, SmackDown, and premium live events, and compete in leagues.";

export const metadata: Metadata = {
  title: { absolute: `${homeTitle} — Draftastic` },
  description: homeDescription,
  keywords: [...SEO_DEFAULT_KEYWORDS, "wrestling news", "WWE results", "NXT results"],
  alternates: { canonical: absoluteUrl("/") },
  openGraph: {
    title: `${homeTitle} — Draftastic`,
    description: homeDescription,
    url: absoluteUrl("/"),
    type: "website",
    siteName: SEO_SITE_NAME,
    images: [{ url: SEO_DEFAULT_OG_IMAGE_PATH, alt: "Draftastic fantasy pro wrestling" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${homeTitle} — Draftastic`,
    description: homeDescription,
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
  const breakingNews = await getActiveBreakingNews();

  return (
    <>
      <FantasyHubHero />
      <BreakingNewsBanner items={breakingNews} />

      <div className="hub-shell-wrap">
        <div className="hub-shell">
          <div className="hub-col hub-left-rail">
            <Suspense fallback={null}>
              <HubSiteActivityPulse />
            </Suspense>
            <Suspense fallback={null}>
              <HubRtssChampions />
            </Suspense>
            <Suspense fallback={null}>
              <HubSiteLeaderboards leaderboardWeek={sp.leaderboard_week ?? null} />
            </Suspense>
            <aside className="hub-col-side hub-quick-links-card" aria-label="Quick links">
              <h2 className="hub-col-title">Quick links</h2>
              <nav className="hub-quick-nav">
                <Link href="/event-results">Events</Link>
                <Link href="/wrestlers">Wrestlers</Link>
                <Link href="/leaderboards">Leaderboards</Link>
                <FantasyHomeLink>Fantasy pro wrestling</FantasyHomeLink>
                <Link href="/how-it-works">Fantasy rules</Link>
              </nav>
            </aside>
          </div>

          <Suspense fallback={null}>
            <HubLatestHeadlinesSection headlineVariant="hub" />
          </Suspense>
        </div>
      </div>

      <AdsenseDisplayAd slot={adsSlotHub} className="hub-adsense-slot" />
    </>
  );
}
