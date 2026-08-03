import type { Metadata } from "next";
import Link from "next/link";
import SiteLeaderboardsClient from "@/app/components/SiteLeaderboardsClient";
import { getAdminClient } from "@/lib/supabase/admin";
import { getSiteLeaderboards, normalizeSiteLeaderboardWeekStart } from "@/lib/siteLeaderboards";
import { getCurrentWeekStartMondayPst } from "@/lib/weeklyLeaderboards";
import {
  SEO_DEFAULT_OG_IMAGE_PATH,
  SEO_SITE_NAME,
} from "@/lib/seoDefaults";
import { absoluteUrl } from "@/lib/sitePublicOrigin";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "Leaderboards",
  description:
    "Browse Draftastic fantasy leaderboards by league type: public, private, Total Season Points, Head to Head, Salary Cap, and Main Roster vs NXT.",
  alternates: { canonical: absoluteUrl("/leaderboards") },
  openGraph: {
    title: `Leaderboards — ${SEO_SITE_NAME}`,
    description: "Apples-to-apples fantasy leaderboards across league formats.",
    url: absoluteUrl("/leaderboards"),
    type: "website",
    siteName: SEO_SITE_NAME,
    images: [{ url: SEO_DEFAULT_OG_IMAGE_PATH, alt: `${SEO_SITE_NAME} leaderboards` }],
  },
};

export default async function LeaderboardsPage({
  searchParams,
}: {
  searchParams?: Promise<{ leaderboard_week?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const admin = getAdminClient();

  if (!admin) {
    return (
      <main className="app-page site-leaderboards-page">
        <p className="site-leaderboards-crumb">
          <Link href="/" className="app-link">
            ← Home
          </Link>
        </p>
        <header className="site-leaderboards-hero">
          <p className="site-leaderboards-hero-eyebrow">Draftastic Fantasy</p>
          <h1 className="site-leaderboards-hero-title">Leaderboards</h1>
        </header>
        <p className="site-leaderboards-unavailable">Leaderboards are not available right now.</p>
      </main>
    );
  }

  const currentMonday = getCurrentWeekStartMondayPst();
  const selected = normalizeSiteLeaderboardWeekStart(sp.leaderboard_week ?? null, currentMonday);
  const initial = await getSiteLeaderboards({ leaderboardWeek: selected });

  return (
    <main className="app-page site-leaderboards-page">
      <p className="site-leaderboards-crumb">
        <Link href="/" className="app-link">
          ← Home
        </Link>
      </p>
      <header className="site-leaderboards-hero">
        <p className="site-leaderboards-hero-eyebrow">Draftastic Fantasy</p>
        <h1 className="site-leaderboards-hero-title">Leaderboards</h1>
        <p className="site-leaderboards-hero-desc">
          Site-wide XP leaders sit at the top. Below, compare fantasy scores within the same kind of league — public vs
          private, format, and whether NXT is in the pool. Fantasy rankings use each manager&apos;s best single league in
          that category.
        </p>
      </header>
      {!initial.siteLeaderboardsAvailable ? (
        <p className="site-leaderboards-unavailable">Leaderboards are not available right now.</p>
      ) : (
        <SiteLeaderboardsClient initial={initial} />
      )}
    </main>
  );
}
