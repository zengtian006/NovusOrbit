import { MetadataRoute } from "next";
import { FEATURES, GUIDES } from "@/lib/seo-content";
import { absoluteUrl } from "@/lib/site";

// Bump when the public pages change meaningfully.
const SITE_UPDATED = "2026-11-22";

/**
 * Public, indexable pages only. Login-only tools (/interview, /job-suggest,
 * /resume-writer) and private screens (/history, /settings, /admin, /auth)
 * are left out; their /features/* pages are what should rank.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: SITE_UPDATED, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/features"), lastModified: SITE_UPDATED, changeFrequency: "monthly", priority: 0.9 },
    { url: absoluteUrl("/guides"), lastModified: SITE_UPDATED, changeFrequency: "weekly", priority: 0.8 },
    { url: absoluteUrl("/ask"), lastModified: SITE_UPDATED, changeFrequency: "monthly", priority: 0.6 },
    { url: absoluteUrl("/portfolio"), lastModified: SITE_UPDATED, changeFrequency: "monthly", priority: 0.6 },
    { url: absoluteUrl("/jobs"), lastModified: SITE_UPDATED, changeFrequency: "monthly", priority: 0.6 },
    { url: absoluteUrl("/privacy"), lastModified: SITE_UPDATED, changeFrequency: "yearly", priority: 0.3 },
  ];
  for (const f of FEATURES) {
    pages.push({
      url: absoluteUrl(`/features/${f.slug}`),
      lastModified: SITE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.8,
    });
  }
  for (const g of GUIDES) {
    pages.push({
      url: absoluteUrl(`/guides/${g.slug}`),
      lastModified: g.updated,
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }
  return pages;
}
