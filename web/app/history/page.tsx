"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  History,
  Clock,
  ChevronRight,
  Calculator,
  FileText,
  Microscope,
  MessageCircle,
  Filter,
  Search,
  Calendar,
  X,
  MessageSquare,
  Loader2,
  Eye,
  Briefcase,
  Award,
  Compass,
  MapPin,
  Database,
  FileEdit,
  Wand2,
} from "lucide-react";
import { apiUrl } from "@/lib/api";
import { formatDate } from "@/lib/datetime";
import { useGlobal } from "@/context/GlobalContext";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ActivityDetail from "@/components/ActivityDetail";
import ChatSessionDetail from "@/components/ChatSessionDetail";
import { useAnalytics } from "@/hooks/useAnalytics";

interface HistoryEntry {
  id: string;
  type: "question" | "research" | "chat";
  title: string;
  summary: string;
  timestamp: number;
  content: any;
}

const TYPE_CONFIG = {
  question: {
    icon: FileText,
    color: "purple",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    textColor: "text-purple-600 dark:text-purple-400",
  },
  research: {
    icon: Microscope,
    color: "emerald",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    textColor: "text-emerald-600 dark:text-emerald-400",
  },
  chat: {
    icon: MessageCircle,
    color: "amber",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    textColor: "text-amber-600 dark:text-amber-400",
  },
};

// Chat session interface
interface ChatSession {
  session_id: string;
  title: string;
  message_count: number;
  last_message: string;
  created_at: number;
  updated_at: number;
}

// Interview session interface
interface InterviewSession {
  session_id: string;
  job_title: string;
  company: string;
  level: string;
  question_count: number;
  answered_count: number;
  kb_name: string;
  created_at: number;
  updated_at: number;
}

// Job Suggest session interface
interface JobSuggestSession {
  session_id: string;
  kb_name: string;
  preferences: {
    role_type?: string;
    location?: string;
    industry?: string;
    experience_level?: string;
  };
  suggestion_count: number;
  detail_count: number;
  suggestions?: string;
  details?: Record<string, { analysis: string; generated_at: number }>;
  created_at: number;
  updated_at: number;
}

// Resume Writer operation interface
interface ResumeWriterOperation {
  id: string;
  timestamp: string;
  action: "rewrite" | "shorten" | "expand" | "auto_mark";
  source?: string;
  kb_name?: string;
  input: {
    original_text: string;
    instruction?: string;
  };
  output: {
    edited_text?: string;
    marked_text?: string;
  };
  tool_call_file?: string;
  model?: string;
}

export default function HistoryPage() {
  const { uiSettings, loadChatSession } = useGlobal();
  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const router = useRouter();

  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [interviewSessions, setInterviewSessions] = useState<InterviewSession[]>([]);
  const [jobSuggestSessions, setJobSuggestSessions] = useState<JobSuggestSession[]>([]);
  const [resumeWriterOperations, setResumeWriterOperations] = useState<ResumeWriterOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const [selectedChatSession, setSelectedChatSession] = useState<string | null>(
    null,
  );
  const [selectedInterviewSession, setSelectedInterviewSession] = useState<string | null>(null);
  const [interviewDetail, setInterviewDetail] = useState<any | null>(null);
  const [selectedJobSuggestSession, setSelectedJobSuggestSession] = useState<string | null>(null);
  const [jobSuggestDetail, setJobSuggestDetail] = useState<JobSuggestSession | null>(null);
  const [selectedResumeOperation, setSelectedResumeOperation] = useState<string | null>(null);
  const [resumeOperationDetail, setResumeOperationDetail] = useState<ResumeWriterOperation | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch regular activity history
      if (
        filterType === "all" ||
        (filterType !== "chat" && filterType !== "interview" && filterType !== "job-suggest" && filterType !== "resume-writer")
      ) {
        const typeParam = filterType !== "all" ? `&type=${filterType}` : "";
        const res = await fetch(
          apiUrl(`/api/v1/dashboard/recent?limit=50${typeParam}`),
        );
        const data = await res.json();
        setEntries(data);
      } else {
        setEntries([]);
      }

      // Fetch chat sessions
      if (filterType === "all" || filterType === "chat") {
        try {
          const sessionsRes = await fetch(
            apiUrl("/api/v1/chat/sessions?limit=20"),
          );
          const sessionsData = await sessionsRes.json();
          setChatSessions(sessionsData);
        } catch (err) {
          console.error("Failed to fetch chat sessions:", err);
          setChatSessions([]);
        }
      } else {
        setChatSessions([]);
      }

      // Fetch interview sessions
      if (filterType === "all" || filterType === "interview") {
        try {
          const interviewRes = await fetch(
            apiUrl("/api/v1/interview/sessions?limit=20"),
          );
          const interviewData = await interviewRes.json();
          setInterviewSessions(interviewData);
        } catch (err) {
          console.error("Failed to fetch interview sessions:", err);
          setInterviewSessions([]);
        }
      } else {
        setInterviewSessions([]);
      }

      // Fetch job suggest sessions
      if (filterType === "all" || filterType === "job-suggest") {
        try {
          const jobSuggestRes = await fetch(
            apiUrl("/api/v1/job-suggest/sessions?limit=20"),
          );
          const jobSuggestData = await jobSuggestRes.json();
          setJobSuggestSessions(jobSuggestData);
        } catch (err) {
          console.error("Failed to fetch job suggest sessions:", err);
          setJobSuggestSessions([]);
        }
      } else {
        setJobSuggestSessions([]);
      }

      // Fetch resume writer operations
      if (filterType === "all" || filterType === "resume-writer") {
        try {
          const resumeRes = await fetch(
            apiUrl("/api/v1/resume_writer/history"),
          );
          const resumeData = await resumeRes.json();
          setResumeWriterOperations(resumeData.history || []);
        } catch (err) {
          console.error("Failed to fetch resume writer operations:", err);
          setResumeWriterOperations([]);
        }
      } else {
        setResumeWriterOperations([]);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleLoadChatSession = async (sessionId: string) => {
    setLoadingSessionId(sessionId);
    try {
      await loadChatSession(sessionId);
      router.push("/chat");
    } catch (err) {
      console.error("Failed to load session:", err);
    } finally {
      setLoadingSessionId(null);
    }
  };

  const handleViewInterviewSession = async (sessionId: string) => {
    setSelectedInterviewSession(sessionId);
    try {
      const res = await fetch(apiUrl(`/api/v1/interview/sessions/${sessionId}`));
      const data = await res.json();
      setInterviewDetail(data);
    } catch (err) {
      console.error("Failed to fetch interview session:", err);
    }
  };

  const handleViewJobSuggestSession = async (sessionId: string) => {
    setSelectedJobSuggestSession(sessionId);
    try {
      const res = await fetch(apiUrl(`/api/v1/job-suggest/sessions/${sessionId}`));
      const data = await res.json();
      setJobSuggestDetail(data);
    } catch (err) {
      console.error("Failed to fetch job suggest session:", err);
    }
  };

  const handleViewResumeOperation = async (operationId: string) => {
    const operation = resumeWriterOperations.find(op => op.id === operationId);
    if (operation) {
      setSelectedResumeOperation(operationId);
      setResumeOperationDetail(operation);
    }
  };

  const filteredEntries = entries.filter((entry) => {
    // Exclude chat type - they are shown in dedicated Chat History section
    if (entry.type === "chat") return false;
    // Exclude question and research types
    if (entry.type === "question" || entry.type === "research") return false;

    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      entry.title.toLowerCase().includes(query) ||
      entry.summary?.toLowerCase().includes(query)
    );
  });

  const groupEntriesByDate = (entries: HistoryEntry[]) => {
    const groups: { [key: string]: HistoryEntry[] } = {};

    entries.forEach((entry) => {
      const date = new Date(entry.timestamp * 1000);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let dateKey: string;
      if (date.toDateString() === today.toDateString()) {
        dateKey = t("Today");
      } else if (date.toDateString() === yesterday.toDateString()) {
        dateKey = t("Yesterday");
      } else {
        dateKey = formatDate(date, uiSettings.language, {
          month: "long",
          day: "numeric",
          year:
            date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
        });
      }

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(entry);
    });

    return groups;
  };

  const groupedEntries = groupEntriesByDate(filteredEntries);

  return (
    <div className="h-screen flex flex-col animate-fade-in p-6">
      {/* Header - Fixed */}
      <div className="shrink-0 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-3">
              <History className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              {t("History")}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2">
              {t("All Activities")}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mt-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={`${t("Search")}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-slate-100"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
              {[
                { value: "all", label: t("All") },
                { value: "chat", label: t("Career Chat") },
                { value: "interview", label: t("Interview Prep") },
                { value: "job-suggest", label: t("Job Search") },
                { value: "resume-writer", label: t("Resume Writer") },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    trackEvent({ action: "filter_history", feature: "/history", metadata: { filterType: option.value } });
                    setFilterType(option.value);
                  }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${filterType === option.value
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
        {/* Regular Activity History */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-400 dark:text-slate-500">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              {t("Loading")}...
            </div>
          ) : filteredEntries.length === 0 &&
            chatSessions.length === 0 &&
            interviewSessions.length === 0 &&
            jobSuggestSessions.length === 0 &&
            resumeWriterOperations.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <History className="w-8 h-8 text-slate-300 dark:text-slate-500" />
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-medium">
                {t("No history found")}
              </p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                {t("Your activities will appear here")}
              </p>
            </div>
          ) : filteredEntries.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {Object.entries(groupedEntries).map(([dateKey, dateEntries]) => (
                <div key={dateKey}>
                  {/* Date Header */}
                  <div className="px-5 py-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                      <Calendar className="w-4 h-4" />
                      {dateKey}
                    </div>
                  </div>

                  {/* Entries for this date */}
                  {dateEntries.map((entry) => {
                    const config = TYPE_CONFIG[entry.type] || TYPE_CONFIG.chat;
                    const IconComponent = config.icon;

                    return (
                      <div
                        key={entry.id}
                        onClick={() => {
                          trackEvent({ action: "view_history_entry", feature: "/history", metadata: { entryType: entry.type, entryId: entry.id } });
                          setSelectedEntry(entry);
                        }}
                        className="px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group cursor-pointer"
                      >
                        <div className="flex gap-4">
                          <div className="mt-0.5">
                            <div
                              className={`w-10 h-10 rounded-xl ${config.bgColor} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}
                            >
                              <IconComponent
                                className={`w-5 h-5 ${config.textColor}`}
                              />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                              <span
                                className={`text-xs font-bold uppercase tracking-wider ${config.textColor} mb-1`}
                              >
                                {entry.type}
                              </span>
                              <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(
                                  entry.timestamp * 1000,
                                ).toLocaleTimeString(
                                  uiSettings.language === "zh"
                                    ? "zh-CN"
                                    : "en-US",
                                  { hour: "2-digit", minute: "2-digit" },
                                )}
                              </span>
                            </div>
                            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate pr-4">
                              {entry.title}
                            </h3>
                            {entry.summary && (
                              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                                {entry.summary}
                              </p>
                            )}
                          </div>
                          <div className="self-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Chat Sessions Section */}
        {chatSessions.length > 0 &&
          (filterType === "all" || filterType === "chat") && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-amber-500" />
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                  {t("Career Chat")}
                </h2>
                <span className="text-xs text-slate-400 ml-auto">
                  {chatSessions.length}{" "}
                  {t(chatSessions.length === 1 ? "session" : "sessions")}
                </span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {chatSessions
                  .filter((session) => {
                    if (!searchQuery.trim()) return true;
                    const query = searchQuery.toLowerCase();
                    return (
                      session.title.toLowerCase().includes(query) ||
                      session.last_message?.toLowerCase().includes(query)
                    );
                  })
                  .map((session) => (
                    <div
                      key={session.session_id}
                      onClick={() => setSelectedChatSession(session.session_id)}
                      className="px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group cursor-pointer"
                    >
                      <div className="flex gap-4">
                        <div className="mt-0.5">
                          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                            <MessageCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">
                              {t("Chat")}
                            </span>
                            <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(
                                new Date(session.updated_at * 1000),
                                uiSettings.language,
                              )}
                            </span>
                          </div>
                          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate pr-4">
                            {session.title}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-slate-400 dark:text-slate-500">
                              {session.message_count} {t("messages")}
                            </span>
                            {session.last_message && (
                              <p className="text-sm text-slate-500 dark:text-slate-400 truncate flex-1">
                                {session.last_message}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="self-center flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedChatSession(session.session_id);
                            }}
                            className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {t("View")}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLoadChatSession(session.session_id);
                            }}
                            disabled={loadingSessionId === session.session_id}
                            className="px-3 py-1.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {loadingSessionId === session.session_id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <MessageSquare className="w-3.5 h-3.5" />
                            )}
                            {t("Continue")}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

        {/* Interview Prep Sessions Section */}
        {interviewSessions.length > 0 &&
          (filterType === "all" || filterType === "interview") && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-violet-500" />
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                  {t("Interview Prep")}
                </h2>
                <span className="text-xs text-slate-400 ml-auto">
                  {interviewSessions.length}{" "}
                  {t(interviewSessions.length === 1 ? "session" : "sessions")}
                </span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {interviewSessions
                  .filter((session) => {
                    if (!searchQuery.trim()) return true;
                    const query = searchQuery.toLowerCase();
                    return (
                      session.job_title.toLowerCase().includes(query) ||
                      session.company?.toLowerCase().includes(query)
                    );
                  })
                  .map((session) => (
                    <div
                      key={session.session_id}
                      onClick={() => handleViewInterviewSession(session.session_id)}
                      className="px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group cursor-pointer"
                    >
                      <div className="flex gap-4">
                        <div className="mt-0.5">
                          <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                            <Briefcase className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <span className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400 mb-1">
                              {t("Interview")}
                            </span>
                            <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(
                                new Date(session.updated_at * 1000),
                                uiSettings.language,
                              )}
                            </span>
                          </div>
                          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate pr-4">
                            {session.job_title}
                            {session.company && (
                              <span className="text-slate-500 dark:text-slate-400 font-normal">
                                {" "}— {session.company}
                              </span>
                            )}
                          </h3>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-slate-400 dark:text-slate-500">
                              {session.question_count} {t("questions")}
                            </span>
                            <span className="text-xs text-emerald-500">
                              {session.answered_count} {t("answered")}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${session.level === "easy"
                              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                              : session.level === "hard"
                                ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                                : "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                              }`}>
                              {t(session.level)}
                            </span>
                            {session.kb_name && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded font-medium flex items-center gap-0.5">
                                <Award className="w-2.5 h-2.5" />
                                {t("Resume")}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="self-center flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewInterviewSession(session.session_id);
                            }}
                            className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {t("View")}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

        {/* Job Search Sessions Section */}
        {jobSuggestSessions.length > 0 &&
          (filterType === "all" || filterType === "job-suggest") && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
                <Compass className="w-5 h-5 text-teal-500" />
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                  {t("Job Search")}
                </h2>
                <span className="text-xs text-slate-400 ml-auto">
                  {jobSuggestSessions.length}{" "}
                  {t(jobSuggestSessions.length === 1 ? "session" : "sessions")}
                </span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {jobSuggestSessions
                  .filter((session) => {
                    if (!searchQuery.trim()) return true;
                    const query = searchQuery.toLowerCase();
                    const prefs = session.preferences || {};
                    return (
                      (prefs.role_type || "").toLowerCase().includes(query) ||
                      (prefs.location || "").toLowerCase().includes(query) ||
                      (prefs.industry || "").toLowerCase().includes(query) ||
                      (session.kb_name || "").toLowerCase().includes(query)
                    );
                  })
                  .map((session) => {
                    const prefs = session.preferences || {};
                    // Build a descriptive title from preferences
                    const titleParts: string[] = [];
                    if (prefs.role_type) titleParts.push(prefs.role_type);
                    if (prefs.location) titleParts.push(`in ${prefs.location}`);
                    const title = titleParts.length > 0
                      ? titleParts.join(" ")
                      : t("Job Search");

                    return (
                      <div
                        key={session.session_id}
                        onClick={() => handleViewJobSuggestSession(session.session_id)}
                        className="px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group cursor-pointer"
                      >
                        <div className="flex gap-4">
                          <div className="mt-0.5">
                            <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                              <Compass className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                              <span className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-1">
                                {t("Job Search")}
                              </span>
                              <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDate(
                                  new Date(session.updated_at * 1000),
                                  uiSettings.language,
                                )}
                              </span>
                            </div>
                            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate pr-4">
                              {title}
                            </h3>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              <span className="text-xs text-slate-400 dark:text-slate-500">
                                {session.suggestion_count} {t("suggestions")}
                              </span>
                              {session.detail_count > 0 && (
                                <span className="text-xs text-emerald-500">
                                  {session.detail_count} {t("detailed")}
                                </span>
                              )}
                              {session.kb_name && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded font-medium flex items-center gap-0.5">
                                  <Database className="w-2.5 h-2.5" />
                                  {session.kb_name}
                                </span>
                              )}
                              {prefs.industry && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded font-medium">
                                  {prefs.industry}
                                </span>
                              )}
                              {prefs.experience_level && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded font-medium capitalize">
                                  {prefs.experience_level}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="self-center flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewJobSuggestSession(session.session_id);
                              }}
                              className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center gap-1.5"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              {t("View")}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

        {/* Resume Writer Operations Section */}
        {resumeWriterOperations.length > 0 &&
          (filterType === "all" || filterType === "resume-writer") && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
                <FileEdit className="w-5 h-5 text-indigo-500" />
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                  {t("Resume Writer")}
                </h2>
                <span className="text-xs text-slate-400 ml-auto">
                  {resumeWriterOperations.length}{" "}
                  {t(resumeWriterOperations.length === 1 ? "operation" : "operations")}
                </span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {resumeWriterOperations
                  .filter((operation) => {
                    if (!searchQuery.trim()) return true;
                    const query = searchQuery.toLowerCase();
                    return (
                      operation.action.toLowerCase().includes(query) ||
                      operation.input.instruction?.toLowerCase().includes(query) ||
                      operation.input.original_text.toLowerCase().includes(query)
                    );
                  })
                  .map((operation) => (
                    <div
                      key={operation.id}
                      onClick={() => handleViewResumeOperation(operation.id)}
                      className="px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group cursor-pointer"
                    >
                      <div className="flex gap-4">
                        <div className="mt-0.5">
                          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                            {operation.action === "auto_mark" ? (
                              <Wand2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                            ) : (
                              <FileEdit className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                            )}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">
                              {operation.action === "auto_mark" ? t("Auto Mark") : t(operation.action)}
                            </span>
                            <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(
                                new Date(operation.timestamp),
                                uiSettings.language,
                              )}
                            </span>
                          </div>
                          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate pr-4">
                            {operation.input.instruction || t("Text editing")}
                          </h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                            {operation.input.original_text.substring(0, 150)}...
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            {operation.source && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded font-medium">
                                {operation.source === "rag" ? t("Resume") : t("Web")}
                              </span>
                            )}
                            {operation.kb_name && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded font-medium flex items-center gap-0.5">
                                <Database className="w-2.5 h-2.5" />
                                {operation.kb_name}
                              </span>
                            )}
                            {operation.model && (
                              <span className="text-xs text-slate-400 dark:text-slate-500">
                                {operation.model}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="self-center flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewResumeOperation(operation.id);
                            }}
                            className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {t("View")}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
      </div>

      {/* Activity Detail Modal */}
      {selectedEntry && (
        <ActivityDetail
          activity={selectedEntry}
          onClose={() => setSelectedEntry(null)}
        />
      )}

      {/* Chat Session Detail Modal */}
      {selectedChatSession && (
        <ChatSessionDetail
          sessionId={selectedChatSession}
          onClose={() => setSelectedChatSession(null)}
          onContinue={() => {
            handleLoadChatSession(selectedChatSession);
            setSelectedChatSession(null);
          }}
        />
      )}

      {/* Interview Session Detail Modal */}
      {selectedInterviewSession && interviewDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl max-h-[85vh] flex flex-col mx-4">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 dark:text-slate-100">
                    {interviewDetail.job_title}
                    {interviewDetail.company && ` — ${interviewDetail.company}`}
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${interviewDetail.level === "easy"
                      ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                      : interviewDetail.level === "hard"
                        ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                        : "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                      }`}>
                      {interviewDetail.level}
                    </span>
                    <span className="text-xs text-slate-400">
                      {interviewDetail.questions?.length || 0} {t("questions")}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedInterviewSession(null);
                  setInterviewDetail(null);
                }}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Questions list */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {(interviewDetail.questions || []).map((q: any, idx: number) => (
                <div
                  key={idx}
                  className="bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600 p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-lg bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 flex items-center justify-center text-xs font-bold shrink-0">
                      {q.number || idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {q.question}
                      </p>
                      {q.answer && (
                        <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Award className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                              {t("Suggested Answer")}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                            {q.answer}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Job Suggest Session Detail Modal */}
      {selectedJobSuggestSession && jobSuggestDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-3xl max-h-[85vh] flex flex-col mx-4">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                  <Compass className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 dark:text-slate-100">
                    {t("Job Search Results")}
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {jobSuggestDetail.preferences?.role_type && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded font-medium flex items-center gap-0.5">
                        <Briefcase className="w-2.5 h-2.5" />
                        {jobSuggestDetail.preferences.role_type}
                      </span>
                    )}
                    {jobSuggestDetail.preferences?.location && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded font-medium flex items-center gap-0.5">
                        <MapPin className="w-2.5 h-2.5" />
                        {jobSuggestDetail.preferences.location}
                      </span>
                    )}
                    {jobSuggestDetail.kb_name && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded font-medium flex items-center gap-0.5">
                        <Database className="w-2.5 h-2.5" />
                        {jobSuggestDetail.kb_name}
                      </span>
                    )}
                    <span className="text-xs text-slate-400">
                      {formatDate(
                        new Date((jobSuggestDetail.created_at || 0) * 1000),
                        uiSettings.language,
                      )}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedJobSuggestSession(null);
                  setJobSuggestDetail(null);
                }}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Suggestions content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Main suggestions markdown */}
              {jobSuggestDetail.suggestions && (
                <div className="bg-teal-50 dark:bg-teal-900/10 rounded-xl border border-teal-100 dark:border-teal-900/30 p-5">
                  <div className="prose prose-sm prose-slate dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {jobSuggestDetail.suggestions}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              {/* Detail analyses if any */}
              {jobSuggestDetail.details && Object.keys(jobSuggestDetail.details).length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-2">
                    <Search className="w-4 h-4" />
                    {t("Detailed Analyses")}
                  </h3>
                  {Object.entries(jobSuggestDetail.details).map(([jobTitle, detail]: [string, any]) => (
                    <div
                      key={jobTitle}
                      className="bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30 p-4"
                    >
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                        {jobTitle}
                      </h4>
                      <div className="prose prose-sm prose-slate dark:prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {detail.analysis || ""}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* No content placeholder */}
              {!jobSuggestDetail.suggestions && (
                <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                  <Compass className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{t("No suggestions data available for this session.")}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Resume Writer Operation Detail Modal */}
      {selectedResumeOperation && resumeOperationDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-3xl max-h-[85vh] flex flex-col mx-4">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                  {resumeOperationDetail.action === "auto_mark" ? (
                    <Wand2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  ) : (
                    <FileEdit className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  )}
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 dark:text-slate-100">
                    {resumeOperationDetail.action === "auto_mark" ? t("Auto Mark") : t(resumeOperationDetail.action)}
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-400">
                      {formatDate(
                        new Date(resumeOperationDetail.timestamp),
                        uiSettings.language,
                      )}
                    </span>
                    {resumeOperationDetail.model && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded font-medium">
                        {resumeOperationDetail.model}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedResumeOperation(null);
                  setResumeOperationDetail(null);
                }}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Instruction */}
              {resumeOperationDetail.input.instruction && (
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      {t("Instruction")}
                    </span>
                  </div>
                  <p className="text-sm text-slate-900 dark:text-slate-100">
                    {resumeOperationDetail.input.instruction}
                  </p>
                </div>
              )}

              {/* Original Text */}
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    {t("Original Text")}
                  </span>
                </div>
                <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {resumeOperationDetail.input.original_text}
                </div>
              </div>

              {/* Output */}
              {(resumeOperationDetail.output.edited_text || resumeOperationDetail.output.marked_text) && (
                <div className="bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/30 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {resumeOperationDetail.action === "auto_mark" ? (
                      <Wand2 className="w-4 h-4 text-indigo-500" />
                    ) : (
                      <FileEdit className="w-4 h-4 text-indigo-500" />
                    )}
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                      {resumeOperationDetail.action === "auto_mark" ? t("Marked Text") : t("Edited Text")}
                    </span>
                  </div>
                  <div className="text-sm text-slate-900 dark:text-slate-100 whitespace-pre-wrap max-h-60 overflow-y-auto">
                    {resumeOperationDetail.output.edited_text || resumeOperationDetail.output.marked_text}
                  </div>
                </div>
              )}

              {/* Metadata */}
              {(resumeOperationDetail.source || resumeOperationDetail.kb_name) && (
                <div className="flex items-center gap-2">
                  {resumeOperationDetail.source && (
                    <span className="text-xs px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded font-medium">
                      {t("Source")}: {resumeOperationDetail.source === "rag" ? t("Resume") : t("Web")}
                    </span>
                  )}
                  {resumeOperationDetail.kb_name && (
                    <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded font-medium flex items-center gap-1">
                      <Database className="w-3 h-3" />
                      {resumeOperationDetail.kb_name}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
