import Link from "next/link";
import { FantasyHomeLink } from "@/app/components/FantasyHomeLink";
import HubLatestHeadlinesSection from "@/app/components/HubLatestHeadlinesSection";
import { siteLogoHref } from "@/lib/siteLogo";

/** Headlines pull from DB; avoid stale static shell after publish. */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Draftastic Pro Wrestling — Results & News",
  description: "Event results, fantasy scoring, and commentary — Draftastic Pro Wrestling.",
};

export default async function HubHomePage() {
  return (
    <>
      <section className="hub-hero">
        <div className="hub-hero-inner">
          <img src={siteLogoHref()} alt="" className="hub-hero-logo" />
          <div className="hub-hero-copy">
            <h1>Draftastic Fantasy Pro Wrestling</h1>
            <p className="hub-hero-tagline">Putting the sport back in sports entertainment.</p>
            <div className="hub-hero-actions">
              <Link href="/coming-soon" className="hub-hero-btn hub-hero-btn-primary">
                Join the list — get notified at launch
              </Link>
              <Link href="/how-it-works" className="hub-hero-btn hub-hero-btn-outline">
                See how it works
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="hub-shell-wrap">
        <div className="hub-shell">
          <aside className="hub-col hub-col-side" aria-label="Quick links">
            <h2 className="hub-col-title">Quick links</h2>
            <nav className="hub-quick-nav">
              <Link href="/event-results">Events</Link>
              <Link href="/wrestlers">Wrestlers</Link>
              <FantasyHomeLink>Fantasy home</FantasyHomeLink>
              <Link href="/how-it-works">Fantasy rules</Link>
            </nav>
          </aside>

          <HubLatestHeadlinesSection headlineVariant="hub" />
        </div>
      </div>
    </>
  );
}
