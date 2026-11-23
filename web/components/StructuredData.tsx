import { SITE_NAME, SITE_URL, DEFAULT_DESCRIPTION, absoluteUrl } from "@/lib/site";
import type { Faq } from "@/lib/seo-content";

/**
 * JSON-LD structured data, rendered on the server as a plain <script> tag so
 * it's in the initial HTML that crawlers fetch.
 * https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // Escape "<" so content can never close the script tag early.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export function OrganizationStructuredData() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/logo.png`,
        description: DEFAULT_DESCRIPTION,
      }}
    />
  );
}

export function WebSiteStructuredData() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: SITE_URL,
        publisher: { "@id": `${SITE_URL}/#organization` },
        inLanguage: ["en", "zh"],
      }}
    />
  );
}

export function WebApplicationStructuredData() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: SITE_NAME,
        url: SITE_URL,
        description: DEFAULT_DESCRIPTION,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web browser",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        featureList: [
          "AI interview preparation with personalized answers",
          "AI resume writer with Markdown and PDF export",
          "AI job matching from LinkedIn, Indeed, Glassdoor and company career sites",
          "Job application tracker",
          "AI career chat grounded in your CV",
        ],
      }}
    />
  );
}

export function BreadcrumbStructuredData({
  items,
}: {
  items: Array<{ name: string; path: string }>;
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: absoluteUrl(item.path),
        })),
      }}
    />
  );
}

export function FaqStructuredData({ faqs }: { faqs: Faq[] }) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }}
    />
  );
}
