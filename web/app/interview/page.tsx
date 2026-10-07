"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  Loader2,
  ChevronDown,
  Sparkles,
  Database,
  Globe,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Building2,
  MapPin,
  FileText,
  ChevronRight,
  Award,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "katex/dist/katex.min.css";
import { apiUrl } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useGlobal } from "@/context/GlobalContext";

// Types
interface JobBoardSummary {
  id: string;
  name: string;
  description: string;
  job_count: number;
  color: string;
}

interface JobEntry {
  id: string;
  title: string;
  company: string;
  description: string;
  location: string;
  url: string;
  salary_range: string;
  status: string;
  notes: string;
  created_at: number;
  updated_at: number;
}

interface JobBoard {
  id: string;
  name: string;
  jobs: JobEntry[];
}

interface KBInfo {
  name: string;
}

interface GeneratedQuestion {
  number: number;
  question: string;
  answer?: string;
  answerLoading?: boolean;
  answerError?: string;
  usedResume?: boolean;
  usedWebSearch?: boolean;
}

const LEVELS = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

export default function InterviewPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation();
  const { pageSettings } = useGlobal();
  const { trackEvent } = useAnalytics();

  useEffect(() => {
    // Only check SSO after pageSettings have been loaded from backend
    // If pageSettings is undefined, we're still loading, so don't redirect yet
    if (pageSettings !== undefined) {
      const requireSSO = pageSettings["/interview"]?.requireSSO ?? false;
      if (requireSSO && status === "unauthenticated") {
        router.push("/auth/signin");
      }
    }
  }, [status, router, pageSettings]);

  // Data
  const [boards, setBoards] = useState<JobBoardSummary[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const [boardJobs, setBoardJobs] = useState<JobEntry[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobEntry | null>(null);
  const [kbs, setKbs] = useState<KBInfo[]>([]);
  const [selectedKb, setSelectedKb] = useState("");

  // Config
  const [level, setLevel] = useState("medium");
  const [questionCount, setQuestionCount] = useState(5);

  // State
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [generating, setGenerating] = useState(false);
  const [expandedQ, setExpandedQ] = useState<number | null>(null);
  const [loadingBoards, setLoadingBoards] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const questionsRef = useRef<HTMLDivElement>(null);

  // Fetch boards and KBs on mount
  useEffect(() => {
    fetchBoards();
    fetchKBs();
  }, []);

  // Fetch jobs when board changes
  useEffect(() => {
    if (selectedBoardId) {
      fetchBoardJobs(selectedBoardId);
    } else {
      setBoardJobs([]);
      setSelectedJob(null);
    }
  }, [selectedBoardId]);

  const fetchBoards = async () => {
    try {
      const res = await fetch(apiUrl("/api/v1/jobs/list"));
      const data = await res.json();
      setBoards(data.boards || []);
    } catch (err) {
      console.error("Failed to fetch job boards:", err);
    } finally {
      setLoadingBoards(false);
    }
  };

  const fetchBoardJobs = async (boardId: string) => {
    try {
      const res = await fetch(apiUrl(`/api/v1/jobs/${boardId}`));
      const data: JobBoard = await res.json();
      setBoardJobs(data.jobs || []);
    } catch (err) {
      console.error("Failed to fetch board jobs:", err);
    }
  };

  const fetchKBs = async () => {
    try {
      const res = await fetch(apiUrl("/api/v1/portfolio/list"));
      const data = await res.json();
      // API returns a flat array of KB objects
      const kbList = Array.isArray(data) ? data : [];
      const names = kbList.map((kb: any) => ({ name: kb.name }));
      setKbs(names);
      if (names.length > 0) {
        setSelectedKb(names[0].name);
      }
    } catch (err) {
      console.error("Failed to fetch KBs:", err);
    }
  };

  const saveSession = async (qs: GeneratedQuestion[], sid: string | null = sessionId) => {
    if (!selectedJob) return;
    try {
      const res = await fetch(apiUrl("/api/v1/interview/sessions/save"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sid,
          job_title: selectedJob.title,
          company: selectedJob.company,
          level,
          questions: qs.map((q) => ({
            number: q.number,
            question: q.question,
            answer: q.answer || "",
            usedResume: q.usedResume || false,
            usedWebSearch: q.usedWebSearch || false,
          })),
          kb_name: selectedKb,
          job_description: selectedJob.description,
        }),
      });
      const data = await res.json();
      if (data.success && data.session_id) {
        setSessionId(data.session_id);
      }
    } catch (err) {
      console.error("Failed to save interview session:", err);
    }
  };

  const handleGenerate = async () => {
    if (!selectedJob) return;

    trackEvent({ action: "generate_interview_questions", feature: "/interview", metadata: { jobTitle: selectedJob.title, level: level } });
    setGenerating(true);
    setQuestions([]);
    setExpandedQ(null);
    setSessionId(null);

    try {
      const res = await fetch(apiUrl("/api/v1/interview/generate-questions"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_title: selectedJob.title,
          company: selectedJob.company,
          job_description: selectedJob.description,
          level,
          count: questionCount,
        }),
      });

      const data = await res.json();
      if (data.success && data.questions) {
        const newQuestions = data.questions.map((q: any) => ({
          number: q.number,
          question: q.question,
        }));
        setQuestions(newQuestions);
        // Auto-expand first question
        if (data.questions.length > 0) {
          setExpandedQ(data.questions[0].number);
        }
        // Save session
        saveSession(newQuestions, null);
        // Scroll to questions
        setTimeout(() => {
          questionsRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 200);
      }
    } catch (err) {
      console.error("Failed to generate questions:", err);
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateAnswer = async (qIndex: number) => {
    const q = questions[qIndex];
    if (!q || !selectedJob) return;

    setQuestions((prev) =>
      prev.map((item, i) =>
        i === qIndex
          ? { ...item, answerLoading: true, answerError: undefined }
          : item
      )
    );

    try {
      const res = await fetch(apiUrl("/api/v1/interview/generate-answer"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q.question,
          job_title: selectedJob.title,
          company: selectedJob.company,
          job_description: selectedJob.description,
          kb_name: selectedKb,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setQuestions((prev) => {
          const updated = prev.map((item, i) =>
            i === qIndex
              ? {
                ...item,
                answer: data.answer,
                answerLoading: false,
                usedResume: data.used_resume,
                usedWebSearch: data.used_web_search,
              }
              : item
          );
          // Save session with updated answers
          saveSession(updated);
          return updated;
        });
      } else {
        throw new Error(data.detail || "Failed to generate answer");
      }
    } catch (err: any) {
      setQuestions((prev) =>
        prev.map((item, i) =>
          i === qIndex
            ? {
              ...item,
              answerLoading: false,
              answerError: err.message || "Failed",
            }
            : item
        )
      );
    }
  };

  const handleGenerateAllAnswers = async () => {
    if (!selectedJob || questions.length === 0) return;

    // Mark all as loading
    setQuestions((prev) =>
      prev.map((q) => ({
        ...q,
        answerLoading: true,
        answerError: undefined,
      }))
    );

    try {
      const res = await fetch(
        apiUrl("/api/v1/interview/generate-answers-batch"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questions: questions.map((q) => q.question),
            job_title: selectedJob.title,
            company: selectedJob.company,
            job_description: selectedJob.description,
            kb_name: selectedKb,
          }),
        }
      );

      const data = await res.json();
      if (data.success && data.results) {
        setQuestions((prev) => {
          const updated = prev.map((q, i) => ({
            ...q,
            answer: data.results[i]?.answer || "",
            answerLoading: false,
            usedResume: data.used_resume || false,
            answerError: data.results[i]?.success
              ? undefined
              : data.results[i]?.error || "Failed",
          }));
          // Save session with all answers
          saveSession(updated);
          return updated;
        });
      }
    } catch (err: any) {
      setQuestions((prev) =>
        prev.map((q) => ({
          ...q,
          answerLoading: false,
          answerError: err.message || "Failed",
        }))
      );
    }
  };

  return (
    <div className="h-screen animate-fade-in flex gap-4 p-4">
      {/* LEFT PANEL — Configuration */}
      <div className="flex-[1_1_33%] min-w-[320px] max-w-[420px] flex flex-col gap-4 h-full overflow-y-auto">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl text-white shadow-lg shadow-purple-500/20">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {t("Interview Prep")}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("Generate interview questions from your saved jobs and get AI-powered answers based on your resume")}
              </p>
            </div>
          </div>
        </div>

        {/* Job Selection */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-sm">
              <Briefcase className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              {t("Select a Job")}
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {/* Board Selector */}
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                {t("Job Board")}
              </label>
              <select
                value={selectedBoardId}
                onChange={(e) => {
                  setSelectedBoardId(e.target.value);
                  setSelectedJob(null);
                }}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-purple-500/20"
              >
                <option value="">{t("Select a board...")}</option>
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.job_count} {t("jobs")})
                  </option>
                ))}
              </select>
            </div>

            {/* Job Selector */}
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                {t("Job Position")}
              </label>
              <select
                value={selectedJob?.id || ""}
                onChange={(e) => {
                  const job = boardJobs.find((j) => j.id === e.target.value);
                  setSelectedJob(job || null);
                }}
                disabled={!selectedBoardId || boardJobs.length === 0}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-purple-500/20 disabled:opacity-50"
              >
                <option value="">{t("Select a job...")}</option>
                {boardJobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title} — {j.company}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Selected job preview */}
          {selectedJob && (
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-800">
              <div className="flex items-start gap-2">
                <div className="p-1.5 bg-purple-100 dark:bg-purple-900/40 rounded-lg shrink-0">
                  <Briefcase className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                    {selectedJob.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-0.5">
                      <Building2 className="w-2.5 h-2.5" /> {selectedJob.company}
                    </span>
                    {selectedJob.location && (
                      <span className="flex items-center gap-0.5">
                        <MapPin className="w-2.5 h-2.5" /> {selectedJob.location}
                      </span>
                    )}
                  </div>
                  {selectedJob.description && (
                    <p className="text-[10px] text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
                      {selectedJob.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Configuration */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col gap-3">
          <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-sm">
            <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            {t("Configure")}
          </h2>

          {/* Difficulty Level */}
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
              {t("Difficulty Level")}
            </label>
            <div className="flex bg-slate-50 dark:bg-slate-700 p-1 rounded-lg border border-slate-200 dark:border-slate-600">
              {LEVELS.map((l) => (
                <button
                  key={l.value}
                  onClick={() => setLevel(l.value)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md capitalize transition-all ${level === l.value
                    ? "bg-white dark:bg-slate-600 text-emerald-700 dark:text-emerald-400 shadow-sm border border-slate-100 dark:border-slate-500"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                >
                  {t(l.label)}
                </button>
              ))}
            </div>
          </div>

          {/* Question Count */}
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
              {t("Number of Questions")}
            </label>
            <select
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              {[3, 5, 8, 10].map((n) => (
                <option key={n} value={n}>
                  {n} {t("questions")}
                </option>
              ))}
            </select>
          </div>

          {/* Resume KB */}
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Database className="w-3 h-3" />
              {t("Your Portfolio (for answers)")}
            </label>
            <select
              value={selectedKb}
              onChange={(e) => setSelectedKb(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              <option value="">{t("None (generic answers)")}</option>
              {kbs.map((kb) => (
                <option key={kb.name} value={kb.name}>
                  {kb.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={!selectedJob || generating}
          className="w-full py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-semibold shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:from-violet-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t("Generating Questions...")}
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              {t("Generate Interview Questions")}
            </>
          )}
        </button>
      </div>

      {/* RIGHT PANEL — Questions & Answers */}
      <div className="flex-[2_1_67%] min-w-0 flex flex-col h-full overflow-hidden bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
        {/* Panel header */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between shrink-0">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {t("Interview Questions")}
            {questions.length > 0 && (
              <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full text-[10px] font-bold">
                {questions.length}
              </span>
            )}
          </div>
          {questions.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleGenerateAllAnswers}
                disabled={questions.some((q) => q.answerLoading)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
              >
                {questions.some((q) => q.answerLoading) ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                {t("Generate All Answers")}
                {selectedKb && (
                  <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-500/30 rounded text-[10px]">
                    <Database className="w-2.5 h-2.5" />
                    {t("Resume")}
                  </span>
                )}
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
              >
                <RefreshCw className="w-3 h-3" />
                {t("Regenerate")}
              </button>
            </div>
          )}
        </div>

        {/* Scrollable questions list */}
        <div ref={questionsRef} className="flex-1 overflow-y-auto p-4">
          {questions.length > 0 ? (
            <div className="space-y-3">
              {questions.map((q, idx) => (
                <div
                  key={q.number}
                  className="bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden transition-all"
                >
                  {/* Question header */}
                  <button
                    onClick={() =>
                      setExpandedQ(expandedQ === q.number ? null : q.number)
                    }
                    className="w-full flex items-start gap-3 p-4 text-left hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <span className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      {q.number}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {q.question}
                      </p>
                      {q.answer && expandedQ !== q.number && (
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          {t("Answer generated")}
                        </p>
                      )}
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 text-slate-400 transition-transform shrink-0 mt-1 ${expandedQ === q.number ? "rotate-90" : ""
                        }`}
                    />
                  </button>

                  {/* Expanded content */}
                  {expandedQ === q.number && (
                    <div className="px-4 pb-4 border-t border-slate-200 dark:border-slate-600">
                      {/* Answer section */}
                      {q.answerLoading ? (
                        <div className="flex items-center gap-2 py-6 justify-center text-sm text-slate-400 dark:text-slate-500">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {t("Generating personalized answer...")}
                        </div>
                      ) : q.answer ? (
                        <div className="mt-4">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Award className="w-4 h-4 text-emerald-500" />
                            <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                              {t("Suggested Answer")}
                            </h4>
                            {q.usedResume && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded text-[10px] font-medium">
                                <Database className="w-2.5 h-2.5" />
                                {t("Resume")}
                              </span>
                            )}
                            {q.usedWebSearch && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded text-[10px] font-medium">
                                <Globe className="w-2.5 h-2.5" />
                                {t("Web Search")}
                              </span>
                            )}
                          </div>
                          <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                            <div className="prose prose-sm prose-slate dark:prose-invert max-w-none">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {q.answer}
                              </ReactMarkdown>
                            </div>
                          </div>
                        </div>
                      ) : q.answerError ? (
                        <div className="mt-4 flex items-center gap-2 text-sm text-red-500">
                          <AlertCircle className="w-4 h-4" />
                          {q.answerError}
                        </div>
                      ) : (
                        <div className="mt-4 flex items-center gap-3">
                          <button
                            onClick={() => handleGenerateAnswer(idx)}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-medium hover:bg-purple-700 transition-colors shadow-sm"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            {t("Generate Answer")}
                            {selectedKb && (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-500/30 rounded text-[10px]">
                                <Database className="w-2.5 h-2.5" />
                                {t("Resume")}
                              </span>
                            )}
                          </button>
                          <span className="text-xs text-slate-400 dark:text-slate-500">
                            {selectedKb
                              ? t("Answer will be personalized based on your resume")
                              : t("Upload your resume in My Portfolio for personalized answers")}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 mb-4 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center">
                <MessageSquare className="w-8 h-8 text-purple-500 dark:text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
                {t("Prepare for Your Next Interview")}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                {t("Select a job from your Interested Jobs boards, choose a difficulty level, and generate tailored interview questions. Use your resume to get personalized answers.")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
