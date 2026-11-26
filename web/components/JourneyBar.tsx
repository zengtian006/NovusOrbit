"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ArrowRight, Check } from "lucide-react";
import { JOURNEY_STEPS, journeyStepIndex } from "@/lib/journey";
import { useJourney } from "@/components/JourneyProvider";

/**
 * Slim progress strip above every journey page: where you are in the
 * CV → questions → jobs → resume → interview flow, and what to do next.
 */
export default function JourneyBar() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { progress } = useJourney();

  const index = journeyStepIndex(pathname);
  if (index === -1) return null;

  const step = JOURNEY_STEPS[index];
  const next = JOURNEY_STEPS[index + 1];
  // Without a CV the later steps have little to work with: point back to step 1.
  const needsCv = !progress.cv && step.id !== "cv";

  return (
    <div className="shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur px-4 sm:px-6 py-2">
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Stepper */}
        <ol className="flex items-center gap-1 shrink-0" aria-label={t("Your job search")}>
          {JOURNEY_STEPS.map((s, i) => {
            const done = progress[s.id];
            const current = i === index;
            return (
              <li key={s.id} className="flex items-center gap-1">
                <Link
                  href={s.href}
                  title={`${i + 1}. ${t(s.label)}`}
                  aria-current={current ? "step" : undefined}
                  className={`flex items-center justify-center rounded-full text-[11px] font-semibold transition-all ${
                    current
                      ? "h-6 px-2.5 bg-indigo-600 text-white gap-1"
                      : done
                        ? "h-6 w-6 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:ring-2 hover:ring-emerald-300"
                        : "h-6 w-6 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:ring-2 hover:ring-slate-300 dark:hover:ring-slate-600"
                  }`}
                >
                  {done && !current ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  {current && <span className="hidden md:inline">{t(s.label)}</span>}
                </Link>
                {i < JOURNEY_STEPS.length - 1 && (
                  <span
                    className={`hidden sm:block h-px w-3 ${done ? "bg-emerald-300 dark:bg-emerald-700" : "bg-slate-200 dark:bg-slate-700"}`}
                  />
                )}
              </li>
            );
          })}
        </ol>

        {/* What to do here */}
        <p className="hidden lg:block flex-1 min-w-0 truncate text-xs text-slate-500 dark:text-slate-400">
          {t(step.hint)}
        </p>
        <div className="flex-1 lg:hidden" />

        {/* Next step */}
        {needsCv ? (
          <Link
            href="/portfolio"
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/50"
          >
            {t("Upload your CV first")}
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        ) : next ? (
          <Link
            href={next.href}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/15 hover:bg-indigo-100 dark:hover:bg-indigo-500/25"
          >
            <span className="hidden sm:inline text-indigo-400 dark:text-indigo-400 font-medium">{t("Next")}:</span>
            {t(next.cta)}
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
