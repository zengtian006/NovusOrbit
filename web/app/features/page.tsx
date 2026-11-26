import Link from "next/link";
import {
  ArrowRight,
  BookmarkCheck,
  Check,
  Compass,
  FileText,
  Github,
  Lock,
  Mic,
  ShieldCheck,
  Sparkles,
  Upload,
  Wand2,
} from "lucide-react";
import { PageShell } from "@/components/marketing/PageShell";
import { FaqStructuredData } from "@/components/StructuredData";
import { FaqSection } from "@/components/marketing/FaqSection";
import { FEATURES, type Faq, type Feature } from "@/lib/seo-content";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Features: AI Interview Prep, Resume Writer, Job Matching and Tracker",
  description:
    "Everything NovusOrbit does: AI interview questions and answers from your CV, an AI resume writer that tailors to any job, ranked job matches from LinkedIn, Indeed, Glassdoor and more, and a free job application tracker.",
  path: "/features",
});

type Icon = React.ComponentType<{ className?: string }>;

/** Presentation for each tool, in the order of the job search. */
const TOOLS: { slug: string; icon: Icon; stage: string; tagline: string; accent: string }[] = [
  {
    slug: "ai-career-coach",
    stage: "Ask",
    icon: Sparkles,
    tagline: "Ask anything about your career and get answers based on your own CV.",
    accent: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",
  },
  {
    slug: "ai-job-matching",
    stage: "Find",
    icon: Compass,
    tagline: "Live openings from LinkedIn, Indeed, Glassdoor and more, ranked by fit with your CV.",
    accent: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
  },
  {
    slug: "job-application-tracker",
    stage: "Track",
    icon: BookmarkCheck,
    tagline: "Save jobs and move each one from interested to offered.",
    accent: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  {
    slug: "tailor-resume-to-job-description",
    stage: "Tailor",
    icon: Wand2,
    tagline: "One click rewrites your resume around a saved job, using only your real facts.",
    accent: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
  },
  {
    slug: "ai-resume-writer",
    stage: "Write",
    icon: FileText,
    tagline: "Select any line to rewrite, tighten or expand it, then export to PDF.",
    accent: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  },
  {
    slug: "ai-interview-prep",
    stage: "Prepare",
    icon: Mic,
    tagline: "Likely questions for the job, with answers drawn from your experience.",
    accent: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
  },
];

const STEPS: { icon: Icon; title: string; body: string }[] = [
  { icon: Upload, title: "Upload your CV", body: "Once. Every tool reads it, so advice is about you, not anyone." },
  { icon: Compass, title: "Find and save jobs", body: "Get ranked matches or add roles you found yourself." },
  { icon: Wand2, title: "Tailor your resume", body: "Rewrite it for each job in seconds, without inventing anything." },
  { icon: Mic, title: "Prepare to interview", body: "Practise the questions that role is likely to ask." },
];

const WHY: { icon: Icon; title: string; body: string }[] = [
  {
    icon: Sparkles,
    title: "Built on your experience",
    body: "Your CV is indexed once, and every answer, rewrite and match draws on what you actually did.",
  },
  {
    icon: ShieldCheck,
    title: "Never invents facts",
    body: "Rewrites change emphasis and wording, not your history. You can defend every line in an interview.",
  },
  {
    icon: Github,
    title: "Free and open source",
    body: "No paywall and no credit card. The code is public on GitHub.",
  },
];

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
];

const featureBySlug = new Map(FEATURES.map((f) => [f.slug, f]));

function PrimaryCta({ children }: { children: React.ReactNode }) {
  return (
    <Link
      href="/portfolio"
      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-3 text-white font-semibold shadow-sm shadow-indigo-600/20 transition-colors"
    >
      {children}
      <ArrowRight className="w-4 h-4" aria-hidden />
    </Link>
  );
}

function ToolCard({ feature, tool }: { feature: Feature; tool: (typeof TOOLS)[number] }) {
  const Icon = tool.icon;
  return (
    <Link
      href={`/features/${feature.slug}`}
      className="group relative flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 transition-all hover:-translate-y-0.5 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-lg hover:shadow-slate-200/60 dark:hover:shadow-none"
    >
      <div className="flex items-start justify-between mb-5">
        <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${tool.accent}`}>
          <Icon className="w-5 h-5" />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {tool.stage}
        </span>
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{feature.name}</h3>
      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400 flex-1">{tool.tagline}</p>
      <div className="mt-5 flex items-center justify-between text-sm">
        <span className="inline-flex items-center gap-1 font-medium text-indigo-600 dark:text-indigo-400">
          Learn more
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
        {feature.requiresSignIn && (
          <span className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
            <Lock className="w-3 h-3" aria-hidden />
            Google sign-in
          </span>
        )}
      </div>
    </Link>
  );
}

export default function FeaturesPage() {
  const tools = TOOLS.flatMap((tool) => {
    const feature = featureBySlug.get(tool.slug);
    return feature ? [{ tool, feature }] : [];
  });

  return (
    <PageShell crumbs={[{ name: "Features", path: "/features" }]} wide>
      <FaqStructuredData faqs={FAQS} />

      {/* Hero */}
      <header className="relative mb-20 overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-12 sm:px-12 sm:py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-gradient-to-br from-indigo-400/30 to-cyan-300/30 blur-3xl dark:from-indigo-500/20 dark:to-cyan-400/10"
        />
        <div className="relative max-w-2xl">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
            <Sparkles className="w-3.5 h-3.5" aria-hidden />
            Free · Open source · No credit card
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.1] mb-5">
            Your whole job search,{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-cyan-500 bg-clip-text text-transparent">
              built on your CV
            </span>
          </h1>
          <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-300 mb-8">
            Upload your CV once. NovusOrbit finds jobs that fit, tailors your resume to each one and preps you for
            the interview, using your real experience instead of generic advice.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <PrimaryCta>Upload your CV to start</PrimaryCta>
            <a
              href="#tools"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-5 py-3 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Explore the tools
            </a>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
            {["Six connected tools", "Jobs from LinkedIn, Indeed and Glassdoor", "Export to PDF"].map((item) => (
              <li key={item} className="inline-flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-500" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </header>

      {/* Tools */}
      <section id="tools" aria-labelledby="tools-heading" className="mb-20 scroll-mt-8">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mb-2">The tools</p>
          <h2 id="tools-heading" className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-3">
            Everything from first search to final interview
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            Each tool picks up where the last one left off, so a job you save flows straight into a tailored resume
            and interview practice.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map(({ tool, feature }) => (
            <ToolCard key={feature.slug} tool={tool} feature={feature} />
          ))}
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="how" className="mb-20">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mb-2">How it works</p>
          <h2 id="how" className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Four steps to a stronger application
          </h2>
        </div>
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <li
                key={s.title}
                className="relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6"
              >
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <Icon className="w-5 h-5 text-slate-400 dark:text-slate-500" aria-hidden />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-1.5">{s.title}</h3>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{s.body}</p>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Why */}
      <section aria-labelledby="why" className="mb-20">
        <h2 id="why" className="sr-only">
          Why NovusOrbit
        </h2>
        <div className="grid gap-8 sm:grid-cols-3">
          {WHY.map((w) => {
            const Icon = w.icon;
            return (
              <div key={w.title}>
                <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                  <Icon className="w-5 h-5" />
                </span>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-1.5">{w.title}</h3>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{w.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* FAQ */}
      <div className="mb-20 max-w-3xl">
        <FaqSection faqs={FAQS} />
      </div>

      {/* Closing CTA */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-cyan-600 px-6 py-12 sm:px-12 text-center">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_60%)]" />
        <div className="relative">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-3">
            Start with your CV. The rest follows.
          </h2>
          <p className="text-indigo-100 mb-8 max-w-xl mx-auto">
            It takes a minute to upload, and every tool gets better because of it.
          </p>
          <Link
            href="/portfolio"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50 transition-colors"
          >
            Upload your CV, free
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
