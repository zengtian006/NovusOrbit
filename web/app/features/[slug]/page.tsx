import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { PageShell, CtaButton } from "@/components/marketing/PageShell";
import { FaqSection } from "@/components/marketing/FaqSection";
import { FaqStructuredData } from "@/components/StructuredData";
import { FEATURES, getFeature, getGuide } from "@/lib/seo-content";
import { pageMetadata } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return FEATURES.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({ params }: Props) {
  const feature = getFeature((await params).slug);
  if (!feature) return {};
  return pageMetadata({
    title: feature.metaTitle,
    description: feature.metaDescription,
    path: `/features/${feature.slug}`,
  });
}

export default async function FeaturePage({ params }: Props) {
  const feature = getFeature((await params).slug);
  if (!feature) notFound();

  const guides = feature.relatedGuides.map(getGuide).filter((g) => g !== undefined);
  const others = FEATURES.filter((f) => f.slug !== feature.slug);

  return (
    <PageShell
      crumbs={[
        { name: "Features", path: "/features" },
        { name: feature.name, path: `/features/${feature.slug}` },
      ]}
    >
      <FaqStructuredData faqs={feature.faqs} />

      <header className="mb-10">
        <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mb-2">{feature.name}</p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-4">
          {feature.h1}
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-300 mb-6">{feature.intro}</p>
        <div className="flex flex-wrap items-center gap-3">
          <CtaButton href={feature.appPath}>{feature.appLabel}</CtaButton>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Free{feature.requiresSignIn ? " · Sign in with Google" : ""}
          </span>
        </div>
      </header>

      <section aria-labelledby="how" className="mb-12">
        <h2 id="how" className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-4">How it works</h2>
        <ol className="space-y-4">
          {feature.steps.map((s, i) => (
            <li key={s.title} className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-semibold flex items-center justify-center">
                {i + 1}
              </span>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">{s.title}</h3>
                <p className="text-slate-600 dark:text-slate-300">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="why" className="mb-12">
        <h2 id="why" className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Why use NovusOrbit for this
        </h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {feature.benefits.map((b) => (
            <li key={b.title} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mb-2" aria-hidden />
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">{b.title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">{b.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="mb-12">
        <FaqSection faqs={feature.faqs} />
      </div>

      {guides.length > 0 && (
        <section aria-labelledby="guides" className="mb-10">
          <h2 id="guides" className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-3">Related guides</h2>
          <ul className="space-y-2">
            {guides.map((g) => (
              <li key={g.slug}>
                <Link href={`/guides/${g.slug}`} className="text-indigo-600 dark:text-indigo-400 hover:underline">
                  {g.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="more">
        <h2 id="more" className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-3">More tools</h2>
        <ul className="flex flex-wrap gap-2">
          {others.map((f) => (
            <li key={f.slug}>
              <Link
                href={`/features/${f.slug}`}
                className="inline-block rounded-full border border-slate-200 dark:border-slate-700 px-3 py-1 text-sm text-slate-700 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                {f.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  );
}
