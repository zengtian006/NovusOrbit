import type { Metadata } from "next";

/**
 * Public, canonical origin of the website (no trailing slash).
 *
 * Deliberately separate from NEXT_PUBLIC_API_BASE*: those point at the backend
 * (and are `http://localhost:8001` at Docker build time), which previously
 * leaked into canonical URLs, robots.txt and the sitemap.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.novusorbit.com"
).replace(/\/+$/, "");

export const SITE_NAME = "NovusOrbit";

export const DEFAULT_DESCRIPTION =
  "Free AI career assistant. Upload your CV once, then get interview questions with personalized answers, resume rewrites, ranked job matches from LinkedIn, Indeed, Glassdoor and more, and a job application tracker.";

/**
 * Social preview image (served by app/opengraph-image.tsx). Listed explicitly
 * because a page's own `openGraph` object replaces the inherited one, image included.
 */
export const OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "NovusOrbit: free AI career assistant",
};

export function absoluteUrl(path = "/"): string {
  return path === "/" ? SITE_URL : `${SITE_URL}${path}`;
}

interface PageMetaInput {
  title: string;
  description: string;
  path: string;
  /** Keep the page out of search results (private or login-only screens). */
  noindex?: boolean;
  /** Use the title verbatim instead of the "%s | NovusOrbit" template. */
  absoluteTitle?: boolean;
  type?: "website" | "article";
}

/** Metadata for one route: title, description, canonical URL and social cards. */
export function pageMetadata({
  title,
  description,
  path,
  noindex = false,
  absoluteTitle = false,
  type = "website",
}: PageMetaInput): Metadata {
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type,
      url: path,
      title,
      description,
      siteName: SITE_NAME,
      locale: "en_US",
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_IMAGE.url],
    },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}
