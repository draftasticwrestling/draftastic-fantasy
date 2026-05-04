import type { MetadataRoute } from "next";
import { getSitePublicOrigin } from "@/lib/sitePublicOrigin";

export default function robots(): MetadataRoute.Robots {
  const origin = getSitePublicOrigin();
  return {
    rules: [
      {
        userAgent: "Mediapartners-Google",
        allow: "/",
        disallow: ["/api/", "/internal-admin", "/internal-admin/", "/auth/", "/account"],
      },
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/internal-admin",
          "/internal-admin/",
          "/api/",
          "/auth/",
          "/account",
          "/callback",
          "/constant-contact",
          "/constant-contact-callback",
          "/leagues",
        ],
      },
    ],
    sitemap: `${origin.replace(/\/$/, "")}/sitemap.xml`,
  };
}
