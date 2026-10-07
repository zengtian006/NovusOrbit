"use client";

import { useState, useEffect } from "react";

import {
  Briefcase,
  Plus,
  Trash2,
  Edit3,
  Search,
  Clock,
  ChevronRight,
  ChevronLeft,
  X,
  Check,
  FolderOpen,
  Maximize2,
  Minimize2,
  ExternalLink,
  MapPin,
  DollarSign,
  Building2,
  FileText,
  StickyNote,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "katex/dist/katex.min.css";
import { apiUrl } from "@/lib/api";
import { useTranslation } from "react-i18next";

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
  metadata: Record<string, any>;
  created_at: number;
  updated_at: number;
}

interface JobBoard {
  id: string;
  name: string;
  description: string;
  created_at: number;
  updated_at: number;
  jobs: JobEntry[];
  color: string;
  icon: string;
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

const COLORS = [
  "#8B5CF6", // purple
  "#3B82F6", // blue
  "#EC4899", // pink
  "#EF4444", // red
  "#F97316", // orange
  "#EAB308", // yellow
  "#22C55E", // green
  "#14B8A6", // teal
  "#06B6D4", // cyan
  "#6366F1", // indigo
];

const STATUS_OPTIONS = [
  { value: "interested", label: "Interested", color: "text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-900/30 dark:border-purple-700" },
  { value: "applied", label: "Applied", color: "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/30 dark:border-blue-700" },
  { value: "interviewing", label: "Interviewing", color: "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/30 dark:border-amber-700" },
  { value: "offered", label: "Offered", color: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/30 dark:border-emerald-700" },
  { value: "rejected", label: "Rejected", color: "text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/30 dark:border-red-700" },
  { value: "saved", label: "Saved", color: "text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-800 dark:border-slate-600" },
];

const getStatusStyle = (status: string) => {
  return STATUS_OPTIONS.find((s) => s.value === status)?.color || STATUS_OPTIONS[0].color;
};

const getStatusLabel = (status: string, t: (key: string) => string) => {
  const opt = STATUS_OPTIONS.find((s) => s.value === status);
  return opt ? t(opt.label) : t("Interested");
};

export default function JobsPage() {
  const { t } = useTranslation();
  const [boards, setBoards] = useState<JobBoardSummary[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<JobBoard | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Collapse states
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [middleCollapsed, setMiddleCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // Modal states
  const [showCreateBoardModal, setShowCreateBoardModal] = useState(false);
  const [showEditBoardModal, setShowEditBoardModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showAddJobModal, setShowAddJobModal] = useState(false);
  const [showEditJobModal, setShowEditJobModal] = useState(false);

  // Board form states
  const [newBoard, setNewBoard] = useState({
    name: "",
    description: "",
    color: "#8B5CF6",
  });
  const [editingBoard, setEditingBoard] = useState<{
    id: string;
    name: string;
    description: string;
    color: string;
  } | null>(null);

  // Job form states
  const [jobForm, setJobForm] = useState({
    title: "",
    company: "",
    description: "",
    location: "",
    url: "",
    salary_range: "",
    status: "interested",
    notes: "",
  });
  const [editingJob, setEditingJob] = useState<JobEntry | null>(null);

  // Fetch boards
  useEffect(() => {
    fetchBoards();
  }, []);

  const fetchBoards = async () => {
    try {
      const res = await fetch(apiUrl("/api/v1/jobs/list"));
      const data = await res.json();
      setBoards(data.boards || []);
    } catch (err) {
      console.error("Failed to fetch job boards:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBoardDetail = async (boardId: string) => {
    try {
      const res = await fetch(apiUrl(`/api/v1/jobs/${boardId}`));
      const data = await res.json();
      setSelectedBoard(data);
      setSelectedJob(null);
    } catch (err) {
      console.error("Failed to fetch board detail:", err);
    }
  };

  const handleCreateBoard = async () => {
    if (!newBoard.name.trim()) return;

    try {
      const res = await fetch(apiUrl("/api/v1/jobs/create"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBoard),
      });
      const data = await res.json();
      if (data.success) {
        fetchBoards();
        setShowCreateBoardModal(false);
        setNewBoard({ name: "", description: "", color: "#8B5CF6" });
      }
    } catch (err) {
      console.error("Failed to create board:", err);
    }
  };

  const handleUpdateBoard = async () => {
    if (!editingBoard || !editingBoard.name.trim()) return;

    try {
      const res = await fetch(apiUrl(`/api/v1/jobs/${editingBoard.id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingBoard.name,
          description: editingBoard.description,
          color: editingBoard.color,
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchBoards();
        if (selectedBoard?.id === editingBoard.id) {
          fetchBoardDetail(editingBoard.id);
        }
        setShowEditBoardModal(false);
        setEditingBoard(null);
      }
    } catch (err) {
      console.error("Failed to update board:", err);
    }
  };

  const handleDeleteBoard = async (boardId: string) => {
    try {
      const res = await fetch(apiUrl(`/api/v1/jobs/${boardId}`), {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        fetchBoards();
        if (selectedBoard?.id === boardId) {
          setSelectedBoard(null);
        }
        setShowDeleteConfirm(null);
      }
    } catch (err) {
      console.error("Failed to delete board:", err);
    }
  };

  const handleAddJob = async () => {
    if (!selectedBoard || !jobForm.title.trim() || !jobForm.company.trim()) return;

    try {
      const res = await fetch(apiUrl(`/api/v1/jobs/${selectedBoard.id}/jobs`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jobForm),
      });
      const data = await res.json();
      if (data.success) {
        fetchBoardDetail(selectedBoard.id);
        fetchBoards();
        setShowAddJobModal(false);
        setJobForm({
          title: "",
          company: "",
          description: "",
          location: "",
          url: "",
          salary_range: "",
          status: "interested",
          notes: "",
        });
      }
    } catch (err) {
      console.error("Failed to add job:", err);
    }
  };

  const handleUpdateJob = async () => {
    if (!selectedBoard || !editingJob) return;

    try {
      const res = await fetch(
        apiUrl(`/api/v1/jobs/${selectedBoard.id}/jobs/${editingJob.id}`),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editingJob.title,
            company: editingJob.company,
            description: editingJob.description,
            location: editingJob.location,
            url: editingJob.url,
            salary_range: editingJob.salary_range,
            status: editingJob.status,
            notes: editingJob.notes,
          }),
        }
      );
      const data = await res.json();
      if (data.success) {
        fetchBoardDetail(selectedBoard.id);
        setSelectedJob({ ...editingJob, ...data.job });
        setShowEditJobModal(false);
        setEditingJob(null);
      }
    } catch (err) {
      console.error("Failed to update job:", err);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!selectedBoard) return;

    try {
      const res = await fetch(
        apiUrl(`/api/v1/jobs/${selectedBoard.id}/jobs/${jobId}`),
        { method: "DELETE" }
      );
      const data = await res.json();
      if (data.success) {
        fetchBoardDetail(selectedBoard.id);
        fetchBoards();
        if (selectedJob?.id === jobId) {
          setSelectedJob(null);
        }
      }
    } catch (err) {
      console.error("Failed to delete job:", err);
    }
  };

  const handleStatusChange = async (jobId: string, newStatus: string) => {
    if (!selectedBoard) return;

    try {
      const res = await fetch(
        apiUrl(`/api/v1/jobs/${selectedBoard.id}/jobs/${jobId}`),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }
      );
      const data = await res.json();
      if (data.success) {
        fetchBoardDetail(selectedBoard.id);
        if (selectedJob?.id === jobId) {
          setSelectedJob((prev) => prev ? { ...prev, status: newStatus } : null);
        }
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const filteredBoards = boards.filter(
    (b) =>
      b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div
      className="h-screen flex gap-4 p-4 animate-fade-in"
      style={{ justifyContent: "flex-start" }}
    >
      {/* Left Panel: Board List */}
      <div
        className={`flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-all duration-300 flex-shrink-0 ${leftCollapsed ? "overflow-hidden" : ""}`}
        style={{
          width: leftCollapsed ? 0 : "288px",
          minWidth: leftCollapsed ? 0 : "288px",
          maxWidth: leftCollapsed ? 0 : "288px",
          opacity: leftCollapsed ? 0 : 1,
        }}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              {t("Job Boards")}
            </h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCreateBoardModal(true)}
                className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all shadow-md shadow-purple-500/20"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={() => setLeftCollapsed(true)}
                className="p-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-sm hover:bg-slate-50 dark:hover:bg-slate-600 transition-all"
                title={t("Collapse left panel")}
              >
                <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder={t("Search job boards...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
            />
          </div>
        </div>

        {/* Board List */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500">
              {t("Loading")}
            </div>
          ) : filteredBoards.length === 0 ? (
            <div className="p-8 text-center">
              <FolderOpen className="w-12 h-12 text-slate-200 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                {t("No job boards yet")}
              </p>
              <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">
                {t("Create your first job board to get started")}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredBoards.map((b) => (
                <div
                  key={b.id}
                  onClick={() => fetchBoardDetail(b.id)}
                  className={`p-3 rounded-xl cursor-pointer transition-all group ${
                    selectedBoard?.id === b.id
                      ? "bg-purple-50 dark:bg-purple-900/30 border-2 border-purple-200 dark:border-purple-700"
                      : "hover:bg-slate-50 dark:hover:bg-slate-700/50 border-2 border-transparent"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: `${b.color}20`,
                        color: b.color,
                      }}
                    >
                      <Briefcase className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate text-sm">
                          {b.name}
                        </h3>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingBoard({
                                id: b.id,
                                name: b.name,
                                description: b.description,
                                color: b.color,
                              });
                              setShowEditBoardModal(true);
                            }}
                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded"
                          >
                            <Edit3 className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDeleteConfirm(b.id);
                            }}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/40 rounded"
                          >
                            <Trash2 className="w-3 h-3 text-red-500 dark:text-red-400" />
                          </button>
                        </div>
                      </div>
                      {b.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {b.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400 dark:text-slate-500">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {b.job_count} {t("jobs")}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(b.updated_at * 1000).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {leftCollapsed && (
        <button
          onClick={() => setLeftCollapsed(false)}
          className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all self-start mt-4 shrink-0"
          title={t("Expand left panel")}
        >
          <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300" />
        </button>
      )}

      {/* Middle Panel: Jobs List */}
      <div
        className={`flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-all duration-300 flex-shrink-0 ${middleCollapsed ? "overflow-hidden" : ""}`}
        style={{
          width: middleCollapsed ? 0 : "360px",
          minWidth: middleCollapsed ? 0 : "360px",
          maxWidth: middleCollapsed ? 0 : "360px",
          opacity: middleCollapsed ? 0 : 1,
        }}
      >
        {/* Board Header */}
        <div
          className="p-4 border-b border-slate-100 dark:border-slate-700 shrink-0"
          style={{
            backgroundColor: selectedBoard
              ? `${selectedBoard.color}10`
              : "transparent",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            {selectedBoard ? (
              <>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: `${selectedBoard.color}20`,
                      color: selectedBoard.color,
                    }}
                  >
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-bold text-slate-900 dark:text-slate-100 truncate">
                      {selectedBoard.name}
                    </h2>
                    {selectedBoard.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {selectedBoard.description}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setShowAddJobModal(true)}
                  className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all shadow-md shadow-purple-500/20 shrink-0"
                  title={t("Add Job")}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </>
            ) : (
              <div className="flex-1" />
            )}
            <button
              onClick={() => setMiddleCollapsed(true)}
              className="p-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-sm hover:bg-slate-50 dark:hover:bg-slate-600 transition-all shrink-0"
              title={t("Collapse middle panel")}
            >
              <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            </button>
          </div>
        </div>

        {selectedBoard ? (
          <>
            {/* Jobs List */}
            <div className="flex-1 overflow-y-auto p-3">
              {selectedBoard.jobs.length === 0 ? (
                <div className="p-8 text-center">
                  <Briefcase className="w-12 h-12 text-slate-200 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-500 dark:text-slate-400 text-sm">
                    {t("No jobs yet")}
                  </p>
                  <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">
                    {t("Add a job to start tracking")}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedBoard.jobs.map((job) => (
                    <div
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      className={`p-3 rounded-xl cursor-pointer transition-all group border ${
                        selectedJob?.id === job.id
                          ? "bg-slate-50 dark:bg-slate-700/50 border-slate-300 dark:border-slate-600"
                          : "hover:bg-slate-50 dark:hover:bg-slate-700/50 border-transparent hover:border-slate-200 dark:hover:border-slate-600"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${getStatusStyle(job.status)}`}
                            >
                              {getStatusLabel(job.status, t)}
                            </span>
                          </div>
                          <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 line-clamp-1">
                            {job.title}
                          </h4>
                          <div className="flex items-center gap-1 mt-1">
                            <Building2 className="w-3 h-3 text-slate-400" />
                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                              {job.company}
                            </p>
                          </div>
                          {job.location && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <p className="text-xs text-slate-400 dark:text-slate-500 line-clamp-1">
                                {job.location}
                              </p>
                            </div>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">
                              {new Date(job.created_at * 1000).toLocaleDateString()}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteJob(job.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/40 rounded transition-all"
                            >
                              <Trash2 className="w-3 h-3 text-red-500 dark:text-red-400" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 p-8">
            <Briefcase className="w-16 h-16 text-slate-200 dark:text-slate-600 mb-4" />
            <p className="text-slate-500 dark:text-slate-400">
              {t("Select a board to view jobs")}
            </p>
          </div>
        )}
      </div>
      {middleCollapsed && (
        <button
          onClick={() => setMiddleCollapsed(false)}
          className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all self-start mt-4 shrink-0"
          title={t("Expand middle panel")}
        >
          <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300" />
        </button>
      )}

      {/* Right Panel: Job Detail */}
      <div
        className={`flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-all duration-300 ${rightCollapsed ? "flex-shrink-0 overflow-hidden" : "flex-1"}`}
        style={{
          width: rightCollapsed ? 0 : undefined,
          minWidth: rightCollapsed ? 0 : undefined,
          maxWidth: rightCollapsed ? 0 : undefined,
          opacity: rightCollapsed ? 0 : 1,
          marginLeft: "auto",
          order: 3,
        }}
      >
        {/* Job Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button
                onClick={() => setRightCollapsed(true)}
                className="p-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-sm hover:bg-slate-50 dark:hover:bg-slate-600 transition-all shrink-0"
                title={t("Collapse right panel")}
              >
                <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              </button>
              {selectedJob ? (
                <>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-bold text-slate-900 dark:text-slate-100 truncate">
                      {selectedJob.title}
                    </h2>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${getStatusStyle(selectedJob.status)}`}>
                        {getStatusLabel(selectedJob.status, t)}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {selectedJob.company}
                      </span>
                      {selectedJob.location && (
                        <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {selectedJob.location}
                        </span>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1" />
              )}
            </div>

            {/* Action Buttons */}
            {selectedJob && (
              <div className="flex items-center gap-2 shrink-0">
                {selectedJob.url && (
                  <a
                    href={selectedJob.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/40 rounded-lg transition-colors"
                    title={t("Job URL")}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {t("Job URL")}
                  </a>
                )}
                <button
                  onClick={() => {
                    setEditingJob({ ...selectedJob });
                    setShowEditJobModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  title={t("Edit Job")}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  {t("Edit Job")}
                </button>
              </div>
            )}
          </div>
        </div>

        {selectedJob ? (
          <>
            {/* Job Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Status Selector */}
              <div className="mb-6">
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  {t("Status")}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleStatusChange(selectedJob.id, opt.value)}
                      className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                        selectedJob.status === opt.value
                          ? opt.color + " ring-2 ring-offset-1 ring-purple-300 dark:ring-purple-600 dark:ring-offset-slate-800"
                          : "bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600"
                      }`}
                    >
                      {t(opt.label)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Key Info */}
              <div className="mb-6 grid grid-cols-2 gap-4">
                {selectedJob.salary_range && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">{t("Salary Range")}</span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-200">{selectedJob.salary_range}</p>
                  </div>
                )}
                {selectedJob.url && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-1">
                      <ExternalLink className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">{t("Job URL")}</span>
                    </div>
                    <a
                      href={selectedJob.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate block"
                    >
                      {selectedJob.url}
                    </a>
                  </div>
                )}
              </div>

              {/* Job Description */}
              {selectedJob.description && (
                <div className="mb-6">
                  <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    {t("Job Description")}
                  </h3>
                  <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-600">
                    <div className="prose prose-slate dark:prose-invert max-w-none prose-sm whitespace-pre-wrap">
                      {selectedJob.description}
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedJob.notes && (
                <div className="mb-6">
                  <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <StickyNote className="w-3.5 h-3.5" />
                    {t("Notes")}
                  </h3>
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800">
                    <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                      {selectedJob.notes}
                    </p>
                  </div>
                </div>
              )}

              {/* Meta */}
              <div className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {t("Created")}: {new Date(selectedJob.created_at * 1000).toLocaleString()}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {t("Updated")}: {new Date(selectedJob.updated_at * 1000).toLocaleString()}
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 p-8">
            <Briefcase className="w-16 h-16 text-slate-200 dark:text-slate-600 mb-4" />
            <p className="text-slate-500 dark:text-slate-400">
              {t("Select a job to view details")}
            </p>
          </div>
        )}
      </div>
      {rightCollapsed && (
        <button
          onClick={() => setRightCollapsed(false)}
          className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all self-start mt-4 shrink-0"
          title={t("Expand right panel")}
        >
          <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />
        </button>
      )}

      {/* Create Board Modal */}
      {showCreateBoardModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-[400px] animate-in zoom-in-95">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-slate-100">
                {t("Create New Board")}
              </h3>
              <button
                onClick={() => setShowCreateBoardModal(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  {t("Name")}
                </label>
                <input
                  type="text"
                  value={newBoard.name}
                  onChange={(e) =>
                    setNewBoard((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder={t("My Job Board")}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  {t("Description (Optional)")}
                </label>
                <textarea
                  value={newBoard.description}
                  onChange={(e) =>
                    setNewBoard((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder={t("Track interesting positions...")}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  {t("Color")}
                </label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewBoard((prev) => ({ ...prev, color }))}
                      className={`w-8 h-8 rounded-lg transition-all ${
                        newBoard.color === color
                          ? "ring-2 ring-offset-2 ring-slate-400 dark:ring-slate-500 dark:ring-offset-slate-800 scale-110"
                          : ""
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2">
              <button
                onClick={() => setShowCreateBoardModal(false)}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                {t("Cancel")}
              </button>
              <button
                onClick={handleCreateBoard}
                disabled={!newBoard.name.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {t("Create")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Board Modal */}
      {showEditBoardModal && editingBoard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-[400px] animate-in zoom-in-95">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-slate-100">
                {t("Edit Board")}
              </h3>
              <button
                onClick={() => {
                  setShowEditBoardModal(false);
                  setEditingBoard(null);
                }}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  {t("Name")}
                </label>
                <input
                  type="text"
                  value={editingBoard.name}
                  onChange={(e) =>
                    setEditingBoard((prev) =>
                      prev ? { ...prev, name: e.target.value } : null
                    )
                  }
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  {t("Description")}
                </label>
                <textarea
                  value={editingBoard.description}
                  onChange={(e) =>
                    setEditingBoard((prev) =>
                      prev ? { ...prev, description: e.target.value } : null
                    )
                  }
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  {t("Color")}
                </label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() =>
                        setEditingBoard((prev) =>
                          prev ? { ...prev, color } : null
                        )
                      }
                      className={`w-8 h-8 rounded-lg transition-all ${
                        editingBoard.color === color
                          ? "ring-2 ring-offset-2 ring-slate-400 dark:ring-slate-500 dark:ring-offset-slate-800 scale-110"
                          : ""
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowEditBoardModal(false);
                  setEditingBoard(null);
                }}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                {t("Cancel")}
              </button>
              <button
                onClick={handleUpdateBoard}
                disabled={!editingBoard.name.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                {t("Save Changes")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Board Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-[360px] animate-in zoom-in-95">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-2">
                {t("Delete Board?")}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t("This action cannot be undone. All jobs in this board will be permanently deleted.")}
              </p>
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex justify-center gap-2">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                {t("Cancel")}
              </button>
              <button
                onClick={() => handleDeleteBoard(showDeleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {t("Delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Job Modal */}
      {showAddJobModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-[520px] max-h-[85vh] flex flex-col animate-in zoom-in-95">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Plus className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                {t("Add Job")}
              </h3>
              <button
                onClick={() => setShowAddJobModal(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    {t("Job Title")} *
                  </label>
                  <input
                    type="text"
                    value={jobForm.title}
                    onChange={(e) => setJobForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Software Engineer"
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    {t("Company")} *
                  </label>
                  <input
                    type="text"
                    value={jobForm.company}
                    onChange={(e) => setJobForm((prev) => ({ ...prev, company: e.target.value }))}
                    placeholder="e.g. Google"
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    {t("Location")}
                  </label>
                  <input
                    type="text"
                    value={jobForm.location}
                    onChange={(e) => setJobForm((prev) => ({ ...prev, location: e.target.value }))}
                    placeholder="e.g. San Francisco, CA"
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    {t("Salary Range")}
                  </label>
                  <input
                    type="text"
                    value={jobForm.salary_range}
                    onChange={(e) => setJobForm((prev) => ({ ...prev, salary_range: e.target.value }))}
                    placeholder="e.g. $120K - $180K"
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  {t("Job URL")}
                </label>
                <input
                  type="url"
                  value={jobForm.url}
                  onChange={(e) => setJobForm((prev) => ({ ...prev, url: e.target.value }))}
                  placeholder="https://..."
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  {t("Status")}
                </label>
                <select
                  value={jobForm.status}
                  onChange={(e) => setJobForm((prev) => ({ ...prev, status: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {t(opt.label)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  {t("Job Description")}
                </label>
                <textarea
                  value={jobForm.description}
                  onChange={(e) => setJobForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder={t("Paste job description here...")}
                  rows={8}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  {t("Notes")}
                </label>
                <textarea
                  value={jobForm.notes}
                  onChange={(e) => setJobForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Your personal notes about this position..."
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none resize-none"
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setShowAddJobModal(false)}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                {t("Cancel")}
              </button>
              <button
                onClick={handleAddJob}
                disabled={!jobForm.title.trim() || !jobForm.company.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {t("Add Job")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Job Modal */}
      {showEditJobModal && editingJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-[520px] max-h-[85vh] flex flex-col animate-in zoom-in-95">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                {t("Edit Job")}
              </h3>
              <button
                onClick={() => {
                  setShowEditJobModal(false);
                  setEditingJob(null);
                }}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    {t("Job Title")}
                  </label>
                  <input
                    type="text"
                    value={editingJob.title}
                    onChange={(e) => setEditingJob((prev) => prev ? { ...prev, title: e.target.value } : null)}
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    {t("Company")}
                  </label>
                  <input
                    type="text"
                    value={editingJob.company}
                    onChange={(e) => setEditingJob((prev) => prev ? { ...prev, company: e.target.value } : null)}
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    {t("Location")}
                  </label>
                  <input
                    type="text"
                    value={editingJob.location}
                    onChange={(e) => setEditingJob((prev) => prev ? { ...prev, location: e.target.value } : null)}
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    {t("Salary Range")}
                  </label>
                  <input
                    type="text"
                    value={editingJob.salary_range}
                    onChange={(e) => setEditingJob((prev) => prev ? { ...prev, salary_range: e.target.value } : null)}
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  {t("Job URL")}
                </label>
                <input
                  type="url"
                  value={editingJob.url}
                  onChange={(e) => setEditingJob((prev) => prev ? { ...prev, url: e.target.value } : null)}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  {t("Status")}
                </label>
                <select
                  value={editingJob.status}
                  onChange={(e) => setEditingJob((prev) => prev ? { ...prev, status: e.target.value } : null)}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {t(opt.label)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  {t("Job Description")}
                </label>
                <textarea
                  value={editingJob.description}
                  onChange={(e) => setEditingJob((prev) => prev ? { ...prev, description: e.target.value } : null)}
                  rows={8}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  {t("Notes")}
                </label>
                <textarea
                  value={editingJob.notes}
                  onChange={(e) => setEditingJob((prev) => prev ? { ...prev, notes: e.target.value } : null)}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none resize-none"
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => {
                  setShowEditJobModal(false);
                  setEditingJob(null);
                }}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                {t("Cancel")}
              </button>
              <button
                onClick={handleUpdateJob}
                disabled={!editingJob.title.trim() || !editingJob.company.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                {t("Save Changes")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
