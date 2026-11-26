"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Building2,
  Check,
  FileText,
  Loader2,
  LogIn,
  MessageSquare,
  Mic,
  Plus,
  Send,
  Sparkles,
  Upload,
} from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { useJourney } from "@/components/JourneyProvider";
import { JOURNEY_STEPS, JourneyStep, withJob } from "@/lib/journey";
import { apiUrl } from "@/lib/api";
import { formatDate } from "@/lib/datetime";

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

interface Portfolio {
  name: string;
  is_default?: boolean;
  statistics?: { raw_documents?: number };
}

interface SavedJob {
  id: string;
  board_id: string;
  title: string;
  company: string;
  location?: string;
  status: string;
  updated_at: number;
}

interface InterviewSession {
  session_id: string;
  job_title: string;
  company: string;
  question_count: number;
  updated_at: number;
}

interface ChatSession {
  session_id: string;
  title?: string;
  updated_at: number;
}

interface DashboardData {
  portfolios: Portfolio[];
  jobs: SavedJob[];
  interviews: InterviewSession[];
  chats: ChatSession[];
}

async function getJson(path: string): Promise<any> {
  try {
    const res = await fetch(apiUrl(path));
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

async function loadDashboard(): Promise<DashboardData> {
  const [portfolios, boardList, interviews, chats] = await Promise.all([
    getJson("/api/v1/portfolio/list"),
    getJson("/api/v1/jobs/list"),
    getJson("/api/v1/interview/sessions?limit=3"),
    getJson("/api/v1/chat/sessions?limit=3"),
  ]);
  const boards: { id: string }[] = boardList?.boards ?? [];
  const boardDetails = await Promise.all(boards.map((b) => getJson(`/api/v1/jobs/${b.id}`)));
  const jobs: SavedJob[] = boardDetails.flatMap((board) =>
    (board?.jobs ?? []).map((j: any) => ({ ...j, board_id: board.id })),
  );
  jobs.sort((a, b) => b.updated_at - a.updated_at);
  return {
    portfolios: Array.isArray(portfolios) ? portfolios : [],
    jobs,
    interviews: Array.isArray(interviews) ? interviews : [],
    chats: Array.isArray(chats) ? chats : [],
  };
}

/** Timestamps from the API are seconds; tolerate milliseconds too. */
function toDate(ts: number): Date {
  return new Date(ts > 1e12 ? ts : ts * 1000);
}

const STATUSES: { value: string; label: string; className: string }[] = [
  { value: "interested", label: "Interested", className: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300" },
  { value: "applied", label: "Applied", className: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
  { value: "interviewing", label: "Interviewing", className: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  { value: "offered", label: "Offered", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  { value: "rejected", label: "Rejected", className: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" },
];

function statusMeta(status: string) {
  return STATUSES.find((s) => s.value === status) ?? STATUSES[0];
}

function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Signed out: what NovusOrbit is, and how to start                    */
/* ------------------------------------------------------------------ */

export function HomeLanding() {
  const { t } = useTranslation();
  return (
    <div className="min-h-full animate-fade-in px-6 py-12 sm:py-16">
      <div className="max-w-3xl mx-auto text-center">
        <LogoMark size={52} className="mx-auto mb-6" />
        <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-slate-900 dark:text-white">
          {t("Your AI career assistant")}
        </h1>
        <p className="mt-4 text-base sm:text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
          {t("Upload your CV once. Get matched jobs, a resume tailored to each one, and interview prep grounded in your real experience.")}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => signIn("google")}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm transition-colors"
          >
            <LogIn className="w-4 h-4" />
            {t("Get started with Google")}
          </button>
          <Link
            href="/features"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:bg-white dark:hover:bg-slate-900 transition-colors"
          >
            {t("See how it works")}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">{t("Free and open source.")}</p>
      </div>

      <div className="max-w-5xl mx-auto mt-14">
        <h2 className="text-center text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-5">
          {t("Six steps from CV to offer")}
        </h2>
        <ol className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {JOURNEY_STEPS.map((step, i) => (
            <li
              key={step.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
            >
              <div className="flex items-center gap-2.5 mb-1.5">
                <span className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-xs font-semibold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t(step.label)}</span>
                <step.icon className="w-4 h-4 ml-auto text-slate-300 dark:text-slate-600" />
              </div>
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{t(step.hint)}</p>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
          <Link href="/guides" className="text-indigo-600 dark:text-indigo-400 hover:underline">
            {t("Read our career guides")}
          </Link>
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Signed in: where the job search stands and what to do next          */
/* ------------------------------------------------------------------ */

export function HomeDashboard({ firstName }: { firstName: string }) {
  const { t } = useTranslation();
  const { progress } = useJourney();
  const [data, setData] = useState<DashboardData | null>(null);
  const [now] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    loadDashboard().then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const doneCount = JOURNEY_STEPS.filter((s) => progress[s.id]).length;
  const nextStep = JOURNEY_STEPS.find((s) => !progress[s.id]) ?? null;
  const latestJob = data?.jobs.find((j) => j.status !== "rejected") ?? data?.jobs[0];
  const hasCv = (data?.portfolios ?? []).some((p) => (p.statistics?.raw_documents ?? 0) > 0);

  return (
    <div className="min-h-full animate-fade-in px-4 sm:px-6 py-6 sm:py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
              {t(greetingFor(now))}
              {firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t("Here's where your job search stands.")}
            </p>
          </div>
          <div className="w-48">
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
              <span>{t("Your progress")}</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {doneCount}/{JOURNEY_STEPS.length}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-all duration-500"
                style={{ width: `${(doneCount / JOURNEY_STEPS.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-6 min-w-0">
            <NextStepCard step={nextStep} latestJob={latestJob} />
            <QuickAsk hasCv={hasCv} loading={!data} />
            <Applications jobs={data?.jobs ?? null} />
          </div>

          {/* Side column */}
          <div className="space-y-6 min-w-0">
            <CvCard portfolios={data?.portfolios ?? null} />
            <JourneyChecklist />
            <RecentActivity interviews={data?.interviews ?? []} chats={data?.chats ?? []} />
          </div>
        </div>
      </div>
    </div>
  );
}

const card =
  "rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm";

function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 pt-4 pb-3">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      {action}
    </div>
  );
}

function NextStepCard({ step, latestJob }: { step: JourneyStep | null; latestJob?: SavedJob }) {
  const { t } = useTranslation();

  // Everything done: keep the pipeline full.
  if (!step) {
    return (
      <div className={`${card} p-6 flex flex-wrap items-center justify-between gap-4`}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            {t("All six steps done")}
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
            {t("Keep your pipeline full: find your next match.")}
          </p>
        </div>
        <Link
          href="/job-suggest"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold"
        >
          {t("Find more jobs")}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  const index = JOURNEY_STEPS.indexOf(step);
  // Tailoring and interview prep work on a job: jump straight to the latest one.
  const href =
    latestJob && (step.id === "tailor" || step.id === "interview")
      ? withJob(step.href, latestJob.board_id, latestJob.id)
      : step.href;
  const forJob = latestJob && href !== step.href ? latestJob : null;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-cyan-600 text-white shadow-md">
      <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/10" aria-hidden />
      <div className="relative p-6 sm:p-7 flex flex-wrap items-center justify-between gap-5">
        <div className="flex items-start gap-4 min-w-0">
          <div className="w-12 h-12 shrink-0 rounded-xl bg-white/15 flex items-center justify-center">
            <step.icon className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
              {t("Next step")} · {t("Step")} {index + 1} / {JOURNEY_STEPS.length}
            </p>
            <p className="mt-1 text-xl font-semibold">{t(step.label)}</p>
            <p className="mt-1 text-sm text-white/80 max-w-md">
              {forJob ? `${t("For")} ${forJob.title}${forJob.company ? ` — ${forJob.company}` : ""}` : t(step.hint)}
            </p>
          </div>
        </div>
        <Link
          href={href}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-indigo-700 text-sm font-semibold shadow-sm hover:bg-indigo-50 transition-colors"
        >
          {t(step.cta)}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

function QuickAsk({ hasCv, loading }: { hasCv: boolean; loading: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const disabled = loading || !hasCv;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || disabled) return;
    router.push(`/ask?q=${encodeURIComponent(question.trim())}`);
  };

  return (
    <form onSubmit={submit} className={`${card} p-2 flex items-center gap-2`}>
      <MessageSquare className="w-5 h-5 ml-3 shrink-0 text-slate-400" />
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        disabled={disabled}
        placeholder={
          hasCv || loading
            ? t("Ask anything about your career...")
            : t("Upload your CV to ask questions about it")
        }
        className="flex-1 min-w-0 bg-transparent px-2 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none disabled:cursor-not-allowed"
      />
      <button
        type="submit"
        disabled={disabled || !question.trim()}
        aria-label={t("Ask")}
        className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 transition-colors"
      >
        <Send className="w-4 h-4" />
      </button>
    </form>
  );
}

function Applications({ jobs }: { jobs: SavedJob[] | null }) {
  const { t } = useTranslation();
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const j of jobs ?? []) c[j.status] = (c[j.status] ?? 0) + 1;
    return c;
  }, [jobs]);

  return (
    <section className={card}>
      <CardHeader
        title={t("Your applications")}
        action={
          jobs && jobs.length > 0 ? (
            <Link href="/jobs" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
              {t("View all")}
            </Link>
          ) : null
        }
      />

      {jobs === null ? (
        <div className="px-5 pb-6 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="px-5 pb-6 pt-2 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t("No saved jobs yet. Find roles that match your CV and save the ones you like.")}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link
              href="/job-suggest"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {t("Find jobs that match your CV")}
            </Link>
            <Link
              href="/jobs"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Plus className="w-3.5 h-3.5" />
              {t("Add a job yourself")}
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Pipeline summary */}
          <div className="px-5 pb-3 flex flex-wrap gap-2">
            {STATUSES.filter((s) => s.value !== "rejected" || counts.rejected).map((s) => (
              <span key={s.value} className={`text-xs font-medium px-2.5 py-1 rounded-full ${s.className}`}>
                {t(s.label)} <span className="font-bold">{counts[s.value] ?? 0}</span>
              </span>
            ))}
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800">
            {jobs.slice(0, 5).map((job) => {
              const meta = statusMeta(job.status);
              return (
                <li key={`${job.board_id}-${job.id}`} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{job.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                      <Building2 className="w-3 h-3 shrink-0" />
                      {job.company}
                      {job.location ? ` · ${job.location}` : ""}
                    </p>
                  </div>
                  <span className={`hidden sm:inline text-[11px] font-semibold px-2 py-0.5 rounded-full ${meta.className}`}>
                    {t(meta.label)}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <Link
                      href={withJob("/resume-writer", job.board_id, job.id)}
                      title={t("Tailor your resume to this job")}
                      className="p-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/15 dark:hover:text-indigo-300"
                    >
                      <FileText className="w-4 h-4" />
                    </Link>
                    <Link
                      href={withJob("/interview", job.board_id, job.id)}
                      title={t("Practise interview questions for this job")}
                      className="p-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/15 dark:hover:text-indigo-300"
                    >
                      <Mic className="w-4 h-4" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

function CvCard({ portfolios }: { portfolios: Portfolio[] | null }) {
  const { t } = useTranslation();
  const withDocs = (portfolios ?? []).filter((p) => (p.statistics?.raw_documents ?? 0) > 0);

  return (
    <section className={card}>
      <CardHeader
        title={t("Your CV")}
        action={
          withDocs.length > 0 ? (
            <Link href="/portfolio" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
              {t("Manage")}
            </Link>
          ) : null
        }
      />
      <div className="px-5 pb-5">
        {portfolios === null ? (
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        ) : withDocs.length === 0 ? (
          <>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t("Every tool works from your CV. Upload it first.")}
            </p>
            <Link
              href="/portfolio"
              className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
            >
              <Upload className="w-3.5 h-3.5" />
              {t("Upload your CV")}
            </Link>
          </>
        ) : (
          <ul className="space-y-2">
            {withDocs.map((p) => (
              <li key={p.name} className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{p.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {p.statistics?.raw_documents} {p.statistics?.raw_documents === 1 ? t("document") : t("documents")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function JourneyChecklist() {
  const { t } = useTranslation();
  const { progress } = useJourney();
  const nextId = JOURNEY_STEPS.find((s) => !progress[s.id])?.id;

  return (
    <section className={card}>
      <CardHeader title={t("Your job search")} />
      <ol className="px-3 pb-3">
        {JOURNEY_STEPS.map((step, i) => {
          const done = progress[step.id];
          const isNext = step.id === nextId;
          return (
            <li key={step.id}>
              <Link
                href={step.href}
                className={`flex items-center gap-3 px-2 py-2 rounded-lg transition-colors ${isNext ? "bg-indigo-50 dark:bg-indigo-500/10" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}
              >
                <span
                  className={`w-6 h-6 shrink-0 rounded-full text-[11px] font-semibold flex items-center justify-center ${
                    done
                      ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300"
                      : isNext
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </span>
                <span
                  className={`text-sm ${done ? "text-slate-400 dark:text-slate-500" : isNext ? "font-semibold text-indigo-700 dark:text-indigo-300" : "text-slate-700 dark:text-slate-300"}`}
                >
                  {t(step.label)}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function RecentActivity({ interviews, chats }: { interviews: InterviewSession[]; chats: ChatSession[] }) {
  const { t } = useTranslation();
  const items = [
    ...interviews.map((s) => ({
      key: `i-${s.session_id}`,
      icon: Mic,
      title: `${t("Interview prep")}: ${s.job_title}${s.company ? ` — ${s.company}` : ""}`,
      href: "/history",
      at: s.updated_at,
    })),
    ...chats.map((s) => ({
      key: `c-${s.session_id}`,
      icon: MessageSquare,
      title: s.title || t("Chat"),
      href: "/history",
      at: s.updated_at,
    })),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, 4);

  if (items.length === 0) return null;

  return (
    <section className={card}>
      <CardHeader
        title={t("Recent activity")}
        action={
          <Link href="/history" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
            {t("History")}
          </Link>
        }
      />
      <ul className="px-3 pb-3">
        {items.map((it) => (
          <li key={it.key}>
            <Link href={it.href} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
              <it.icon className="w-4 h-4 shrink-0 text-slate-400" />
              <span className="flex-1 min-w-0 text-sm text-slate-700 dark:text-slate-300 truncate">{it.title}</span>
              <span className="text-xs text-slate-400 shrink-0">{formatDate(toDate(it.at), { month: "short", day: "numeric" })}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
