"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  Loader2,
  Sparkles,
  Database,
  Globe,
  Target,
  ChevronRight,
  TrendingUp,
  MapPin,
  DollarSign,
  Building2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Compass,
  Search,
  ExternalLink,
  Tag,
  Heart,
  Plus,
  X,
  Check,
  FolderOpen,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "katex/dist/katex.min.css";
import { apiUrl } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useGlobal } from "@/context/GlobalContext";

// Types
interface KBInfo {
  name: string;
}

interface RealJob {
  title: string;
  company: string;
  location: string;
  salary?: string;
  snippet?: string;
  date_posted?: string;
  url: string;
  source: string; // "Indeed" | "LinkedIn"
  job_id?: string;
}

interface JobSuggestion {
  number: number;
  title: string;
  company: string;
  location: string;
  source: string;
  url: string;
  matchScore: string;
  rawMarkdown: string;
  detailAnalysis?: string;
  detailLoading?: boolean;
  detailError?: string;
  usedPortfolio?: boolean;
  usedWebSearch?: boolean;
  // Linked real job data (from scrapers)
  realJobUrl?: string;
  realJobSource?: string;
  realJobId?: string;
  salary?: string;
  snippet?: string;
}

interface JobBoardSummary {
  id: string;
  name: string;
  description: string;
  created_at: number;
  updated_at: number;
  job_count: number;
  color: string;
  icon: string;
}

const BOARD_COLORS = [
  "#8B5CF6", "#3B82F6", "#EC4899", "#EF4444", "#F97316",
  "#EAB308", "#22C55E", "#14B8A6", "#06B6D4", "#6366F1",
];

const EXPERIENCE_LEVELS = [
  { value: "", label: "Any" },
  { value: "entry", label: "Entry Level" },
  { value: "mid", label: "Mid Level" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead / Principal" },
];

const SUGGESTION_COUNTS = [3, 5, 8, 10];

/**
 * Parse the LLM-ranked markdown response into individual job suggestion objects.
 * Cross-references with realJobs to get correct URLs and metadata.
 * Expects format: ### 1. Job Title at Company
 */
function parseSuggestions(raw: string, realJobs: RealJob[] = []): JobSuggestion[] {
  const suggestions: JobSuggestion[] = [];

  // Split by numbered headings: ### 1. ..., ### 2. ..., etc.
  const sections = raw.split(/(?=###\s*\d+\.\s)/);

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    // Extract number and title from heading
    // Handles: ### 1. Job Title at Company   OR   ### 1. Job Title
    const headingMatch = trimmed.match(/###\s*(\d+)\.\s*(.+?)(?:\n|$)/);
    if (!headingMatch) continue;

    const number = parseInt(headingMatch[1]);
    const fullTitle = headingMatch[2].trim();

    // Try to split "Job Title at Company"
    const atMatch = fullTitle.match(/^(.+?)\s+at\s+(.+)$/i);
    const title = atMatch ? atMatch[1].trim() : fullTitle;
    const company = atMatch ? atMatch[2].trim() : "";

    // Extract location
    const locationMatch = trimmed.match(
      /\*\*Location:\*\*\s*(.+?)(?:\n|$)/
    );
    const location = locationMatch ? locationMatch[1].trim() : "";

    // Extract source (Indeed / LinkedIn)
    const sourceMatch = trimmed.match(
      /\*\*Source:\*\*\s*(.+?)(?:\n|$)/
    );
    const source = sourceMatch ? sourceMatch[1].trim() : "";

    // Extract URL from markdown (may be unreliable)
    const urlMatch = trimmed.match(
      /\*\*URL:\*\*\s*\[?\s*(https?:\/\/[^\s\]>)]+)/
    );
    let url = urlMatch ? urlMatch[1].trim() : "";

    // Extract match score
    const scoreMatch = trimmed.match(
      /\*\*Match Score:\*\*\s*(.+?)(?:\n|$)/
    );
    const matchScore = scoreMatch ? scoreMatch[1].trim() : "";

    // Cross-reference with realJobs to get reliable URL and extra data
    const matched = findMatchingRealJob(title, company, source, realJobs);

    suggestions.push({
      number,
      title: matched?.title || title,
      company: matched?.company || company,
      location: matched?.location || location,
      source: matched?.source || source,
      url: matched?.url && matched.url !== "N/A" ? matched.url : url,
      matchScore,
      rawMarkdown: trimmed,
      // Store real job data for board integration
      realJobUrl: matched?.url && matched.url !== "N/A" ? matched.url : url,
      realJobSource: matched?.source || source,
      realJobId: matched?.job_id || "",
      salary: matched?.salary || "",
      snippet: matched?.snippet || "",
    });
  }

  return suggestions;
}

/**
 * Find the best matching real job for a parsed suggestion.
 * Matches by title+company similarity (case-insensitive, partial match).
 */
function findMatchingRealJob(
  title: string,
  company: string,
  source: string,
  realJobs: RealJob[]
): RealJob | null {
  if (!realJobs.length) return null;

  const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, "").trim();
  const nTitle = normalize(title);
  const nCompany = normalize(company);

  // Score each real job by how well it matches
  let bestScore = 0;
  let bestJob: RealJob | null = null;

  for (const job of realJobs) {
    let score = 0;
    const jTitle = normalize(job.title);
    const jCompany = normalize(job.company);

    // Exact title match
    if (jTitle === nTitle) score += 10;
    // Title contains or is contained
    else if (jTitle.includes(nTitle) || nTitle.includes(jTitle)) score += 7;
    // Word overlap in title
    else {
      const titleWords = nTitle.split(/\s+/);
      const jobTitleWords = jTitle.split(/\s+/);
      const overlap = titleWords.filter((w) => jobTitleWords.includes(w)).length;
      score += Math.min(overlap * 2, 6);
    }

    // Company match
    if (nCompany && jCompany) {
      if (jCompany === nCompany) score += 5;
      else if (jCompany.includes(nCompany) || nCompany.includes(jCompany)) score += 3;
    }

    // Source match bonus
    if (source && job.source && normalize(source) === normalize(job.source)) {
      score += 1;
    }

    if (score > bestScore) {
      bestScore = score;
      bestJob = job;
    }
  }

  // Only return if we have a reasonable match (at least partial title match)
  return bestScore >= 4 ? bestJob : null;
}

/**
 * Badge color for job source
 */
function sourceColor(source: string) {
  const s = source.toLowerCase();
  if (s.includes("indeed"))
    return "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400";
  if (s.includes("linkedin"))
    return "bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400";
  return "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400";
}

export default function JobSuggestPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation();
  const { pageSettings } = useGlobal();
  const { trackEvent } = useAnalytics();

  useEffect(() => {
    // Only check SSO after pageSettings have been loaded from backend
    // If pageSettings is undefined, we're still loading, so don't redirect yet
    if (pageSettings !== undefined) {
      const requireSSO = pageSettings["/job-suggest"]?.requireSSO ?? false;
      if (requireSSO && status === "unauthenticated") {
        router.push("/auth/signin");
      }
    }
  }, [status, router, pageSettings]);

  // Data
  const [kbs, setKbs] = useState<KBInfo[]>([]);
  const [selectedKb, setSelectedKb] = useState("");

  // Preferences
  const [roleType, setRoleType] = useState("");
  const [location, setLocation] = useState("");
  const [industry, setIndustry] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [suggestionCount, setSuggestionCount] = useState(5);

  // State
  const [suggestions, setSuggestions] = useState<JobSuggestion[]>([]);
  const [realJobs, setRealJobs] = useState<RealJob[]>([]);
  const [searchQueries, setSearchQueries] = useState<string[]>([]);
  const [rawSuggestions, setRawSuggestions] = useState("");
  const [generating, setGenerating] = useState(false);
  const [expandedJob, setExpandedJob] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [portfolioSummary, setPortfolioSummary] = useState("");
  const [usedPortfolio, setUsedPortfolio] = useState(false);
  const [usedJobSearch, setUsedJobSearch] = useState(false);
  const [jobCount, setJobCount] = useState(0);

  // Add-to-board state
  const [boards, setBoards] = useState<JobBoardSummary[]>([]);
  const [showAddToBoardModal, setShowAddToBoardModal] = useState(false);
  const [addToBoardJob, setAddToBoardJob] = useState<JobSuggestion | null>(null);
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const [addingToBoard, setAddingToBoard] = useState(false);
  const [addedToBoard, setAddedToBoard] = useState<Record<string, string>>({}); // jobNumber -> boardName
  const [showCreateBoardInline, setShowCreateBoardInline] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [newBoardColor, setNewBoardColor] = useState("#8B5CF6");
  const [creatingBoard, setCreatingBoard] = useState(false);

  const resultsRef = useRef<HTMLDivElement>(null);

  // Fetch KBs + boards on mount
  useEffect(() => {
    fetchKBs();
    fetchBoards();
  }, []);

  const fetchKBs = async () => {
    try {
      const res = await fetch(apiUrl("/api/v1/portfolio/list"));
      const data = await res.json();
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

  const fetchBoards = async () => {
    try {
      const res = await fetch(apiUrl("/api/v1/jobs/list"));
      const data = await res.json();
      setBoards(data.boards || []);
    } catch (err) {
      console.error("Failed to fetch job boards:", err);
    }
  };

  const openAddToBoardModal = (job: JobSuggestion) => {
    setAddToBoardJob(job);
    setSelectedBoardId(boards.length > 0 ? boards[0].id : "");
    setShowCreateBoardInline(false);
    setNewBoardName("");
    setShowAddToBoardModal(true);
    // Refresh boards list
    fetchBoards();
  };

  const handleAddToBoard = async () => {
    if (!addToBoardJob || !selectedBoardId) return;
    setAddingToBoard(true);
    try {
      // Step 1: Scrape full job description from the URL
      let scrapedDescription = "";
      let scrapedSalary = "";
      const jobUrl = addToBoardJob.realJobUrl || addToBoardJob.url;
      const jobSource = addToBoardJob.realJobSource || addToBoardJob.source;

      if (jobUrl) {
        try {
          const scrapeRes = await fetch(apiUrl("/api/v1/job-suggest/scrape-jd"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: jobUrl,
              source: jobSource,
            }),
          });
          const scrapeData = await scrapeRes.json();
          if (scrapeData.success && scrapeData.full_description) {
            scrapedDescription = scrapeData.full_description;
          }
          if (scrapeData.salary) {
            scrapedSalary = scrapeData.salary;
          }
        } catch (scrapeErr) {
          console.warn("JD scraping failed, adding without description:", scrapeErr);
        }
      }

      // Step 2: Add job to the selected board with scraped JD
      const res = await fetch(
        apiUrl(`/api/v1/jobs/${selectedBoardId}/jobs`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: addToBoardJob.title,
            company: addToBoardJob.company,
            description: scrapedDescription || addToBoardJob.snippet || addToBoardJob.rawMarkdown || "",
            location: addToBoardJob.location,
            url: jobUrl,
            salary_range: scrapedSalary || addToBoardJob.salary || "",
            status: "interested",
            notes: `Source: ${jobSource}${addToBoardJob.matchScore ? ` | Match: ${addToBoardJob.matchScore}` : ""}`,
            metadata: {
              source: jobSource,
              match_score: addToBoardJob.matchScore,
              from_job_suggest: true,
              scraped_jd: !!scrapedDescription,
            },
          }),
        }
      );
      const data = await res.json();
      if (data.success) {
        const boardName = boards.find((b) => b.id === selectedBoardId)?.name || "";
        setAddedToBoard((prev) => ({
          ...prev,
          [String(addToBoardJob.number)]: boardName,
        }));
        setShowAddToBoardModal(false);
        setAddToBoardJob(null);
        fetchBoards(); // refresh counts
      }
    } catch (err) {
      console.error("Failed to add job to board:", err);
    } finally {
      setAddingToBoard(false);
    }
  };

  const handleCreateBoardAndAdd = async () => {
    if (!newBoardName.trim()) return;
    setCreatingBoard(true);
    try {
      const res = await fetch(apiUrl("/api/v1/jobs/create"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newBoardName.trim(),
          description: "",
          color: newBoardColor,
        }),
      });
      const data = await res.json();
      if (data.success && data.board) {
        await fetchBoards();
        setSelectedBoardId(data.board.id);
        setShowCreateBoardInline(false);
        setNewBoardName("");
      }
    } catch (err) {
      console.error("Failed to create board:", err);
    } finally {
      setCreatingBoard(false);
    }
  };

  const saveSession = async (
    suggestionsText: string,
    sid: string | null = sessionId
  ) => {
    try {
      const res = await fetch(apiUrl("/api/v1/job-suggest/sessions/save"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sid,
          kb_name: selectedKb,
          preferences: {
            role_type: roleType,
            location,
            industry,
            experience_level: experienceLevel,
          },
          suggestions: suggestionsText,
          real_jobs: realJobs,
          search_queries: searchQueries,
          count: suggestionCount,
          portfolio_summary: portfolioSummary,
        }),
      });
      const data = await res.json();
      if (data.success && data.session_id) {
        setSessionId(data.session_id);
      }
    } catch (err) {
      console.error("Failed to save job suggestion session:", err);
    }
  };

  const handleGenerate = async () => {
    if (!selectedKb) return;

    setGenerating(true);
    setSuggestions([]);
    setRealJobs([]);
    setSearchQueries([]);
    setRawSuggestions("");
    setExpandedJob(null);
    setSessionId(null);
    setPortfolioSummary("");
    setJobCount(0);

    try {
      const res = await fetch(apiUrl("/api/v1/job-suggest/suggest"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kb_name: selectedKb,
          count: suggestionCount,
          role_type: roleType,
          location,
          industry,
          experience_level: experienceLevel,
        }),
      });

      const data = await res.json();
      if (data.success && data.suggestions) {
        setRawSuggestions(data.suggestions);
        setPortfolioSummary(data.portfolio_summary || "");
        setUsedPortfolio(data.used_portfolio || false);
        setUsedJobSearch(data.used_job_search || false);
        setJobCount(data.job_count || 0);

        const fetchedRealJobs = data.real_jobs || [];
        if (fetchedRealJobs.length) setRealJobs(fetchedRealJobs);
        if (data.search_queries) setSearchQueries(data.search_queries);

        const parsed = parseSuggestions(data.suggestions, fetchedRealJobs);
        setSuggestions(parsed);

        // Auto-expand first suggestion
        if (parsed.length > 0) {
          setExpandedJob(parsed[0].number);
        }

        // Save session
        saveSession(data.suggestions, null);

        // Scroll to results
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 200);
      }
    } catch (err) {
      console.error("Failed to generate suggestions:", err);
    } finally {
      setGenerating(false);
    }
  };

  const handleGetDetail = async (idx: number) => {
    const job = suggestions[idx];
    if (!job) return;

    setSuggestions((prev) =>
      prev.map((item, i) =>
        i === idx
          ? { ...item, detailLoading: true, detailError: undefined }
          : item
      )
    );

    try {
      const res = await fetch(apiUrl("/api/v1/job-suggest/detail"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_title: job.title,
          company: job.company,
          company_type: "",
          job_url: job.url,
          job_description: "",
          kb_name: selectedKb,
          session_id: sessionId || "",
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuggestions((prev) =>
          prev.map((item, i) =>
            i === idx
              ? {
                ...item,
                detailAnalysis: data.analysis,
                detailLoading: false,
                usedPortfolio: data.used_portfolio,
                usedWebSearch: data.used_web_search,
              }
              : item
          )
        );
      } else {
        throw new Error(data.detail || "Failed to generate detail");
      }
    } catch (err: any) {
      setSuggestions((prev) =>
        prev.map((item, i) =>
          i === idx
            ? {
              ...item,
              detailLoading: false,
              detailError: err.message || "Failed",
            }
            : item
        )
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
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl text-white shadow-lg shadow-teal-500/20">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {t("Job Suggestions")}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t(
                  "Real jobs from Indeed & LinkedIn matched to your portfolio"
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Portfolio Selection */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col gap-3">
          <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-sm">
            <Database className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            {t("Your Portfolio")}
          </h2>

          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
              {t("Portfolio / Resume KB")}
            </label>
            <select
              value={selectedKb}
              onChange={(e) => setSelectedKb(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-teal-500/20"
            >
              <option value="">{t("Select a portfolio...")}</option>
              {kbs.map((kb) => (
                <option key={kb.name} value={kb.name}>
                  {kb.name}
                </option>
              ))}
            </select>
            {kbs.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                {t(
                  "No portfolios found. Upload your resume in My Portfolio first."
                )}
              </p>
            )}
          </div>
        </div>

        {/* Preferences */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col gap-3">
          <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-sm">
            <Target className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            {t("Preferences")}
            <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500">
              ({t("optional")})
            </span>
          </h2>

          {/* Desired Role */}
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Briefcase className="w-3 h-3" />
              {t("Desired Role")}
            </label>
            <input
              type="text"
              value={roleType}
              onChange={(e) => setRoleType(e.target.value)}
              placeholder={t("e.g. Software Engineer, Data Scientist...")}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-teal-500/20 placeholder:text-slate-400"
            />
          </div>

          {/* Location */}
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {t("Preferred Location")}
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t("e.g. Remote, San Francisco, New York...")}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-teal-500/20 placeholder:text-slate-400"
            />
          </div>

          {/* Industry */}
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              {t("Preferred Industry")}
            </label>
            <input
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder={t("e.g. AI/ML, FinTech, Healthcare...")}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-teal-500/20 placeholder:text-slate-400"
            />
          </div>

          {/* Experience Level */}
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
              {t("Experience Level")}
            </label>
            <div className="flex bg-slate-50 dark:bg-slate-700 p-1 rounded-lg border border-slate-200 dark:border-slate-600">
              {EXPERIENCE_LEVELS.map((l) => (
                <button
                  key={l.value}
                  onClick={() => setExperienceLevel(l.value)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${experienceLevel === l.value
                    ? "bg-white dark:bg-slate-600 text-teal-700 dark:text-teal-400 shadow-sm border border-slate-100 dark:border-slate-500"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                >
                  {t(l.label)}
                </button>
              ))}
            </div>
          </div>

          {/* Suggestion Count */}
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
              {t("Number of Suggestions")}
            </label>
            <select
              value={suggestionCount}
              onChange={(e) => setSuggestionCount(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-teal-500/20"
            >
              {SUGGESTION_COUNTS.map((n) => (
                <option key={n} value={n}>
                  {n} {t("suggestions")}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={!selectedKb || generating}
          className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-semibold shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t("Searching Jobs & Analyzing...")}
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              {t("Find Matching Jobs")}
            </>
          )}
        </button>

        {/* Search Queries Info */}
        {searchQueries.length > 0 && (
          <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
            <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Tag className="w-3 h-3" />
              {t("Search Queries Used")}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {searchQueries.map((q, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[11px] font-medium"
                >
                  {q}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT PANEL — Suggestions & Details */}
      <div className="flex-[2_1_67%] min-w-0 flex flex-col h-full overflow-hidden bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
        {/* Panel header */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between shrink-0">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            {usedJobSearch
              ? t("Real Job Matches")
              : t("Suggested Jobs")}
            {suggestions.length > 0 && (
              <span className="px-1.5 py-0.5 bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-full text-[10px] font-bold">
                {suggestions.length}
              </span>
            )}
          </div>
          {suggestions.length > 0 && (
            <div className="flex items-center gap-2">
              {usedPortfolio && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-[10px] font-medium">
                  <Database className="w-2.5 h-2.5" />
                  {t("Portfolio")}
                </span>
              )}
              {usedJobSearch && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg text-[10px] font-medium">
                  <Search className="w-2.5 h-2.5" />
                  {t("Indeed + LinkedIn")}
                  {jobCount > 0 && (
                    <span className="ml-0.5 text-[9px] opacity-75">
                      ({jobCount} {t("found")})
                    </span>
                  )}
                </span>
              )}
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
              >
                <RefreshCw className="w-3 h-3" />
                {t("Re-search")}
              </button>
            </div>
          )}
        </div>

        {/* Scrollable results */}
        <div ref={resultsRef} className="flex-1 overflow-y-auto p-4">
          {suggestions.length > 0 ? (
            <div className="space-y-3">
              {suggestions.map((job, idx) => (
                <div
                  key={job.number}
                  className="bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden transition-all"
                >
                  {/* Job header */}
                  <button
                    onClick={() =>
                      setExpandedJob(
                        expandedJob === job.number ? null : job.number
                      )
                    }
                    className="w-full flex items-start gap-3 p-4 text-left hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <span className="w-7 h-7 rounded-lg bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      {job.number}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {job.title}
                        </p>
                        {job.source && (
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${sourceColor(
                              job.source
                            )}`}
                          >
                            {job.source}
                          </span>
                        )}
                        {job.matchScore && (
                          <span className="inline-flex items-center px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded text-[10px] font-bold">
                            {job.matchScore}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {job.company && (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {job.company}
                          </span>
                        )}
                        {job.location && (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {job.location}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {addedToBoard[String(job.number)] && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded text-[10px] font-medium">
                            <Heart className="w-2.5 h-2.5 fill-current" />
                            {addedToBoard[String(job.number)]}
                          </span>
                        )}
                        {job.detailAnalysis &&
                          expandedJob !== job.number && (
                            <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              {t("Detail analysis available")}
                            </span>
                          )}
                      </div>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 text-slate-400 transition-transform shrink-0 mt-1 ${expandedJob === job.number ? "rotate-90" : ""
                        }`}
                    />
                  </button>

                  {/* Expanded content */}
                  {expandedJob === job.number && (
                    <div className="px-4 pb-4 border-t border-slate-200 dark:border-slate-600">
                      {/* Job analysis markdown */}
                      <div className="mt-3 p-4 bg-teal-50 dark:bg-teal-900/10 rounded-xl border border-teal-100 dark:border-teal-900/30">
                        <div className="prose prose-sm prose-slate dark:prose-invert max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {job.rawMarkdown}
                          </ReactMarkdown>
                        </div>
                      </div>

                      {/* Detail analysis section */}
                      {job.detailLoading ? (
                        <div className="flex items-center gap-2 py-6 justify-center text-sm text-slate-400 dark:text-slate-500">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {t("Generating detailed analysis...")}
                        </div>
                      ) : job.detailAnalysis ? (
                        <div className="mt-4">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Search className="w-4 h-4 text-blue-500" />
                            <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                              {t("Detailed Analysis")}
                            </h4>
                            {job.usedPortfolio && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded text-[10px] font-medium">
                                <Database className="w-2.5 h-2.5" />
                                {t("Portfolio")}
                              </span>
                            )}
                            {job.usedWebSearch && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded text-[10px] font-medium">
                                <Globe className="w-2.5 h-2.5" />
                                {t("Web Search")}
                              </span>
                            )}
                          </div>
                          <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30">
                            <div className="prose prose-sm prose-slate dark:prose-invert max-w-none">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {job.detailAnalysis}
                              </ReactMarkdown>
                            </div>
                          </div>
                        </div>
                      ) : job.detailError ? (
                        <div className="mt-4 flex items-center gap-2 text-sm text-red-500">
                          <AlertCircle className="w-4 h-4" />
                          {job.detailError}
                        </div>
                      ) : null}

                      {/* Action buttons row — Get Detail + Add to Board */}
                      <div className="mt-4 flex items-center gap-3 flex-wrap">
                        {addedToBoard[String(job.number)] ? (
                          <span className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-700 rounded-xl text-xs font-medium">
                            <Heart className="w-3.5 h-3.5 fill-current" />
                            {t("Saved to")} {addedToBoard[String(job.number)]}
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openAddToBoardModal(job);
                            }}
                            className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-xl text-xs font-medium hover:bg-purple-700 transition-all shadow-sm"
                          >
                            <Heart className="w-3.5 h-3.5" />
                            {t("Add to Job Board")}
                          </button>
                        )}
                        {!job.detailAnalysis && !job.detailLoading && !job.detailError && (
                          <button
                            onClick={() => handleGetDetail(idx)}
                            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-medium hover:bg-teal-700 transition-colors shadow-sm"
                          >
                            <Search className="w-3.5 h-3.5" />
                            {t("Get Detailed Analysis")}
                            {selectedKb && (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-teal-500/30 rounded text-[10px]">
                                <Database className="w-0.5 h-0.5" />
                                {t("Portfolio")}
                              </span>
                            )}
                          </button>
                        )}

                        {!job.detailAnalysis && !job.detailLoading && !job.detailError && (
                          <span className="text-xs text-slate-400 dark:text-slate-500">
                            {t("Match score, strengths, gaps, prep tips & more")}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 mb-4 bg-teal-100 dark:bg-teal-900/30 rounded-2xl flex items-center justify-center">
                <Compass className="w-8 h-8 text-teal-500 dark:text-teal-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
                {t("Discover Your Next Opportunity")}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-4">
                {t(
                  "Select your portfolio, set your preferences, and we'll search Indeed & LinkedIn for real jobs that match your skills."
                )}
              </p>
              <div className="flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" />
                  {t("Portfolio RAG")}
                </span>
                <span className="text-slate-300 dark:text-slate-600">→</span>
                <span className="flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5" />
                  {t("Indeed + LinkedIn")}
                </span>
                <span className="text-slate-300 dark:text-slate-600">→</span>
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {t("AI Analysis")}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add to Board Modal */}
      {showAddToBoardModal && addToBoardJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-[440px] animate-in zoom-in-95">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Heart className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                {t("Add to Job Board")}
              </h3>
              <button
                onClick={() => {
                  setShowAddToBoardModal(false);
                  setAddToBoardJob(null);
                }}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              </button>
            </div>

            {/* Job preview */}
            <div className="p-4 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {addToBoardJob.title}
              </p>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {addToBoardJob.company && (
                  <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {addToBoardJob.company}
                  </span>
                )}
                {addToBoardJob.location && (
                  <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {addToBoardJob.location}
                  </span>
                )}
                {addToBoardJob.source && (
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${sourceColor(addToBoardJob.source)}`}>
                    {addToBoardJob.source}
                  </span>
                )}
              </div>
              {(addToBoardJob.realJobUrl || addToBoardJob.url) && (
                <div className="mt-2 flex items-center gap-1.5">
                  <ExternalLink className="w-3 h-3 text-blue-500 shrink-0" />
                  <a
                    href={addToBoardJob.realJobUrl || addToBoardJob.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline truncate"
                  >
                    {addToBoardJob.realJobUrl || addToBoardJob.url}
                  </a>
                </div>
              )}
            </div>

            {/* Board selection */}
            <div className="p-4 space-y-3">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t("Select Job Board")}
              </label>

              {boards.length === 0 && !showCreateBoardInline ? (
                <div className="text-center py-4">
                  <FolderOpen className="w-10 h-10 text-slate-200 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                    {t("No job boards yet")}
                  </p>
                  <button
                    onClick={() => setShowCreateBoardInline(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t("Create Your First Board")}
                  </button>
                </div>
              ) : (
                <>
                  {/* Board list */}
                  <div className="max-h-[200px] overflow-y-auto space-y-1.5 rounded-lg border border-slate-200 dark:border-slate-600 p-1.5">
                    {boards.map((board) => (
                      <button
                        key={board.id}
                        onClick={() => setSelectedBoardId(board.id)}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all ${selectedBoardId === board.id
                          ? "bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700"
                          : "hover:bg-slate-50 dark:hover:bg-slate-700/50 border border-transparent"
                          }`}
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: `${board.color}20`,
                            color: board.color,
                          }}
                        >
                          <Briefcase className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                            {board.name}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">
                            {board.job_count} {t("jobs")}
                          </p>
                        </div>
                        {selectedBoardId === board.id && (
                          <Check className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Create new board inline */}
                  {!showCreateBoardInline ? (
                    <button
                      onClick={() => setShowCreateBoardInline(true)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors border border-dashed border-purple-300 dark:border-purple-700"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {t("Create New Board")}
                    </button>
                  ) : (
                    <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600 space-y-2">
                      <input
                        type="text"
                        value={newBoardName}
                        onChange={(e) => setNewBoardName(e.target.value)}
                        placeholder={t("Board name...")}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                        autoFocus
                      />
                      <div className="flex gap-1.5 flex-wrap">
                        {BOARD_COLORS.map((color) => (
                          <button
                            key={color}
                            onClick={() => setNewBoardColor(color)}
                            className={`w-6 h-6 rounded-md transition-all ${newBoardColor === color
                              ? "ring-2 ring-offset-1 ring-slate-400 dark:ring-slate-500 dark:ring-offset-slate-800 scale-110"
                              : ""
                              }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleCreateBoardAndAdd}
                          disabled={!newBoardName.trim() || creatingBoard}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
                        >
                          {creatingBoard ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Plus className="w-3 h-3" />
                          )}
                          {t("Create")}
                        </button>
                        <button
                          onClick={() => {
                            setShowCreateBoardInline(false);
                            setNewBoardName("");
                          }}
                          className="px-3 py-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg text-xs transition-colors"
                        >
                          {t("Cancel")}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowAddToBoardModal(false);
                  setAddToBoardJob(null);
                }}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-sm"
              >
                {t("Cancel")}
              </button>
              <button
                onClick={handleAddToBoard}
                disabled={!selectedBoardId || addingToBoard}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
              >
                {addingToBoard ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("Scraping JD & Adding...")}
                  </>
                ) : (
                  <>
                    <Heart className="w-4 h-4" />
                    {t("Add to Board")}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
