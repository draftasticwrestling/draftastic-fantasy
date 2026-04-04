import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import HubLatestEventPreview from "@/app/components/HubLatestEventPreview";
import { fetchHubRecentCompleted, fetchHubUpcomingSpotlight } from "@/lib/home/hubHomeEvents";
import { listPublishedArticles } from "@/lib/articles";
import { siteLogoHref } from "@/lib/siteLogo";

/** Headlines pull from DB; avoid stale static shell after publish. */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Draftastic Pro Wrestling — Results & News",
  description: "Event results, fantasy scoring, and commentary — Draftastic Pro Wrestling.",
};

export default async function HubHomePage() {
  const supabase = await createClient();

  const [upcoming, { data: wrestlersData }] = await Promise.all([
    fetchHubUpcomingSpotlight(supabase),
    supabase.from("wrestlers").select("id, name, image_url"),
  ]);

  const completedRows = await fetchHubRecentCompleted(supabase, 4, upcoming?.id);
  const wrestlerRows = (wrestlersData ?? []) as { id: string; name: string | null; image_url: string | null }[];

  const hasAnyPreview = Boolean(upcoming) || completedRows.length > 0;

  const articles = await listPublishedArticles(5);
  const staticHeadlines = [
    { href: "/fantasy", label: "Play Draftastic Fantasy — create a league with friends" },
    { href: "/event-results", label: "Browse all completed events and fantasy scoring" },
  ];
  const headlines = [
    ...articles.map((a) => ({
      href: `/news/${encodeURIComponent(a.slug)}`,
      label: a.title,
    })),
    ...(articles.length === 0
      ? [{ href: "/news", label: "News — fantasy takes on the week in wrestling" }]
      : []),
    ...staticHeadlines,
  ].slice(0, 8);

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
              <Link href="/fantasy#how-it-works" className="hub-hero-btn hub-hero-btn-outline">
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
              <span className="hub-quick-muted">Statistics (soon)</span>
              <span className="hub-quick-muted">WrestleMania (soon)</span>
              <Link href="/fantasy">Fantasy home</Link>
              <Link href="/how-it-works">Fantasy rules</Link>
              <span className="hub-quick-muted">FantasyCast (soon)</span>
            </nav>
          </aside>

          <section className="hub-col hub-col-main" aria-labelledby="hub-latest-heading">
            <h2 id="hub-latest-heading" className="hub-col-title">
              Latest events
            </h2>
            {hasAnyPreview ? (
              <>
                <div className="hub-events-stack">
                  {upcoming ? (
                    <HubLatestEventPreview
                      event={upcoming}
                      wrestlerRows={wrestlerRows}
                      variant="upcoming"
                      whenLabel={upcoming.whenLabel}
                    />
                  ) : null}
                  {completedRows.map((ev) => (
                    <HubLatestEventPreview key={ev.id} event={ev} wrestlerRows={wrestlerRows} variant="completed" />
                  ))}
                </div>
                {completedRows.length === 0 && upcoming ? (
                  <p className="hub-muted" style={{ marginTop: 16 }}>
                    No completed events to show yet — check back after the show.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="hub-muted">No events yet. Check back after the next show.</p>
            )}
          </section>

          <aside className="hub-col hub-col-side" aria-label="Headlines">
            <h2 className="hub-col-title">Top headlines</h2>
            <ul className="hub-headlines">
              {headlines.map((h) => (
                <li key={h.href}>
                  <Link href={h.href}>{h.label}</Link>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </>
  );
}
