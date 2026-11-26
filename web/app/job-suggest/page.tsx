"use client";

import { refreshJourney } from "@/lib/journey";

import PageHeader from "@/components/PageHeader";
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
  ChevronDown,
  FileText,
  RotateCcw,
  SlidersHorizontal,
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
  source: string; // where the listing was published, e.g. "LinkedIn", "Indeed", "Glassdoor"
  job_id?: string;
  description?: string; // full description (JSearch); empty for scraped listings
  source_key?: string; // linkedin | indeed | glassdoor | ziprecruiter | company | other
  employment_type?: string;
  is_remote?: boolean;
  apply_options?: { publisher: string; url: string }[];
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
  description?: string;
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

    // Cross-reference with realJobs to get reliable URL and extra data.
    // Prefer the listing number the AI cites; fall back to title/company matching.
    const listingMatch = trimmed.match(/\*\*Listing:\*\*\s*#?(\d+)/);
    const listingIdx = listingMatch ? parseInt(listingMatch[1]) - 1 : -1;
    const matched =
      listingIdx >= 0 && listingIdx < realJobs.length
        ? realJobs[listingIdx]
        : findMatchingRealJob(title, company, source, realJobs);

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
      description: matched?.description || "",
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

// Job sites the user can pick (empty selection = all sites)
const JOB_SITES = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "indeed", label: "Indeed" },
  { value: "glassdoor", label: "Glassdoor" },
  { value: "ziprecruiter", label: "ZipRecruiter" },
  { value: "company", label: "Company websites" },
  { value: "other", label: "Other job sites" },
];

/**
 * Badge color for job source
 */
function sourceColor(source: string) {
  const s = source.toLowerCase();
  if (s.includes("linkedin"))
    return "bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300";
  if (s.includes("indeed"))
    return "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300";
  if (s.includes("glassdoor"))
    return "bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300";
  if (s.includes("ziprecruiter"))
    return "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300";
  if (s.includes("career"))
    return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300";
  return "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300";
}

/* ---------- Search-panel form primitives ---------- */

const CONTROL_CLS =
  "w-full h-10 px-3 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-colors hover:border-slate-300 dark:hover:border-slate-500 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15";

function SectionTitle({
  icon: Icon,
  title,
  hint,
  badge,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
  badge?: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
        <Icon className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
        {title}
        {badge !== undefined && (
          <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 tabular-nums">
            {badge}
          </span>
        )}
        {hint && <span className="text-xs font-normal text-slate-400 dark:text-slate-500">{hint}</span>}
      </h2>
      {action}
    </div>
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block mb-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
      {children}
    </label>
  );
}

function IconInput({
  id,
  icon: Icon,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${CONTROL_CLS} pl-9`}
      />
    </div>
  );
}

function SelectBox({
  id,
  value,
  onChange,
  children,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${CONTROL_CLS} appearance-none pr-9 cursor-pointer`}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
    </div>
  );
}

function Chip({
  selected,
  onClick,
  role,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  role?: "radio";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={role ? selected : undefined}
      aria-pressed={role ? undefined : selected}
      onClick={onClick}
      className={`inline-flex items-center gap-1 h-8 px-3 rounded-lg border text-xs font-medium transition-colors ${selected
        ? "bg-indigo-50 dark:bg-indigo-500/15 border-indigo-500 dark:border-indigo-400 text-indigo-700 dark:text-indigo-300"
        : "bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-500 hover:text-slate-900 dark:hover:text-slate-100"}`}
    >
      {selected && role === undefined && <Check className="w-3 h-3" />}
      {children}
    </button>
  );
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
  const [datePosted, setDatePosted] = useState("month");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [jobSites, setJobSites] = useState<string[]>([]); // empty = all sites
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
  // Set when Indeed/LinkedIn returned nothing and results are AI-generated
  const [isFallback, setIsFallback] = useState(false);

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
      // JSearch listings already include the full description; only scrape when missing.
      let scrapedDescription = addToBoardJob.description || "";
      let scrapedSalary = addToBoardJob.salary && addToBoardJob.salary !== "Not listed" ? addToBoardJob.salary : "";
      const jobUrl = addToBoardJob.realJobUrl || addToBoardJob.url;
      const jobSource = addToBoardJob.realJobSource || addToBoardJob.source;

      if (jobUrl && !scrapedDescription) {
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
        refreshJourney();
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
        refreshJourney();
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
            date_posted: datePosted,
            remote_only: remoteOnly ? "true" : "",
            sources: jobSites.join(","),
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
          date_posted: datePosted,
          remote_only: remoteOnly,
          sources: jobSites,
        }),
      });

      const data = await res.json();
      if (data.success && data.suggestions) {
        setRawSuggestions(data.suggestions);
        setPortfolioSummary(data.portfolio_summary || "");
        setUsedPortfolio(data.used_portfolio || false);
        setUsedJobSearch(data.used_job_search || false);
        setJobCount(data.job_count || 0);
        setIsFallback(Boolean(data.fallback_reason));

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
          job_description: job.description || "",
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

  const activeFilterCount =
    (experienceLevel ? 1 : 0) +
    (datePosted !== "month" ? 1 : 0) +
    (remoteOnly ? 1 : 0) +
    (jobSites.length > 0 ? 1 : 0) +
    (suggestionCount !== 5 ? 1 : 0);

  const resetFilters = () => {
    setExperienceLevel("");
    setDatePosted("month");
    setRemoteOnly(false);
    setJobSites([]);
    setSuggestionCount(5);
  };

  return (
    <div className="min-h-full lg:h-full animate-fade-in flex flex-col lg:flex-row gap-4 p-3 sm:p-4">
      {/* LEFT PANEL — Search setup (stacks above results on small screens) */}
      <aside className="lg:flex-[1_1_33%] min-w-0 lg:min-w-[320px] lg:max-w-[420px] flex flex-col gap-4 lg:h-full lg:min-h-0">
        <PageHeader className="px-1 pt-1" icon={Compass} title={t("Job Suggestions")} description={t("Live jobs from LinkedIn, Indeed, Glassdoor and company sites, ranked against your CV.")} />

        <div className="lg:flex-1 lg:min-h-0 flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 lg:overflow-hidden">
          <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/70">
            {/* Résumé */}
            <section className="p-5 space-y-3">
              <SectionTitle icon={FileText} title={t("Résumé")} />
              <div>
                <FieldLabel htmlFor="js-portfolio">{t("Portfolio")}</FieldLabel>
                <SelectBox id="js-portfolio" value={selectedKb} onChange={setSelectedKb}>
                  <option value="">{t("Select a portfolio...")}</option>
                  {kbs.map((kb) => (
                    <option key={kb.name} value={kb.name}>
                      {kb.name}
                    </option>
                  ))}
                </SelectBox>
                {kbs.length === 0 && (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                    {t("No portfolios found.")}{" "}
                    <a href="/portfolio" className="font-medium underline underline-offset-2 hover:text-amber-800 dark:hover:text-amber-300">
                      {t("Upload your resume in My Portfolio")}
                    </a>
                  </p>
                )}
              </div>
            </section>

            {/* Target role */}
            <section className="p-5 space-y-4">
              <SectionTitle icon={Target} title={t("What you're looking for")} hint={t("All optional")} />
              <div>
                <FieldLabel htmlFor="js-role">{t("Desired role")}</FieldLabel>
                <IconInput id="js-role" icon={Briefcase} value={roleType} onChange={setRoleType} placeholder={t("e.g. Software Engineer, Data Scientist...")} />
              </div>
              <div>
                <FieldLabel htmlFor="js-location">{t("Location")}</FieldLabel>
                <IconInput id="js-location" icon={MapPin} value={location} onChange={setLocation} placeholder={t("e.g. Remote, San Francisco, New York...")} />
              </div>
              <div>
                <FieldLabel htmlFor="js-industry">{t("Industry")}</FieldLabel>
                <IconInput id="js-industry" icon={Building2} value={industry} onChange={setIndustry} placeholder={t("e.g. AI/ML, FinTech, Healthcare...")} />
              </div>
            </section>

            {/* Filters */}
            <section className="p-5 space-y-4">
              <SectionTitle
                icon={SlidersHorizontal}
                title={t("Filters")}
                badge={activeFilterCount > 0 ? activeFilterCount : undefined}
                action={
                  activeFilterCount > 0 ? (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      {t("Reset")}
                    </button>
                  ) : undefined
                }
              />

              <div>
                <FieldLabel>{t("Experience level")}</FieldLabel>
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("Experience level")}>
                  {EXPERIENCE_LEVELS.map((l) => (
                    <Chip
                      key={l.value}
                      role="radio"
                      selected={experienceLevel === l.value}
                      onClick={() => setExperienceLevel(l.value)}
                    >
                      {t(l.label)}
                    </Chip>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel htmlFor="js-posted">{t("Posted within")}</FieldLabel>
                  <SelectBox id="js-posted" value={datePosted} onChange={setDatePosted}>
                    <option value="today">{t("Last 24 hours")}</option>
                    <option value="3days">{t("Last 3 days")}</option>
                    <option value="week">{t("Last week")}</option>
                    <option value="month">{t("Last month")}</option>
                    <option value="all">{t("Any time")}</option>
                  </SelectBox>
                </div>
                <div>
                  <FieldLabel>{t("Work mode")}</FieldLabel>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={remoteOnly}
                    onClick={() => setRemoteOnly((v) => !v)}
                    className={`${CONTROL_CLS} flex items-center justify-between gap-2 text-left`}
                  >
                    <span className="whitespace-nowrap">{t("Remote only")}</span>
                    <span className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors ${remoteOnly ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-600"}`}>
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${remoteOnly ? "translate-x-4" : "translate-x-0.5"}`} />
                    </span>
                  </button>
                </div>
              </div>

              {/* Job sites (multi-select; none selected = all) */}
              <div>
                <FieldLabel>{t("Job sites")}</FieldLabel>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("Job sites")}>
                  <Chip selected={jobSites.length === 0} onClick={() => setJobSites([])}>
                    {t("All sites")}
                  </Chip>
                  {JOB_SITES.map((site) => {
                    const on = jobSites.includes(site.value);
                    return (
                      <Chip
                        key={site.value}
                        selected={on}
                        onClick={() =>
                          setJobSites((prev) => {
                            const next = on ? prev.filter((v) => v !== site.value) : [...prev, site.value];
                            return next.length === JOB_SITES.length ? [] : next;
                          })
                        }
                      >
                        {t(site.label)}
                      </Chip>
                    );
                  })}
                </div>
              </div>

              <div>
                <FieldLabel>{t("Number of results")}</FieldLabel>
                <div className="grid grid-cols-4 p-1 bg-slate-100 dark:bg-slate-900/50 rounded-lg" role="radiogroup" aria-label={t("Number of results")}>
                  {SUGGESTION_COUNTS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={suggestionCount === n}
                      onClick={() => setSuggestionCount(n)}
                      className={`h-8 rounded-md text-xs font-semibold tabular-nums transition-all ${suggestionCount === n
                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Search queries used */}
            {searchQueries.length > 0 && (
              <section className="p-5 space-y-2.5">
                <SectionTitle icon={Tag} title={t("Search queries used")} />
                <div className="flex flex-wrap gap-1.5">
                  {searchQueries.map((q, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md text-[11px] font-medium"
                    >
                      {q}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Footer — always visible: pinned to the card on desktop, to the viewport on mobile */}
          <div className="sticky bottom-0 lg:static z-10 shrink-0 p-4 border-t border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 backdrop-blur rounded-b-2xl">
            <button
              onClick={handleGenerate}
              disabled={!selectedKb || generating}
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl font-semibold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800"
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
            {!selectedKb && (
              <p className="mt-2 text-center text-[11px] text-slate-400 dark:text-slate-500">
                {t("Select a portfolio to start")}
              </p>
            )}
          </div>
        </div>
      </aside>

      {/* RIGHT PANEL — Suggestions & Details */}
      <div className="lg:flex-[2_1_67%] min-w-0 min-h-[480px] lg:min-h-0 flex flex-col lg:h-full overflow-hidden bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
        {/* Panel header */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between shrink-0">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            {usedJobSearch
              ? t("Real Job Matches")
              : t("Suggested Jobs")}
            {suggestions.length > 0 && (
              <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-[10px] font-bold">
                {suggestions.length}
              </span>
            )}
          </div>
          {suggestions.length > 0 && (
            <div className="flex items-center gap-2">
              {usedPortfolio && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-[10px] font-medium">
                  <Database className="w-2.5 h-2.5" />
                  {t("Portfolio")}
                </span>
              )}
              {usedJobSearch && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg text-[10px] font-medium">
                  <Search className="w-2.5 h-2.5" />
                  {t("Live jobs")}
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
          {isFallback && suggestions.length > 0 && (
            <div
              role="status"
              className="mb-3 flex items-start gap-2 p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-xs"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {t(
                  "No live listings matched this search. These are AI-generated role ideas based on your portfolio, not real job postings. Try a broader role, another location or a longer date range.",
                )}
              </span>
            </div>
          )}
          {suggestions.length > 0 && realJobs.length > 0 && !isFallback && (() => {
            const counts = new Map<string, number>();
            realJobs.forEach((j) => j.source && counts.set(j.source, (counts.get(j.source) || 0) + 1));
            const top = [...counts.entries()].sort((a, b) => b[1] - a[1]);
            return (
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                {t("Found on")}:{" "}
                {top.slice(0, 6).map(([src, n], i) => (
                  <span key={src}>
                    {i > 0 && " · "}
                    <span className="font-medium text-slate-700 dark:text-slate-300">{src}</span> {n}
                  </span>
                ))}
                {top.length > 6 && ` · +${top.length - 6}`}
              </p>
            );
          })()}
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
                    <span className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
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
                            {t("via")} {job.source}
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
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded text-[10px] font-medium">
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
                      <div className="mt-3 p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
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
                            <Search className="w-4 h-4 text-indigo-500" />
                            <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                              {t("Detailed Analysis")}
                            </h4>
                            {job.usedPortfolio && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded text-[10px] font-medium">
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
                          <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
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

                      {/* Action buttons row — Apply + Add to Board + Get Detail */}
                      <div className="mt-4 flex items-center gap-3 flex-wrap">
                        {(job.realJobUrl || job.url) && (job.realJobUrl || job.url) !== "N/A" && (
                          <a
                            href={job.realJobUrl || job.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-medium hover:border-indigo-400 transition-colors shadow-sm"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            {job.source ? `${t("Apply on")} ${job.source}` : t("Open job posting")}
                          </a>
                        )}
                        {addedToBoard[String(job.number)] ? (
                          <span className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700 rounded-xl text-xs font-medium">
                            <Heart className="w-3.5 h-3.5 fill-current" />
                            {t("Saved to")} {addedToBoard[String(job.number)]}
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openAddToBoardModal(job);
                            }}
                            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-medium hover:bg-indigo-700 transition-all shadow-sm"
                          >
                            <Heart className="w-3.5 h-3.5" />
                            {t("Add to Job Board")}
                          </button>
                        )}
                        {!job.detailAnalysis && !job.detailLoading && !job.detailError && (
                          <button
                            onClick={() => handleGetDetail(idx)}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                          >
                            <Search className="w-3.5 h-3.5" />
                            {t("Get Detailed Analysis")}
                            {selectedKb && (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-indigo-500/30 rounded text-[10px]">
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
              <div className="w-16 h-16 mb-4 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center">
                <Compass className="w-8 h-8 text-indigo-500 dark:text-indigo-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
                {t("Discover Your Next Opportunity")}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-4">
                {t(
                  "Select your portfolio, set your preferences, and we'll search live job listings and rank them against your skills."
                )}
              </p>
              <div className="flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" />
                  {t("Your CV")}
                </span>
                <span className="text-slate-300 dark:text-slate-600">→</span>
                <span className="flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5" />
                  {t("Live jobs")}
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
                <Heart className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
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
                  <ExternalLink className="w-3 h-3 text-indigo-500 shrink-0" />
                  <a
                    href={addToBoardJob.realJobUrl || addToBoardJob.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline truncate"
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors"
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
                          ? "bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700"
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
                          <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Create new board inline */}
                  {!showCreateBoardInline ? (
                    <button
                      onClick={() => setShowCreateBoardInline(true)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors border border-dashed border-indigo-300 dark:border-indigo-700"
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
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
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
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
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
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
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
