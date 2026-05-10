import Link from "next/link";
import { FantasyHomeLink } from "@/app/components/FantasyHomeLink";
import { AdsenseDisplayAd } from "@/app/components/AdsenseDisplayAd";
import HubLatestHeadlinesSection from "@/app/components/HubLatestHeadlinesSection";
import HubSiteLeaderboards from "@/app/components/HubSiteLeaderboards";
import FantasyHubHero from "@/app/components/FantasyHubHero";
import { getAdsenseSlotHubHome } from "@/lib/adsenseConfig";

/** Cache homepage shell and revalidate frequently to reduce SSR compute. */
export const revalidate = 120;

export const metadata = {
  title: "Draftastic Pro Wrestling — Results & News",
  description: "Event results, fantasy scoring, and commentary — Draftastic Pro Wrestling.",
};

/**
 * Do not treat `?code=` on `/` as Constant Contact OAuth. Supabase sign-in (Google, etc.) also returns
 * an authorization `code` when the redirect lands on the site root, and forwarding that to the
 * Constant Contact callback breaks normal login. Use redirect URIs that point to `/callback` or
 * `/constant-contact-callback` only (see docs/CONSTANT_CONTACT_SETUP.md).
 */
export default async function HubHomePage() {
  const adsSlotHub = getAdsenseSlotHubHome();

  return (
    <>
      <FantasyHubHero />

      <div className="hub-shell-wrap">
        <div className="hub-shell">
          <div className="hub-col hub-left-rail">
            <HubSiteLeaderboards />
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
