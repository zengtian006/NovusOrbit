"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { LogoMark } from "@/components/Logo";
import {
  Send,
  Loader2,
  Bot,
  User,
  Database,
  Globe,
  Trash2,
  ExternalLink,
  BookOpen,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { useGlobal } from "@/context/GlobalContext";
import { apiUrl } from "@/lib/api";
import { processLatexContent } from "@/lib/latex";
import { useTranslation } from "react-i18next";
import { useAnalytics } from "@/hooks/useAnalytics";

interface KnowledgeBase {
  name: string;
  is_default?: boolean;
}

export default function AskPage() {
  const router = useRouter();
  const {
    chatState,
    setChatState,
    sendChatMessage,
    clearChatHistory,
    newChatSession,
  } = useGlobal();
  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();

  const [inputMessage, setInputMessage] = useState("");
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [kbsLoaded, setKbsLoaded] = useState(false);
  const [showRagWarning, setShowRagWarning] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch knowledge bases
  useEffect(() => {
    fetch(apiUrl("/api/v1/portfolio/list"))
      .then((res) => res.json())
      .then((data) => {
        // Ensure data is an array before processing
        const kbList = Array.isArray(data) ? data : [];
        setKbs(kbList);
        setKbsLoaded(true);
        if (kbList.length === 0) {
          // Clear selectedKb if no portfolios exist
          setChatState((prev) => ({ ...prev, selectedKb: "" }));
        } else if (!chatState.selectedKb) {
          // First visit with a portfolio: select it and turn Portfolio on, so
          // the user can start chatting without hunting for the toggle.
          const defaultKb = kbList.find((kb: KnowledgeBase) => kb.is_default) ?? kbList[0];
          setChatState((prev) => ({ ...prev, selectedKb: defaultKb.name, enableRag: true }));
        }
      })
      .catch((err) => {
        console.error("Failed to fetch KBs:", err);
        setKbsLoaded(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      // Use scrollTop instead of scrollIntoView to prevent page-level scrolling
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [chatState.messages]);

  // Question handed over from Home (/ask?q=...): send it once a CV is selected.
  const pendingQuestion = useRef<string | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q?.trim()) {
      pendingQuestion.current = q.trim();
      window.history.replaceState(null, "", "/ask");
    }
  }, []);
  useEffect(() => {
    const q = pendingQuestion.current;
    if (!q || !kbsLoaded) return;
    if (chatState.selectedKb && chatState.enableRag) {
      pendingQuestion.current = null;
      trackEvent({ action: "send_message", feature: "/ask", metadata: { messageLength: q.length, from: "home" } });
      sendChatMessage(q);
    } else if (kbs.length === 0) {
      // No CV yet: nothing to ground the answer in; the page already prompts for an upload.
      pendingQuestion.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kbsLoaded, chatState.selectedKb, chatState.enableRag]);

  const handleSend = () => {
    if (!inputMessage.trim() || chatState.isLoading) return;
    // Check if RAG is enabled or portfolio is selected
    if (!chatState.enableRag || !chatState.selectedKb) {
      setShowRagWarning(true);
      // Hide warning after 4 seconds
      setTimeout(() => setShowRagWarning(false), 4000);
      return;
    }
    trackEvent({ action: "send_message", feature: "/ask", metadata: { messageLength: inputMessage.length } });
    sendChatMessage(inputMessage);
    setInputMessage("");
    setShowRagWarning(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePortfolioChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === "add-portfolio") {
      router.push("/portfolio");
    } else {
      setChatState((prev) => ({
        ...prev,
        selectedKb: value,
      }));
    }
  };

  const hasMessages = chatState.messages.length > 0;

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Empty State / Welcome Screen */}
      {!hasMessages && (
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <LogoMark size={48} className="mx-auto mb-5" />
            <h1 className="text-3xl sm:text-4xl font-semibold text-slate-900 dark:text-white mb-3 tracking-tight">
              {t("Ask your career coach")}
            </h1>
            <p className="text-base sm:text-lg text-slate-500 dark:text-slate-400">
              {t("How to pitch yourself, what to learn next, how to answer a tricky question: answers grounded in your own CV.")}
            </p>
          </div>

          {/* Input Box - Centered */}
          <div className="w-full max-w-2xl mx-auto mb-12">
            {/* Mode Toggles */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">

                {/* Web Search Toggle */}
                <button
                  onClick={() => {
                    trackEvent({ action: "toggle_web_search", feature: "/ask", metadata: { enabled: !chatState.enableWebSearch } });
                    setChatState((prev) => ({
                      ...prev,
                      enableWebSearch: !prev.enableWebSearch,
                    }));
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${chatState.enableWebSearch
                    ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  {t("Web Search")}
                </button>
                {/* RAG Toggle */}
                <button
                  onClick={() => {
                    trackEvent({ action: "toggle_rag", feature: "/ask", metadata: { enabled: !chatState.enableRag } });
                    setChatState((prev) => ({
                      ...prev,
                      enableRag: !prev.enableRag,
                    }));
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${chatState.enableRag
                    ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                >
                  <Database className="w-3.5 h-3.5" />
                  {t("Portfolio")}
                </button>
                {/* <span
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700"
                >
                  <Database className="w-3.5 h-3.5" />
                  {t("Resume")}
                </span> */}

                {/* KB Selector */}
                {chatState.enableRag && (
                  <div className="flex items-center gap-2">
                    <select
                      value={chatState.selectedKb || ""}
                      onChange={handlePortfolioChange}
                      className="text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-3 py-1.5 outline-none focus:border-indigo-400 dark:text-slate-200"
                    >
                      {kbs.length === 0 ? (
                        <option value="" disabled>
                          {t("No portfolios")}
                        </option>
                      ) : (
                        kbs.map((kb) => (
                          <option key={kb.name} value={kb.name}>
                            {kb.name}
                          </option>
                        ))
                      )}
                      <option value="add-portfolio" className="text-indigo-600">
                        + {t("Add Portfolio")}
                      </option>

                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Portfolio Required Banner */}
            {showRagWarning && (
              <div className="mb-4 p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                <Database className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-100 mb-1">
                    {t("Portfolio is required to start chatting")}
                  </p>
                  <p className="text-sm text-indigo-800 dark:text-indigo-200">
                    {t("Enable your Portfolio above to unlock personalized career advice tailored to your background")}
                  </p>
                </div>
              </div>
            )}

            {/* Input Field */}
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                className="w-full px-5 py-4 pr-14 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-700 dark:text-slate-200 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50"
                placeholder={chatState.enableRag && chatState.selectedKb
                  ? t("Ask anything about") + " " + chatState.selectedKb + "..."
                  : kbsLoaded && kbs.length === 0
                    ? t("Upload your CV to start chatting...")
                    : t("Turn on Portfolio to start chatting...")
                }
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={chatState.isLoading}
              />
              <button
                onClick={handleSend}
                disabled={chatState.isLoading || !inputMessage.trim()}
                className="absolute right-2 top-2 bottom-2 aspect-square bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all shadow-md shadow-indigo-500/20"
                title={t("Send message")}
              >
                {chatState.isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Sample Queries */}
            {kbs.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3 justify-center">
              {[
                t("Review my resume and suggest improvements"),
                t("What skills should I develop for a promotion?"),
                t("Help me prepare for a job interview"),
                t("Analyze my career path and suggest next steps"),
              ].map((query, i) => (
                <button
                  key={i}
                  onClick={() => {
                    trackEvent({ action: "quick_query_click", feature: "/ask", metadata: { query } });
                    setInputMessage(query);
                    // Use setTimeout to ensure state is updated before calling handleSend
                    setTimeout(() => {
                      // Check if RAG is enabled or portfolio is selected
                      if (!chatState.enableRag || !chatState.selectedKb) {
                        setShowRagWarning(true);
                        setTimeout(() => setShowRagWarning(false), 4000);
                        setInputMessage("");
                        return;
                      }
                      sendChatMessage(query);
                      setInputMessage("");
                      setShowRagWarning(false);
                    }, 0);
                  }}
                  className="text-xs px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-600 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
                >
                  {query}
                </button>
              ))}
            </div>
            )}
          </div>

          <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
            {t("New here?")}{" "}
            <Link href="/features" className="text-indigo-600 dark:text-indigo-400 hover:underline">
              {t("See what NovusOrbit can do")}
            </Link>
            {" · "}
            <Link href="/guides" className="text-indigo-600 dark:text-indigo-400 hover:underline">
              {t("Career guides")}
            </Link>
          </p>
        </div>
      )}

      {/* Chat Interface - When there are messages */}
      {hasMessages && (
        <>
          {/* Header Bar */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <div className="flex items-center gap-3">

              <button
                onClick={() => {
                  trackEvent({ action: "toggle_web_search", feature: "/ask", metadata: { enabled: !chatState.enableWebSearch } });
                  setChatState((prev) => ({
                    ...prev,
                    enableWebSearch: !prev.enableWebSearch,
                  }));
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${chatState.enableWebSearch
                  ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                  }`}
              >
                <Globe className="w-3 h-3" />
                {t("Web Search")}
              </button>
              {/* Mode Toggles */}
              <button
                onClick={() => {
                  trackEvent({ action: "toggle_rag", feature: "/ask", metadata: { enabled: !chatState.enableRag } });
                  setChatState((prev) => ({
                    ...prev,
                    enableRag: !prev.enableRag,
                  }));
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${chatState.enableRag
                  ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                  }`}
              >
                <Database className="w-3 h-3" />
                {t("Portfolio")}
              </button>
              {/* <span
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300"
              >
                <Database className="w-3 h-3" />
                {t("Portfolio")}
              </span> */}



              {chatState.enableRag && (
                <select
                  value={chatState.selectedKb || ""}
                  onChange={handlePortfolioChange}
                  className="text-xs bg-slate-100 dark:bg-slate-800 border-0 rounded-lg px-2 py-1 outline-none dark:text-slate-200"
                >
                  {kbs.length === 0 ? (
                    <option value="" disabled>
                      {t("No portfolios - Add one below")}
                    </option>
                  ) : (
                    kbs.map((kb) => (
                      <option key={kb.name} value={kb.name}>
                        {kb.name}
                      </option>
                    ))
                  )}
                  <option value="add-portfolio" className="text-indigo-600">
                    + {t("Add Portfolio")}
                  </option>
                </select>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  trackEvent({ action: "new_chat_session", feature: "/ask" });
                  newChatSession();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t("New Chat")}
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto px-6 py-6 space-y-6"
          >
            {chatState.messages.map((msg, idx) => (
              <div
                key={idx}
                className="flex gap-4 w-full max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-2"
              >
                {msg.role === "user" ? (
                  <>
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    </div>
                    <div className="flex-1 bg-slate-100 dark:bg-slate-700 px-4 py-3 rounded-2xl rounded-tl-none text-slate-800 dark:text-slate-200">
                      {msg.content}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/30">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="bg-white dark:bg-slate-800 px-5 py-4 rounded-2xl rounded-tl-none border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="prose prose-slate dark:prose-invert prose-sm max-w-none">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                          >
                            {processLatexContent(msg.content)}
                          </ReactMarkdown>
                        </div>

                        {/* Loading indicator */}
                        {msg.isStreaming && (
                          <div className="flex items-center gap-2 mt-3 text-indigo-600 dark:text-indigo-400 text-sm">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>{t("Generating response...")}</span>
                          </div>
                        )}
                      </div>

                      {/* Sources */}
                      {msg.sources &&
                        (msg.sources.rag?.length ?? 0) +
                        (msg.sources.web?.length ?? 0) >
                        0 && (
                          <div className="flex flex-wrap gap-2">
                            {msg.sources.rag?.map((source, i) => (
                              <div
                                key={`rag-${i}`}
                                className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs"
                              >
                                <BookOpen className="w-3 h-3" />
                                <span>{source.kb_name}</span>
                              </div>
                            ))}
                            {msg.sources.web?.slice(0, 3).map((source, i) => (
                              <a
                                key={`web-${i}`}
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                              >
                                <Globe className="w-3 h-3" />
                                <span className="max-w-[150px] truncate">
                                  {source.title || source.url}
                                </span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ))}
                          </div>
                        )}
                    </div>
                  </>
                )}
              </div>
            ))}

            {/* Status indicator */}
            {chatState.isLoading && chatState.currentStage && (
              <div className="flex gap-4 w-full max-w-4xl mx-auto">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shrink-0">
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                </div>
                <div className="flex-1 bg-slate-100 dark:bg-slate-800 px-4 py-3 rounded-2xl rounded-tl-none">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 text-sm">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                    {chatState.currentStage === "rag" &&
                      t("Searching knowledge base...")}
                    {chatState.currentStage === "web" &&
                      t("Searching the web...")}
                    {chatState.currentStage === "generating" &&
                      t("Generating response...")}
                    {!["rag", "web", "generating"].includes(
                      chatState.currentStage,
                    ) && chatState.currentStage}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input Area - Fixed at bottom */}
          <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 py-4">
            {/* Portfolio Required Banner */}
            {showRagWarning && (
              <div className="mb-4 p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                <Database className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-100 mb-1">
                    {t("Portfolio is required to start chatting")}
                  </p>
                  <p className="text-sm text-indigo-800 dark:text-indigo-200">
                    {t("Enable your Portfolio above to unlock personalized career advice tailored to your background")}
                  </p>
                </div>
              </div>
            )}
            <div className="max-w-4xl mx-auto relative">
              <input
                ref={inputRef}
                type="text"
                className="w-full px-5 py-3.5 pr-14 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-700 dark:text-slate-200"
                placeholder={t("Type your message...")}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={chatState.isLoading}
              />
              <button
                onClick={handleSend}
                disabled={chatState.isLoading || !inputMessage.trim()}
                className="absolute right-2 top-2 bottom-2 aspect-square bg-indigo-600 text-white rounded-lg flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all"
                title={t("Send message")}
              >
                {chatState.isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
