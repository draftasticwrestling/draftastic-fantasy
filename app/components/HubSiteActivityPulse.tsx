import { SiteActivityPulseBlock } from "@/app/components/SiteActivityPulseBlock";
import { getSiteActivityPulse, SITE_ACTIVITY_PULSE_ITEMS } from "@/lib/siteActivityPulse";

/** Compact live-activity card for the hub home left rail (above leaderboards). */
export default async function HubSiteActivityPulse() {
  const pulse = await getSiteActivityPulse();
  const hasActivity = SITE_ACTIVITY_PULSE_ITEMS.some(({ key }) => pulse[key] > 0);

  if (!hasActivity) {
    return null;
  }

  return (
    <section className="hub-col-side hub-site-pulse-card" aria-label="Live fantasy activity">
      <SiteActivityPulseBlock pulse={pulse} variant="hub-rail" showCta />
    </section>
  );
}
