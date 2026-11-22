import Link from "next/link";
import { PageShell } from "@/components/marketing/PageShell";
import { GUIDES } from "@/lib/seo-content";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Career Guides: Resumes, Interviews and Job Search",
  description:
    "Practical, step-by-step career guides: tailor your resume to a job description, answer interview questions with the STAR method, prepare for interviews and track applications.",
  path: "/guides",
});

export default function GuidesPage() {
  return (
    <PageShell crumbs={[{ name: "Guides", path: "/guides" }]}>
      <header className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-4">
          Career guides
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-300">
          Practical advice for each step of a job search, from your resume to the final interview.
        </p>
      </header>
      <ul className="space-y-4">
        {GUIDES.map((g) => (
          <li key={g.slug}>
            <Link
              href={`/guides/${g.slug}`}
              className="block rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-sm transition"
            >
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">{g.title}</h2>
              <p className="text-slate-600 dark:text-slate-400 mb-2">{g.metaDescription}</p>
              <p className="text-sm text-slate-500 dark:text-slate-500">{g.readingMinutes} min read</p>
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
