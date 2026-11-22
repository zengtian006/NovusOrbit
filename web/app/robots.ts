import { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Note: /_next/ must stay crawlable, or Google can't load the JS/CSS
        // it needs to render pages.
        disallow: ["/api/", "/admin/", "/settings", "/auth/", "/history"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
