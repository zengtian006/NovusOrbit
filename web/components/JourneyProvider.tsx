"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
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

/**
 * Works out which journey steps the user has done, from data they already have
 * on the server (CV uploaded, chats, saved jobs, tailored resumes, interview
 * sessions). Refreshes on navigation and on JOURNEY_REFRESH_EVENT.
 */
export function JourneyProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [progress, setProgress] = useState<Progress>(EMPTY);
  const [loaded, setLoaded] = useState(false);

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

  return <JourneyContext.Provider value={{ progress, loaded }}>{children}</JourneyContext.Provider>;
}

export function useJourney() {
  return useContext(JourneyContext);
}
