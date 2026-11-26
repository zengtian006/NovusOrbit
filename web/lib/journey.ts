import type { LucideIcon } from "lucide-react";
import {
  Upload,
  MessageSquare,
  Compass,
  BookmarkCheck,
  FileText,
  Mic,
} from "lucide-react";

/** One step of the job-search journey the app is organised around. */
export interface JourneyStep {
  id: JourneyStepId;
  href: string;
  icon: LucideIcon;
  /** Short label for the sidebar and stepper (i18n key). */
  label: string;
  /** What the user does on this step (i18n key). */
  hint: string;
  /** Call to action pointing at this step from the previous one (i18n key). */
  cta: string;
}

export type JourneyStepId = "cv" | "ask" | "find" | "save" | "tailor" | "interview";

export const JOURNEY_STEPS: JourneyStep[] = [
  {
    id: "cv",
    href: "/portfolio",
    icon: Upload,
    label: "Upload CV",
    hint: "Upload your CV so every tool can use your real experience.",
    cta: "Upload your CV",
  },
  {
    id: "ask",
    href: "/ask",
    icon: MessageSquare,
    label: "Ask Questions",
    hint: "Ask anything about your CV, career or a role you're considering.",
    cta: "Ask about your CV",
  },
  {
    id: "find",
    href: "/job-suggest",
    icon: Compass,
    label: "Find Jobs",
    hint: "Get job openings matched to your CV, then save the ones you like.",
    cta: "Find jobs that match your CV",
  },
  {
    id: "save",
    href: "/jobs",
    icon: BookmarkCheck,
    label: "Saved Jobs",
    hint: "Track the jobs you're interested in and their application status.",
    cta: "Review your saved jobs",
  },
  {
    id: "tailor",
    href: "/resume-writer",
    icon: FileText,
    label: "Tailor Resume",
    hint: "Attach a saved job and refine your resume for its description.",
    cta: "Tailor your resume to a job",
  },
  {
    id: "interview",
    href: "/interview",
    icon: Mic,
    label: "Interview Prep",
    hint: "Practise likely interview questions for a saved job.",
    cta: "Prepare for the interview",
  },
];

export function journeyStepIndex(pathname: string | null): number {
  if (!pathname) return -1;
  return JOURNEY_STEPS.findIndex((s) => s.href === pathname);
}

/** Link to a journey step with a saved job pre-selected (resume writer, interview prep). */
export function withJob(href: string, boardId: string, jobId: string): string {
  const params = new URLSearchParams({ board: boardId, job: jobId });
  return `${href}?${params.toString()}`;
}

/** Read ?board=&job= from the current URL (client only). */
export function readJobParams(): { boardId: string; jobId: string } | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const boardId = params.get("board");
  const jobId = params.get("job");
  return boardId && jobId ? { boardId, jobId } : null;
}

/** Fired after an action that may complete a step, so progress refreshes. */
export const JOURNEY_REFRESH_EVENT = "novusorbit:journey-refresh";

export function refreshJourney() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(JOURNEY_REFRESH_EVENT));
}
