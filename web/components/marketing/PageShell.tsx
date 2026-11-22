import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BreadcrumbStructuredData } from "@/components/StructuredData";
import { FEATURES, GUIDES } from "@/lib/seo-content";

interface Crumb {
  name: string;
  path: string;
}

/** Layout for the public content pages: breadcrumbs, a readable column, footer links. */
export function PageShell({
  crumbs,
  children,
}: {
  crumbs: Crumb[];
  children: React.ReactNode;
}) {
  const all = [{ name: "Home", path: "/" }, ...crumbs];
  return (
    <div className="min-h-full px-4 sm:px-6 py-8 sm:py-12">
      <BreadcrumbStructuredData items={all} />
      <div className="max-w-3xl mx-auto">
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
            {all.map((c, i) => (
              <li key={c.path} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="w-3.5 h-3.5" aria-hidden />}
                {i < all.length - 1 ? (
                  <Link href={c.path} className="hover:text-indigo-600 dark:hover:text-indigo-400">
                    {c.name}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-slate-700 dark:text-slate-200">
                    {c.name}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
        {children}
        <SiteFooter />
      </div>
    </div>
  );
}

export function CtaButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-white font-medium shadow-sm transition-colors"
    >
      {children}
      <ChevronRight className="w-4 h-4" aria-hidden />
    </Link>
  );
}

/** Internal links to every public page, so crawlers can discover them all. */
function SiteFooter() {
  return (
    <footer className="mt-16 pt-8 border-t border-slate-200 dark:border-slate-700 grid gap-8 sm:grid-cols-2 text-sm">
      <div>
        <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">
          <Link href="/features" className="hover:text-indigo-600 dark:hover:text-indigo-400">Features</Link>
        </h2>
        <ul className="space-y-2">
          {FEATURES.map((f) => (
            <li key={f.slug}>
              <Link
                href={`/features/${f.slug}`}
                className="text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                {f.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">
          <Link href="/guides" className="hover:text-indigo-600 dark:hover:text-indigo-400">Career guides</Link>
        </h2>
        <ul className="space-y-2">
          {GUIDES.map((g) => (
            <li key={g.slug}>
              <Link
                href={`/guides/${g.slug}`}
                className="text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                {g.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <p className="sm:col-span-2 text-xs text-slate-500 dark:text-slate-400">
        <Link href="/privacy" className="hover:text-indigo-600 dark:hover:text-indigo-400">Privacy</Link>
        {" · "}
        <a href="https://github.com/zengtian006/NovusOrbit" className="hover:text-indigo-600 dark:hover:text-indigo-400">Open source on GitHub</a>
      </p>
    </footer>
  );
}
