import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell, CtaButton } from "@/components/marketing/PageShell";
import { JsonLd } from "@/components/StructuredData";
import { GUIDES, getFeature, getGuide } from "@/lib/seo-content";
import { SITE_NAME, SITE_URL, absoluteUrl, pageMetadata } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: Props) {
  const guide = getGuide((await params).slug);
  if (!guide) return {};
  const meta = pageMetadata({
    title: guide.title,
    description: guide.metaDescription,
    path: `/guides/${guide.slug}`,
    type: "article",
  });
  return {
    ...meta,
    openGraph: {
      ...meta.openGraph,
      type: "article" as const,
      publishedTime: guide.published,
      modifiedTime: guide.updated,
    },
  };
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function GuidePage({ params }: Props) {
  const guide = getGuide((await params).slug);
  if (!guide) notFound();
  const feature = getFeature(guide.relatedFeature);
  const path = `/guides/${guide.slug}`;
  const more = GUIDES.filter((g) => g.slug !== guide.slug);

  return (
    <PageShell
      crumbs={[
        { name: "Guides", path: "/guides" },
        { name: guide.title, path },
      ]}
    >
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: guide.title,
          description: guide.metaDescription,
          datePublished: guide.published,
          dateModified: guide.updated,
          mainEntityOfPage: absoluteUrl(path),
          image: `${SITE_URL}/opengraph-image`,
          author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
          publisher: { "@id": `${SITE_URL}/#organization` },
        }}
      />
      <article>
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-3">
            {guide.title}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Updated <time dateTime={guide.updated}>{formatDate(guide.updated)}</time> · {guide.readingMinutes} min read
          </p>
          <p className="text-lg text-slate-700 dark:text-slate-300">{guide.summary}</p>
        </header>

        <div className="space-y-8 text-slate-700 dark:text-slate-300 leading-relaxed">
          {guide.sections.map((s) => (
            <section key={s.heading}>
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-3">{s.heading}</h2>
              {s.paragraphs?.map((p) => (
                <p key={p} className="mb-3">{p}</p>
              ))}
              {s.bullets && (
                <ul className="list-disc pl-5 space-y-2">
                  {s.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </article>

      {feature && (
        <aside className="mt-10 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Try {feature.name} free</h2>
          <p className="text-slate-600 dark:text-slate-300 mb-4">{feature.metaDescription}</p>
          <div className="flex flex-wrap items-center gap-4">
            <CtaButton href={feature.appPath}>{feature.appLabel}</CtaButton>
            <Link href={`/features/${feature.slug}`} className="text-indigo-600 dark:text-indigo-400 hover:underline">
              How it works
            </Link>
          </div>
        </aside>
      )}

      <section aria-labelledby="more-guides" className="mt-10">
        <h2 id="more-guides" className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-3">More guides</h2>
        <ul className="space-y-2">
          {more.map((g) => (
            <li key={g.slug}>
              <Link href={`/guides/${g.slug}`} className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {g.title}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  );
}
