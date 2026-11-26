"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { apiUrl } from "@/lib/api";
import { JOURNEY_REFRESH_EVENT, JourneyStepId } from "@/lib/journey";

type Progress = Record<JourneyStepId, boolean>;

const EMPTY: Progress = {
  cv: false,
  ask: false,
  find: false,
  save: false,
  tailor: false,
  interview: false,
};

const JourneyContext = createContext<{ progress: Progress; loaded: boolean }>({
  progress: EMPTY,
  loaded: false,
});

async function getJson(path: string): Promise<any> {
  try {
    const res = await fetch(apiUrl(path));
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

async function fetchProgress(): Promise<Progress> {
  const [kbs, chats, suggestions, boards, resumeHistory, interviews] = await Promise.all([
    getJson("/api/v1/portfolio/list"),
    getJson("/api/v1/chat/sessions?limit=1"),
    getJson("/api/v1/job-suggest/sessions?limit=1"),
    getJson("/api/v1/jobs/list"),
    getJson("/api/v1/resume_writer/history"),
    getJson("/api/v1/interview/sessions?limit=1"),
  ]);
  const count = (v: any) => (Array.isArray(v) ? v.length : 0);
  const hasCv = Array.isArray(kbs) && kbs.some((kb: any) => (kb?.statistics?.raw_documents ?? 0) > 0);
  const savedJobs = (boards?.boards ?? []).reduce((n: number, b: any) => n + (b.job_count || 0), 0);
  const tailored = (resumeHistory?.history ?? []).some((op: any) => op.action === "tailor");
  return {
    cv: hasCv,
    ask: count(chats) > 0,
    find: count(suggestions) > 0 || savedJobs > 0,
    save: savedJobs > 0,
    tailor: tailored,
    interview: count(interviews) > 0,
  };
}

const FUNNEL_SENT_KEY = "novusorbit-funnel-sent";

/**
 * Record each journey step the first time a signed-in user has completed it, as
 * a "funnel" analytics event (deduplicated per user on the server). Admin →
 * Analytics joins these with sign-up sources to show which channel brings
 * users who actually upload a CV and go further.
 */
function reportFunnel(userId: string, progress: Progress) {
  let sent: Record<string, boolean> = {};
  try {
    sent = JSON.parse(localStorage.getItem(`${FUNNEL_SENT_KEY}:${userId}`) || "{}");
  } catch {
    // Storage unavailable: the server deduplicates anyway.
  }
  for (const step of Object.keys(progress) as JourneyStepId[]) {
    if (!progress[step] || sent[step]) continue;
    fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "funnel", feature: step }),
    })
      .then((res) => {
        if (!res.ok) return;
        sent[step] = true;
        try {
          localStorage.setItem(`${FUNNEL_SENT_KEY}:${userId}`, JSON.stringify(sent));
        } catch {
          // ignore
        }
      })
      .catch(() => {
        // Retry on a later page view.
      });
  }
}

/**
 * Works out which journey steps the user has done, from data they already have
 * on the server (CV uploaded, chats, saved jobs, tailored resumes, interview
 * sessions). Refreshes on navigation and on JOURNEY_REFRESH_EVENT.
 */
export function JourneyProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [progress, setProgress] = useState<Progress>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const { data: session } = useSession();
  const userId = session?.user?.id;

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetchProgress().then((p) => {
        if (cancelled) return;
        setProgress(p);
        setLoaded(true);
      });
    load();
    window.addEventListener(JOURNEY_REFRESH_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(JOURNEY_REFRESH_EVENT, load);
    };
  }, [pathname]);

  useEffect(() => {
    if (loaded && userId) reportFunnel(userId, progress);
  }, [loaded, userId, progress]);

  return <JourneyContext.Provider value={{ progress, loaded }}>{children}</JourneyContext.Provider>;
}

export function useJourney() {
  return useContext(JourneyContext);
}
