"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Check,
  Compass,
  FileText,
  Globe,
  MessageSquare,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { useAnalytics } from "@/hooks/useAnalytics";

/** Event the sidebar's "Guide" button dispatches to reopen the guide. */
export const OPEN_GUIDE_EVENT = "novusorbit:open-guide";

// Set when the user finishes the guide or ticks "Don't show this again".
const DISMISSED_KEY = "novusorbit-guide-dismissed";
// Set when the guide is closed early, so it doesn't reappear on every page
// change; it comes back next visit unless the user opted out.
const SESSION_KEY = "novusorbit-guide-seen-session";

// Public/marketing and admin pages: never open the guide on its own there.
const HIDDEN_PREFIXES = ["/auth", "/features", "/guides", "/privacy", "/admin"];

function readFlag(storage: "local" | "session", key: string): boolean {
  try {
    const s = storage === "local" ? window.localStorage : window.sessionStorage;
    return s.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(storage: "local" | "session", key: string, on: boolean) {
  try {
    const s = storage === "local" ? window.localStorage : window.sessionStorage;
    if (on) s.setItem(key, "1");
    else s.removeItem(key);
  } catch {
    // Storage blocked (private mode etc.): the guide just shows again.
  }
}

/* ------------------------------------------------------------------ */
/* Step illustrations: small, stylised mock-ups of the real screens.   */
/* ------------------------------------------------------------------ */

function WelcomeArt() {
  const items = [
    { icon: Upload, label: "Portfolio" },
    { icon: MessageSquare, label: "Ask" },
    { icon: Compass, label: "Jobs" },
    { icon: FileText, label: "Prepare" },
  ];
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-white/40 dark:bg-indigo-400/20 blur-xl" />
        <div className="relative rounded-2xl bg-white dark:bg-slate-900 p-3 shadow-lg ring-1 ring-indigo-100 dark:ring-slate-700">
          <LogoMark size={44} />
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {items.map((it, i) => (
          <div key={it.label} className="flex items-center gap-1.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/90 dark:bg-slate-900/90 shadow-sm ring-1 ring-indigo-100 dark:ring-slate-700">
              <it.icon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            {i < items.length - 1 && <div className="h-px w-4 bg-indigo-300 dark:bg-indigo-700" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function PortfolioArt() {
  return (
    <div className="w-full max-w-[260px] rounded-xl bg-white dark:bg-slate-900 p-3 shadow-lg ring-1 ring-indigo-100 dark:ring-slate-700">
      <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-indigo-200 dark:border-indigo-800 py-4">
        <Upload className="h-5 w-5 text-indigo-500" />
        <div className="h-1.5 w-24 rounded-full bg-slate-200 dark:bg-slate-700" />
      </div>
      <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-800 px-2.5 py-2">
        <div className="flex h-7 w-6 items-center justify-center rounded bg-rose-100 dark:bg-rose-900/40 text-[8px] font-bold text-rose-600 dark:text-rose-300">
          PDF
        </div>
        <div className="flex-1 space-y-1">
          <div className="h-1.5 w-20 rounded-full bg-slate-300 dark:bg-slate-600" />
          <div className="h-1.5 w-full rounded-full bg-indigo-100 dark:bg-indigo-900/50">
            <div className="h-full w-full rounded-full bg-indigo-500 guide-progress" />
          </div>
        </div>
        <Check className="h-4 w-4 text-emerald-500" />
      </div>
    </div>
  );
}

function AskArt() {
  const { t } = useTranslation();
  return (
    <div className="w-full max-w-[280px] space-y-2">
      <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-indigo-600 px-3 py-2 text-[11px] leading-snug text-white shadow-md">
        {t("What should I highlight for a product manager role?")}
      </div>
      <div className="w-fit max-w-[88%] rounded-2xl rounded-bl-md bg-white dark:bg-slate-900 px-3 py-2 shadow-md ring-1 ring-indigo-100 dark:ring-slate-700">
        <div className="space-y-1.5">
          <div className="h-1.5 w-44 rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="h-1.5 w-36 rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="h-1.5 w-40 rounded-full bg-slate-200 dark:bg-slate-700" />
        </div>
        <div className="mt-2 flex gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 dark:bg-indigo-500/15 px-2 py-0.5 text-[9px] font-medium text-indigo-700 dark:text-indigo-300">
            <Briefcase className="h-2.5 w-2.5" /> CV
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 dark:bg-sky-500/15 px-2 py-0.5 text-[9px] font-medium text-sky-700 dark:text-sky-300">
            <Globe className="h-2.5 w-2.5" /> Web
          </span>
        </div>
      </div>
    </div>
  );
}

function JobsArt() {
  const rows = [
    { w: "w-24", score: "92%", tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
    { w: "w-20", score: "87%", tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
    { w: "w-28", score: "74%", tone: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  ];
  return (
    <div className="w-full max-w-[270px] space-y-1.5">
      {rows.map((r, i) => (
        <div
          key={i}
          className={`flex items-center gap-2.5 rounded-xl bg-white dark:bg-slate-900 px-3 py-2 shadow-md ring-1 ring-indigo-100 dark:ring-slate-700 ${i === 0 ? "scale-[1.03]" : "opacity-90"}`}
        >
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-100 to-sky-100 dark:from-indigo-900/60 dark:to-sky-900/60" />
          <div className="flex-1 space-y-1">
            <div className={`h-1.5 ${r.w} rounded-full bg-slate-300 dark:bg-slate-600`} />
            <div className="h-1.5 w-14 rounded-full bg-slate-200 dark:bg-slate-700" />
          </div>
          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${r.tone}`}>{r.score}</span>
        </div>
      ))}
    </div>
  );
}

function PrepareArt() {
  const { t } = useTranslation();
  return (
    <div className="flex w-full max-w-[290px] gap-2">
      <div className="flex-1 rounded-xl bg-white dark:bg-slate-900 p-2.5 shadow-md ring-1 ring-indigo-100 dark:ring-slate-700">
        <div className="mb-2 flex items-center gap-1 text-[9px] font-semibold text-indigo-700 dark:text-indigo-300">
          <MessageSquare className="h-3 w-3" /> Q1
        </div>
        <div className="space-y-1">
          <div className="h-1.5 w-full rounded-full bg-slate-300 dark:bg-slate-600" />
          <div className="h-1.5 w-3/4 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>
        <div className="mt-2 space-y-1 rounded-md bg-indigo-50 dark:bg-indigo-500/10 p-1.5">
          <div className="h-1 w-full rounded-full bg-indigo-200 dark:bg-indigo-800" />
          <div className="h-1 w-5/6 rounded-full bg-indigo-200 dark:bg-indigo-800" />
        </div>
      </div>
      <div className="flex-1 rounded-xl bg-white dark:bg-slate-900 p-2.5 shadow-md ring-1 ring-indigo-100 dark:ring-slate-700">
        <div className="mb-2 flex items-center gap-1 text-[9px] font-semibold text-indigo-700 dark:text-indigo-300">
          <FileText className="h-3 w-3" /> CV
        </div>
        <div className="space-y-1">
          <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="h-1.5 w-full rounded-sm bg-amber-200/80 dark:bg-amber-500/40" />
          <div className="h-1.5 w-2/3 rounded-full bg-slate-200 dark:bg-slate-700" />
        </div>
        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-indigo-600 px-1.5 py-0.5 text-[8px] font-medium text-white">
          <Sparkles className="h-2.5 w-2.5" /> {t("Improve")}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface Step {
  key: string;
  eyebrow: string;
  title: string;
  body: string;
  points?: string[];
  art: () => React.ReactElement;
  /** Optional shortcut to the page this step is about. */
  link?: { href: string; label: string };
}

const STEPS: Step[] = [
  {
    key: "welcome",
    eyebrow: "Welcome to NovusOrbit",
    title: "Your AI career assistant",
    body: "A quick tour of how NovusOrbit helps you land your next role. It takes under a minute.",
    points: [
      "Answers grounded in your own CV",
      "Interview practice for the jobs you want",
      "Free to use",
    ],
    art: WelcomeArt,
  },
  {
    key: "portfolio",
    eyebrow: "Step 1 · Start here",
    title: "Upload your CV to My Portfolio",
    body: "Add your resume, plus certificates or project write-ups if you have them. Every feature uses this to give advice that's about you, not generic tips.",
    art: PortfolioArt,
    link: { href: "/portfolio", label: "Open My Portfolio" },
  },
  {
    key: "ask",
    eyebrow: "Step 2 · Ask anything",
    title: "Ask anything about your career",
    body: "Ask how to pitch yourself, what to learn next or how to answer a tricky question. Turn on web search when you need current salary or company information.",
    art: AskArt,
    link: { href: "/ask", label: "Ask a question" },
  },
  {
    key: "jobs",
    eyebrow: "Step 3 · Find roles",
    title: "Get matched, then save the ones you like",
    body: "Job Suggestions ranks real listings against your profile and explains why. Save the good ones to Interested Jobs and track where each application stands.",
    art: JobsArt,
    link: { href: "/job-suggest", label: "See Job Suggestions" },
  },
  {
    key: "prepare",
    eyebrow: "Step 4 · Get ready",
    title: "Practise interviews and polish your resume",
    body: "Interview Prep turns a saved job into likely questions with answers drawn from your experience. Resume Writer rewrites any line you select so it fits the role.",
    art: PrepareArt,
    link: { href: "/interview", label: "Try Interview Prep" },
  },
];

export default function WelcomeGuide() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const { trackEvent } = useAnalytics();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [dontShow, setDontShow] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const openedManually = useRef(false);
  // In-memory guard too, in case browser storage is blocked.
  const autoShown = useRef(false);

  // Open on its own for first-time visitors on app pages.
  useEffect(() => {
    if (open || autoShown.current) return;
    if (HIDDEN_PREFIXES.some((p) => pathname?.startsWith(p))) return;
    if (readFlag("local", DISMISSED_KEY) || readFlag("session", SESSION_KEY)) return;
    // Let the page paint first so the guide doesn't feel like a wall.
    const timer = setTimeout(() => {
      autoShown.current = true;
      openedManually.current = false;
      setStep(0);
      setDontShow(false);
      setOpen(true);
    }, 600);
    return () => clearTimeout(timer);
  }, [pathname, open]);

  // Reopen from the sidebar at any time.
  useEffect(() => {
    const handler = () => {
      openedManually.current = true;
      setStep(0);
      setDontShow(readFlag("local", DISMISSED_KEY));
      setOpen(true);
    };
    window.addEventListener(OPEN_GUIDE_EVENT, handler);
    return () => window.removeEventListener(OPEN_GUIDE_EVENT, handler);
  }, []);

  const close = useCallback(
    (reason: "completed" | "skipped") => {
      const permanent = reason === "completed" || dontShow;
      writeFlag("local", DISMISSED_KEY, permanent);
      writeFlag("session", SESSION_KEY, true);
      setOpen(false);
      trackEvent({
        action: reason === "completed" ? "guide_completed" : "guide_skipped",
        feature: "welcome_guide",
        metadata: { step: STEPS[step].key, dontShowAgain: permanent, manual: openedManually.current },
      });
    },
    [dontShow, step, trackEvent],
  );

  const isLast = step === STEPS.length - 1;
  const go = useCallback(
    (delta: 1 | -1) => {
      setDirection(delta);
      setStep((s) => Math.min(STEPS.length - 1, Math.max(0, s + delta)));
    },
    [],
  );

  // Keyboard: Esc closes, arrows move, Tab stays inside the dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close("skipped");
      } else if (e.key === "ArrowRight" && !isLast) {
        go(1);
      } else if (e.key === "ArrowLeft" && step > 0) {
        go(-1);
      } else if (e.key === "Tab" && dialogRef.current) {
        const nodes = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, [tabindex]:not([tabindex="-1"])',
        );
        if (!nodes.length) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isLast, step, go, close]);

  // Focus the main button on open and on each step, and lock page scroll.
  useEffect(() => {
    if (!open) return;
    primaryRef.current?.focus();
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const current = STEPS[step];
  const Art = current.art;

  const visitLink = (href: string) => {
    close(isLast ? "completed" : "skipped");
    if (pathname !== href) router.push(href);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center sm:p-4">
      <div
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px] guide-backdrop"
        onClick={() => close("skipped")}
        aria-hidden="true"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-guide-title"
        aria-describedby="welcome-guide-body"
        className="relative w-full sm:max-w-[480px] max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 shadow-2xl ring-1 ring-slate-200 dark:ring-slate-800 guide-panel"
      >
        {/* Illustration */}
        <div className="relative h-44 overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-sky-50 dark:from-indigo-950/70 dark:via-slate-900 dark:to-sky-950/50">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-indigo-200/50 dark:bg-indigo-500/10 blur-2xl" />
          <div className="pointer-events-none absolute -left-8 bottom-0 h-28 w-28 rounded-full bg-sky-200/50 dark:bg-sky-500/10 blur-2xl" />
          <div
            key={current.key}
            className={`relative flex h-full items-center justify-center px-6 ${direction === 1 ? "guide-in-right" : "guide-in-left"}`}
            aria-hidden="true"
          >
            <Art />
          </div>
          <button
            onClick={() => close("skipped")}
            className="absolute right-3 top-3 rounded-full p-1.5 text-slate-500 hover:bg-white/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors"
            aria-label={t("Close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Copy */}
        <div className="px-6 pt-5 pb-4">
          <div key={`copy-${current.key}`} className="guide-fade">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
              {t(current.eyebrow)}
            </p>
            <h2 id="welcome-guide-title" className="mt-1.5 text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
              {t(current.title)}
            </h2>
            <p id="welcome-guide-body" className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {t(current.body)}
            </p>
            {current.points && (
              <ul className="mt-3 space-y-1.5">
                {current.points.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-500/20">
                      <Check className="h-2.5 w-2.5 text-indigo-600 dark:text-indigo-300" strokeWidth={3} />
                    </span>
                    {t(p)}
                  </li>
                ))}
              </ul>
            )}
            {current.link && (
              <button
                onClick={() => visitLink(current.link!.href)}
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                {t(current.link.label)}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Progress */}
          <div className="mt-5 flex items-center justify-center gap-1.5" role="tablist" aria-label={t("Guide steps")}>
            {STEPS.map((s, i) => (
              <button
                key={s.key}
                role="tab"
                aria-selected={i === step}
                aria-label={`${t("Step")} ${i + 1} / ${STEPS.length}`}
                onClick={() => {
                  setDirection(i > step ? 1 : -1);
                  setStep(i);
                }}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === step
                  ? "w-6 bg-indigo-600 dark:bg-indigo-400"
                  : i < step
                    ? "w-1.5 bg-indigo-300 dark:bg-indigo-700"
                    : "w-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600"
                  }`}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 dark:border-slate-800 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex cursor-pointer select-none items-center gap-2 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={(e) => setDontShow(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800"
            />
            {t("Don't show this again")}
          </label>

          <div className="flex items-center gap-2">
            {step > 0 ? (
              <button
                onClick={() => go(-1)}
                className="inline-flex whitespace-nowrap items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("Back")}
              </button>
            ) : (
              <button
                onClick={() => close("skipped")}
                className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
              >
                {t("Skip tour")}
              </button>
            )}
            <button
              ref={primaryRef}
              onClick={() => (isLast ? visitLink("/portfolio") : go(1))}
              className="flex-1 sm:flex-none whitespace-nowrap inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 transition-colors"
            >
              {isLast ? (
                <>
                  <Upload className="h-4 w-4" />
                  {t("Upload my CV")}
                </>
              ) : (
                <>
                  {step === 0 ? t("Show me around") : t("Next")}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
