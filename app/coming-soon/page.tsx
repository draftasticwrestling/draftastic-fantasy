import HubLatestHeadlinesSection from "@/app/components/HubLatestHeadlinesSection";
import { MarketingLandingCopy } from "@/app/components/MarketingLandingCopy";

export const revalidate = 300;

export default async function ComingSoonPage() {
  return (
    <MarketingLandingCopy
      sidebar={<HubLatestHeadlinesSection headlineVariant="marketing" layout="marketing-rail" />}
    />
  );
}
