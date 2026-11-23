import Link from "next/link";
import { BriefcaseBusiness, FileText, MessageSquare, Search, Sparkles } from "lucide-react";
import { PageShell, CtaButton } from "@/components/marketing/PageShell";
import { FaqStructuredData } from "@/components/StructuredData";
import { FaqSection } from "@/components/marketing/FaqSection";
import { FEATURES, type Faq } from "@/lib/seo-content";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Features: AI Interview Prep, Resume Writer, Job Matching and Tracker",
  description:
    "Everything NovusOrbit does: AI interview questions and answers from your CV, an AI resume writer, ranked job matches from LinkedIn, Indeed, Glassdoor and more, and a free job application tracker.",
  path: "/features",
});

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "ai-interview-prep": MessageSquare,
  "ai-resume-writer": FileText,
  "ai-job-matching": Search,
  "job-application-tracker": BriefcaseBusiness,
  "ai-career-coach": Sparkles,
};

const FAQS: Faq[] = [
  {
    q: "What is NovusOrbit?",
    a: "NovusOrbit is a free AI career assistant. You upload your CV once, and every tool (interview prep, resume writing, job matching and career chat) uses it to give advice specific to you.",
  },
  {
    q: "Is NovusOrbit free?",
    a: "Yes. Some tools require signing in with Google so your portfolio and sessions are saved to your account.",
  },
  {
    q: "How does NovusOrbit personalize its answers?",
    a: "Documents you upload to My Portfolio are indexed. When you use a tool, the AI retrieves the relevant parts of your own experience and uses them in its answer.",
  },
  {
    q: "Which languages does NovusOrbit support?",
    a: "The interface is available in English and Chinese.",
  },
];

export default function FeaturesPage() {
  return (
    <PageShell crumbs={[{ name: "Features", path: "/features" }]}>
      <FaqStructuredData faqs={FAQS} />
      <header className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-4">
          A free AI career assistant that starts from your CV
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-300 mb-6">
          Upload your CV once. NovusOrbit then prepares you for interviews, rewrites your resume, finds jobs
          that fit and keeps your applications organized, all using your real experience instead of generic advice.
        </p>
        <CtaButton href="/portfolio">Upload your CV to start</CtaButton>
      </header>

      <section aria-labelledby="tools" className="mb-12">
        <h2 id="tools" className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-4">Tools</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => {
            const Icon = ICONS[f.slug] ?? Sparkles;
            return (
              <Link
                key={f.slug}
                href={`/features/${f.slug}`}
                className="block rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-sm transition"
              >
                <Icon className="w-6 h-6 text-indigo-600 dark:text-indigo-400 mb-3" />
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">{f.name}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">{f.metaDescription}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="how" className="mb-12">
        <h2 id="how" className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-4">How it works</h2>
        <ol className="space-y-3 list-decimal pl-5 text-slate-700 dark:text-slate-300">
          <li><strong>Build your portfolio.</strong> Upload your CV, cover letters and certificates.</li>
          <li><strong>Find and save jobs.</strong> Get ranked matches from LinkedIn, Indeed, Glassdoor and company career sites, or add jobs you found yourself.</li>
          <li><strong>Tailor and prepare.</strong> Rewrite your resume for the role and practice interview questions with answers drawn from your experience.</li>
          <li><strong>Track progress.</strong> Move each application from interested to offered.</li>
        </ol>
      </section>

      <FaqSection faqs={FAQS} />
    </PageShell>
  );
}
