import { getSitePublicOrigin } from "@/lib/sitePublicOrigin";
import { SEO_DEFAULT_DESCRIPTION, SEO_SITE_NAME } from "@/lib/seoDefaults";

/**
 * Site-wide WebSite + Organization JSON-LD for Google (and other consumers).
 */
export function SeoSiteJsonLd() {
  const url = getSitePublicOrigin();
  const payload = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${url}/#website`,
        name: SEO_SITE_NAME,
        alternateName: ["Draftastic Fantasy Pro Wrestling", "Draftastic"],
        url,
        description: SEO_DEFAULT_DESCRIPTION,
        publisher: { "@id": `${url}/#organization` },
        inLanguage: "en-US",
      },
      {
        "@type": "Organization",
        "@id": `${url}/#organization`,
        name: SEO_SITE_NAME,
        alternateName: ["Draftastic Fantasy Pro Wrestling", "Draftastic"],
        url,
        description: SEO_DEFAULT_DESCRIPTION,
      },
      {
        "@type": "WebApplication",
        "@id": `${url}/#app`,
        name: "Draftastic Fantasy Pro Wrestling",
        url,
        applicationCategory: "GameApplication",
        operatingSystem: "Web",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        description:
          "Fantasy pro wrestling game where you draft real WWE and NXT wrestlers and score points from Raw, SmackDown, NXT, and premium live events.",
        publisher: { "@id": `${url}/#organization` },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
