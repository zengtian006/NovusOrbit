"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Wand2,
  Minimize2,
  Maximize2,
  Globe,
  Database,
  Loader2,
  X,
  History,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Highlighter,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Link,
  Image as ImageIcon,
  Table,
  Minus,
  Download,
  FileText,
  PenTool,
  Sparkles,
  Eye,
  EyeOff,
  Wifi,
  WifiOff,
  AlertCircle,
  Book,
  ChevronDown,
  ChevronRight,
  LayoutTemplate,
  Import,
} from "lucide-react";
import NotebookImportModal from "./NotebookImportModal";
import { apiUrl } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import "katex/dist/katex.min.css";
import { processLatexContent } from "@/lib/latex";
import {
  loadFromStorage,
  saveToStorage,
  STORAGE_KEYS,
} from "@/lib/persistence";
import { debounce } from "@/lib/debounce";

interface ResumeWriterEditorProps {
  initialValue?: string;
}

// AI Mark tag regex patterns
const AI_MARK_REGEX = /<span\s+data-rough-notation="[^"]+">([^<]*)<\/span>/g;
const AI_MARK_OPEN_TAG = /<span\s+data-rough-notation="[^"]+">/g;
const AI_MARK_CLOSE_TAG = /<\/span>/g;

// Default resume template
const DEFAULT_RESUME_CONTENT = `# [Your Name]

**Email:** your.email@example.com | **Phone:** (123) 456-7890 | **Location:** City, State

---

## Professional Summary

Accomplished [Your Role] with X+ years of experience in [Industry/Field]. Proven track record of delivering high-impact solutions, driving innovation, and leading cross-functional teams. Seeking to leverage expertise to contribute to [Target Organization].

---

## Professional Experience

### Senior [Position Title]
**Company Name** | City, State | January 2020 – Present
- Led team of X professionals to deliver Y project, resulting in Z% improvement in efficiency
- Implemented new processes that reduced costs by X% annually
- Collaborated across departments to achieve strategic business objectives

### [Position Title]
**Previous Company** | City, State | January 2018 – December 2019
- Developed and launched product features serving X+ users
- Increased team productivity by X% through process optimization
- Managed relationships with X+ key stakeholders

---

## Education

### Master of Science in [Field]
**University Name** | Graduation: May 2018 | GPA: 3.8/4.0

### Bachelor of Science in [Field]
**University Name** | Graduation: May 2016 | GPA: 3.9/4.0

---

## Skills

**Technical:** Python, JavaScript, SQL, AWS, React, Node.js
**Languages:** English (Native), [Other Language]
**Soft Skills:** Leadership, Project Management, Problem-Solving, Communication

---

## Certifications & Awards

- AWS Certified Solutions Architect Professional (2022)
- Industry Excellence Award (2021)
- Certified Project Manager (PMP) (2020)

---

## Professional Development

- Advanced Leadership Program, [Organization] (2023)
- Data Science Bootcamp, [Organization] (2022)
`;

export default function ResumeWriterEditor({
  initialValue = "",
}: ResumeWriterEditorProps) {
  const { t } = useTranslation();
  const isHydrated = useRef(false);

  const [content, setContent] = useState(
    initialValue || DEFAULT_RESUME_CONTENT,
  );

  // Store original content with tags
  const saveContent = useCallback(
    debounce((text: string) => {
      if (!isHydrated.current) return;
      saveToStorage(STORAGE_KEYS.RESUME_WRITER_CONTENT, text);
    }, 1000),
    [],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (initialValue) {
      isHydrated.current = true;
      return;
    }

    const persistedContent = loadFromStorage<string>(
      STORAGE_KEYS.RESUME_WRITER_CONTENT,
      DEFAULT_RESUME_CONTENT,
    );
    if (persistedContent !== DEFAULT_RESUME_CONTENT) {
      setContent(persistedContent);
    }
    isHydrated.current = true;
  }, [initialValue]);

  useEffect(() => {
    if (isHydrated.current) {
      saveContent(content);
    }
  }, [content, saveContent]);

  const [selection, setSelection] = useState<{
    start: number;
    end: number;
    text: string;
  } | null>(null);
  const [popover, setPopover] = useState<{
    visible: boolean;
    x: number;
    y: number;
  } | null>(null);
  const [instruction, setInstruction] = useState("");
  const [selectedAction, setSelectedAction] = useState<
    "rewrite" | "shorten" | "expand" | "optimize"
  >("optimize");
  const [source, setSource] = useState<"rag" | "web" | null>(null);
  const [selectedKb, setSelectedKb] = useState("");
  const [kbs, setKbs] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [operationHistory, setOperationHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [hideAiMarks, setHideAiMarks] = useState(false);
  const [rawContent, setRawContent] = useState("");
  const [backendConnected, setBackendConnected] = useState<boolean | null>(
    null,
  );
  const [showImportModal, setShowImportModal] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef(false);

  // Check backend connection
  const checkBackendConnection = useCallback(
    async (silent: boolean = false) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(apiUrl("/api/v1/resume_writer/history"), {
          method: "GET",
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          setBackendConnected(true);
          return true;
        } else {
          setBackendConnected(false);
          return false;
        }
      } catch (error: any) {
        setBackendConnected(false);
        if (
          !silent &&
          error.name !== "AbortError" &&
          process.env.NODE_ENV === "development"
        ) {
          console.debug("Backend connection check failed:", error.message);
        }
        return false;
      }
    },
    [],
  );

  // Fetch KBs
  useEffect(() => {
    const loadData = async () => {
      setBackendConnected(null);

      try {
        const isConnected = await checkBackendConnection(true);

        if (isConnected) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const res = await fetch(apiUrl("/api/v1/portfolio/list"), {
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (res.ok) {
              const data = await res.json();
              setKbs(data.map((kb: any) => kb.name));
              if (data.length > 0) setSelectedKb(data[0].name);
            }
          } catch (err: any) {
            if (process.env.NODE_ENV === "development") {
              console.debug("Failed to fetch KBs:", err.message);
            }
          }

          fetchHistory();
        }
      } catch (error: any) {
        if (process.env.NODE_ENV === "development") {
          console.debug("Failed to initialize:", error.message);
        }
      }
    };

    loadData();
  }, [checkBackendConnection]);

  const fetchHistory = () => {
    fetch(apiUrl("/api/v1/resume_writer/history"))
      .then((res) => {
        if (res.ok) {
          return res.json();
        } else {
          throw new Error(`HTTP ${res.status}`);
        }
      })
      .then((data) => {
        setOperationHistory(data.history || []);
        setBackendConnected(true);
      })
      .catch((err) => {
        if (process.env.NODE_ENV === "development") {
          console.debug("Failed to fetch history:", err.message);
        }
        setBackendConnected(false);
      });
  };

  // Synchronized scroll
  const handleEditorScroll = useCallback(() => {
    if (isSyncingScroll.current) return;
    const editor = textareaRef.current;
    const preview = previewRef.current;
    if (!editor || !preview) return;

    isSyncingScroll.current = true;
    const scrollPercentage =
      editor.scrollTop / (editor.scrollHeight - editor.clientHeight);
    preview.scrollTop =
      scrollPercentage * (preview.scrollHeight - preview.clientHeight);

    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  }, []);

  const handlePreviewScroll = useCallback(() => {
    if (isSyncingScroll.current) return;
    const editor = textareaRef.current;
    const preview = previewRef.current;
    if (!editor || !preview) return;

    isSyncingScroll.current = true;
    const scrollPercentage =
      preview.scrollTop / (preview.scrollHeight - preview.clientHeight);
    editor.scrollTop =
      scrollPercentage * (editor.scrollHeight - editor.clientHeight);

    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  }, []);

  const getDisplayContent = useCallback(() => {
    if (!hideAiMarks) return content;
    return content.replace(AI_MARK_REGEX, "$1");
  }, [content, hideAiMarks]);

  useEffect(() => {
    if (hideAiMarks && !rawContent) {
      setRawContent(content);
    } else if (!hideAiMarks && rawContent) {
      setRawContent("");
    }
  }, [hideAiMarks, content, rawContent]);

  const wrapSelection = useCallback((before: string, after: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);

    if (selectedText.length === 0) return;

    const textBefore = textarea.value.substring(
      Math.max(0, start - before.length),
      start,
    );
    const textAfter = textarea.value.substring(end, end + after.length);

    let newContent: string;
    let newStart: number;
    let newEnd: number;

    if (textBefore === before && textAfter === after) {
      newContent =
        textarea.value.substring(0, start - before.length) +
        selectedText +
        textarea.value.substring(end + after.length);
      newStart = start - before.length;
      newEnd = end - before.length;
    } else {
      newContent =
        textarea.value.substring(0, start) +
        before +
        selectedText +
        after +
        textarea.value.substring(end);
      newStart = start + before.length;
      newEnd = end + before.length;
    }

    setContent(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newStart, newEnd);
    }, 0);
  }, []);

  const toggleLinePrefix = useCallback((prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const lines = textarea.value.split("\n");

    let charCount = 0;
    let startLine = 0;
    let endLine = 0;

    for (let i = 0; i < lines.length; i++) {
      if (charCount <= start && start <= charCount + lines[i].length) {
        startLine = i;
      }
      if (charCount <= end && end <= charCount + lines[i].length) {
        endLine = i;
        break;
      }
      charCount += lines[i].length + 1;
    }

    let allHavePrefix = true;
    for (let i = startLine; i <= endLine; i++) {
      if (!lines[i].startsWith(prefix)) {
        allHavePrefix = false;
        break;
      }
    }

    for (let i = startLine; i <= endLine; i++) {
      if (allHavePrefix) {
        lines[i] = lines[i].substring(prefix.length);
      } else {
        lines[i] = prefix + lines[i];
      }
    }

    setContent(lines.join("\n"));
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        !textareaRef.current ||
        document.activeElement !== textareaRef.current
      )
        return;

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "b":
            e.preventDefault();
            wrapSelection("**", "**");
            break;
          case "i":
            e.preventDefault();
            wrapSelection("*", "*");
            break;
          case "u":
            e.preventDefault();
            wrapSelection("<u>", "</u>");
            break;
          case "h":
            e.preventDefault();
            wrapSelection("<mark>", "</mark>");
            break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [wrapSelection]);

  // Handle selection for popover
  const handleMouseUp = (e: React.MouseEvent) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value.substring(start, end);

    if (text.trim().length > 0) {
      const rect = textarea.getBoundingClientRect();
      let x = e.clientX;
      let y = e.clientY + 10;

      setSelection({ start, end, text });
      setPopover({ visible: true, x, y });
      setInstruction("");
      setSelectedAction("optimize");
      setSource(null);
    } else {
      setPopover(null);
      setSelection(null);
    }
  };

  // Close popover on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(event.target as Node)
      ) {
        setPopover(null);
        setSelection(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAction = async (
    action: "rewrite" | "shorten" | "expand" | "optimize",
  ) => {
    if (!selection) return;

    if (backendConnected === false) {
      const isConnected = await checkBackendConnection();
      if (!isConnected) {
        alert(
          `❌ Backend service not connected\n\nPlease ensure the backend is running:\n📍 ${apiUrl("")}\n\n💡 How to start:\nRun in project root: python start.py`,
        );
        return;
      }
    }

    setIsProcessing(true);

    try {
      let editedText: string;
      const requestUrl = apiUrl("/api/v1/resume_writer/edit");

      const requestBody: any = {
        text: selection.text,
        instruction:
          instruction ||
          `Please ${selectedAction === "optimize" ? "optimize this for ATS systems" : selectedAction} this resume text.`,
        action: selectedAction === "optimize" ? "rewrite" : selectedAction,
        source: source,
      };
      if (selectedKb && source === "rag") {
        requestBody.portfolio = selectedKb;
      }

      const res = await fetch(requestUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(
          `Failed to edit text: ${res.status} ${res.statusText}\n${errorText}`,
        );
      }

      const data = await res.json();
      if (!data.edited_text) {
        throw new Error("Invalid response: missing edited_text field");
      }
      editedText = data.edited_text;

      const newContent =
        content.substring(0, selection.start) +
        editedText +
        content.substring(selection.end);
      setContent(newContent);
      setPopover(null);
      setSelection(null);
      fetchHistory();
    } catch (error: any) {
      console.error("Action error:", error);
      setBackendConnected(false);

      let errorMessage = "Error processing request";
      const backendUrl = apiUrl("");

      if (
        error instanceof TypeError &&
        (error.message.includes("fetch") || error.message === "Failed to fetch")
      ) {
        errorMessage =
          `❌ Cannot connect to backend service\n\nPlease ensure the backend is running:\n📍 ${backendUrl}`;
      } else if (error.message) {
        errorMessage = `❌ ${error.message}`;
      }

      alert(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const exportMarkdown = () => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "resume.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  const ToolbarButton = ({
    icon,
    onClick,
    title,
    active,
  }: {
    icon: React.ReactNode;
    onClick: () => void;
    title: string;
    active?: boolean;
  }) => (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-all ${active ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200"}`}
    >
      {icon}
    </button>
  );

  const Divider = () => (
    <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 mx-1" />
  );

  return (
    <div className="flex h-full gap-4">
      {/* Left Column: Editor */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden relative">
        {/* Toolbar */}
        <div className="p-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center gap-1 flex-wrap">
          <div className="flex items-center gap-0.5">
            <ToolbarButton
              icon={<Bold className="w-4 h-4" />}
              onClick={() => wrapSelection("**", "**")}
              title={t("Bold (Ctrl+B)")}
            />
            <ToolbarButton
              icon={<Italic className="w-4 h-4" />}
              onClick={() => wrapSelection("*", "*")}
              title={t("Italic (Ctrl+I)")}
            />
            <ToolbarButton
              icon={<UnderlineIcon className="w-4 h-4" />}
              onClick={() => wrapSelection("<u>", "</u>")}
              title={t("Underline (Ctrl+U)")}
            />
            <ToolbarButton
              icon={<Code className="w-4 h-4" />}
              onClick={() => wrapSelection("`", "`")}
              title={t("Inline Code")}
            />
          </div>

          <Divider />

          <div className="flex items-center gap-0.5">
            <ToolbarButton
              icon={<Heading1 className="w-4 h-4" />}
              onClick={() => toggleLinePrefix("# ")}
              title={t("Heading 1")}
            />
            <ToolbarButton
              icon={<Heading2 className="w-4 h-4" />}
              onClick={() => toggleLinePrefix("## ")}
              title={t("Heading 2")}
            />
          </div>

          <Divider />

          <div className="flex items-center gap-0.5">
            <ToolbarButton
              icon={<List className="w-4 h-4" />}
              onClick={() => toggleLinePrefix("- ")}
              title={t("Bullet List")}
            />
            <ToolbarButton
              icon={<ListOrdered className="w-4 h-4" />}
              onClick={() => toggleLinePrefix("1. ")}
              title={t("Numbered List")}
            />
          </div>

          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-all"
            title={t("Import")}
          >
            <Import className="w-3.5 h-3.5" />
            {t("Import")}
          </button>

          <div className="flex-1" />

          {backendConnected !== null && (
            <div
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-all ${backendConnected
                ? "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                : "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                }`}
            >
              {backendConnected ? (
                <>
                  <Wifi className="w-3 h-3" />
                  <span className="hidden sm:inline">{t("Connected")}</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3" />
                  <span className="hidden sm:inline">
                    {t("Disconnected")}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Editor Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/30 flex justify-between items-center">
            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              {t("Resume Editor")}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500">
              {content.length} chars
            </div>
          </div>
          <div ref={editorContainerRef} className="flex-1 overflow-y-hidden">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onMouseUp={handleMouseUp}
              className="w-full h-full min-h-full p-4 resize-none outline-none font-mono text-sm leading-relaxed text-slate-800 dark:text-slate-200 bg-transparent placeholder-slate-400 dark:placeholder-slate-500 overflow-y-auto"
              placeholder={t("Edit your resume here...")}
              style={{ minHeight: "100%" }}
              onScroll={handleEditorScroll}
            />
          </div>
        </div>

        {/* Popover */}
        {popover && (
          <div
            ref={popoverRef}
            style={{
              position: "fixed",
              left: Math.min(
                window.innerWidth - 340,
                Math.max(20, popover.x - 160),
              ),
              top: Math.min(window.innerHeight - 400, popover.y),
            }}
            className="z-50 w-[320px] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-600 animate-in fade-in zoom-in-95 duration-200 flex flex-col"
          >
            <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30 flex justify-between items-center rounded-t-xl">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                <Sparkles className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                {t("Resume AI Assistant")}
              </div>
              <button
                onClick={() => setPopover(null)}
                className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="text-xs overflow-y-auto text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700 p-2 rounded-lg border border-slate-100 dark:border-slate-600 line-clamp-2 italic">
                &quot;{selection?.text}&quot;
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                  {t("Instruction (Optional)")}
                </label>
                <input
                  type="text"
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder={t("e.g. Make it more formal...")}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                />
              </div>

              {/* Source Selection - Only show in non-automark mode */}
              {/* {selectedAction !== "optimize" && ( */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                  {t("Context Source (Optional)")}
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSource(source === "rag" ? null : "rag")}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs border rounded-lg transition-all ${source === "rag" ? "bg-purple-50 dark:bg-purple-900/40 border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300" : "bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600"}`}
                  >
                    <Database className="w-3 h-3" />
                    {t("Portfolio")}
                  </button>
                  <button
                    onClick={() => setSource(source === "web" ? null : "web")}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs border rounded-lg transition-all ${source === "web" ? "bg-blue-50 dark:bg-blue-900/40 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300" : "bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600"}`}
                  >
                    <Globe className="w-3 h-3" />
                    {t("Web")}
                  </button>
                </div>
              </div>
              {/* )} */}

              {/* KB Selector if Portfolio */}
              {source === "rag" && kbs.length > 0 && (
                <div className="animate-in fade-in slide-in-from-top-1">
                  <select
                    value={selectedKb}
                    onChange={(e) => setSelectedKb(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg outline-none bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                  >
                    {kbs.map((kb) => (
                      <option key={kb} value={kb}>
                        {kb}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* {selectedAction !== "optimize" && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                    {t("Portfolio Context")}
                  </label>
                  <select
                    value={selectedKb}
                    onChange={e => setSelectedKb(e.target.value)}
                    className="w-full py-1.5 px-2 text-xs border rounded-lg bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  >
                    {kbs.length === 0 ? (
                      <option value="">{t("No portfolios found")}</option>
                    ) : (
                      kbs.map(kb => (
                        <option key={kb} value={kb}>{kb}</option>
                      ))
                    )}
                  </select>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    {t("Select a portfolio to use as context for AI resume rewriting.")}
                  </div>
                </div>
              )} */}

              <div className="pt-2 border-t border-slate-100 dark:border-slate-700 space-y-3">
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    onClick={() => setSelectedAction("optimize")}
                    disabled={isProcessing}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all text-[10px] font-medium border-2 ${selectedAction === "optimize" ? "bg-blue-50 dark:bg-blue-900/40 border-blue-400 dark:border-blue-600 text-blue-600 dark:text-blue-300" : "border-transparent text-slate-600 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"}`}
                  >
                    <Wand2 className="w-4 h-4" />
                    {t("Optimize")}
                  </button>
                  <button
                    onClick={() => setSelectedAction("shorten")}
                    disabled={isProcessing}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all text-[10px] font-medium border-2 ${selectedAction === "shorten" ? "bg-amber-50 dark:bg-amber-900/40 border-amber-400 dark:border-amber-600 text-amber-600 dark:text-amber-300" : "border-transparent text-slate-600 dark:text-slate-400 hover:bg-amber-50 dark:hover:bg-amber-900/30"}`}
                  >
                    <Minimize2 className="w-4 h-4" />
                    {t("Shorten")}
                  </button>
                  <button
                    onClick={() => setSelectedAction("expand")}
                    disabled={isProcessing}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all text-[10px] font-medium border-2 ${selectedAction === "expand" ? "bg-blue-50 dark:bg-blue-900/40 border-blue-400 dark:border-blue-600 text-blue-600 dark:text-blue-300" : "border-transparent text-slate-600 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"}`}
                  >
                    <Maximize2 className="w-4 h-4" />
                    {t("Expand")}
                  </button>
                  <button
                    onClick={() => setSelectedAction("rewrite")}
                    disabled={isProcessing}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all text-[10px] font-medium border-2 ${selectedAction === "rewrite" ? "bg-purple-50 dark:bg-purple-900/40 border-purple-400 dark:border-purple-600 text-purple-600 dark:text-purple-300" : "border-transparent text-slate-600 dark:text-slate-400 hover:bg-purple-50 dark:hover:bg-purple-900/30"}`}
                  >
                    <PenTool className="w-4 h-4" />
                    {t("Rewrite")}
                  </button>
                </div>

                <button
                  onClick={() => handleAction(selectedAction)}
                  disabled={isProcessing}
                  className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-xs font-bold rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("Processing...")}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      {t("Apply")}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Column */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Preview Area */}
        <div className="flex-1 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              {t("Preview")}
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={exportMarkdown}
                className="flex items-center gap-1 px-2 py-1 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-all"
              >
                <FileText className="w-3.5 h-3.5" />
                .md
              </button>
              <Divider />
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-all ${showHistory ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"}`}
              >
                <History className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col relative min-h-0">
            <div
              ref={previewRef}
              className="flex-1 overflow-y-auto p-6 prose prose-slate dark:prose-invert prose-sm max-w-none prose-headings:text-slate-900 dark:prose-headings:text-slate-100 prose-p:text-slate-700 dark:prose-p:text-slate-300 prose-a:text-blue-600 dark:prose-a:text-blue-400"
              onScroll={handlePreviewScroll}
              style={{ minHeight: 0 }}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex, rehypeRaw]}
                components={{
                  table: ({ node, ...props }) => (
                    <div className="overflow-x-auto my-4">
                      <table className="min-w-full border-collapse border border-slate-300" {...props} />
                    </div>
                  ),
                  th: ({ node, ...props }) => (
                    <th className="border border-slate-300 px-3 py-2 bg-slate-100 font-semibold text-left" {...props} />
                  ),
                  td: ({ node, ...props }) => (
                    <td className="border border-slate-300 px-3 py-2" {...props} />
                  ),
                }}
              >
                {processLatexContent(content)}
              </ReactMarkdown>
            </div>

            {/* History Panel */}
            {showHistory && (
              <div className="absolute inset-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm flex flex-col animate-in fade-in duration-200">
                <div className="p-3 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                  <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    {t("Edit History")}
                  </h3>
                  <button
                    onClick={() => setShowHistory(false)}
                    className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {operationHistory.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-sm">
                      {t("No history available")}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {[...operationHistory].reverse().map((op) => (
                        <div
                          key={op.id}
                          className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:shadow-sm transition-all"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                              {op.action}
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">
                              {new Date(op.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
                            &quot;{op.input?.original_text?.substring(0, 35)}...&quot;
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <NotebookImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={(importedContent) => {
          const newContent = content
            ? content + "\n\n" + importedContent
            : importedContent;
          setContent(newContent);
        }}
      />
    </div>
  );
}
