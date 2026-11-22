"use client";

import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
  useCallback,
} from "react";
import { wsUrl, apiUrl } from "@/lib/api";
import {
  initializeTheme,
  setTheme,
  getStoredTheme,
  type Theme,
} from "@/lib/theme";
import {
  loadFromStorage,
  saveToStorage,
  persistState,
  mergeWithDefaults,
  STORAGE_KEYS,
  EXCLUDE_FIELDS,
} from "@/lib/persistence";
import { debounce } from "@/lib/debounce";

// Language storage key
const LANGUAGE_STORAGE_KEY = "novusorbit-language";

// --- Types ---
// Chat Types
interface ChatSource {
  rag?: Array<{ kb_name: string; content: string }>;
  web?: Array<{ url: string; title?: string; snippet?: string }>;
}

interface HomeChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource;
  isStreaming?: boolean;
}

interface ChatState {
  sessionId: string | null;
  messages: HomeChatMessage[];
  isLoading: boolean;
  selectedKb: string;
  enableRag: boolean;
  enableWebSearch: boolean;
  currentStage: string | null;
}

// Sidebar Navigation Order Type
export interface SidebarNavOrder {
  essential: string[]; // Array of href paths for ESSENTIAL TOOLS group
  advanced: string[]; // Array of href paths for ADVANCED TOOLS group
}

interface GlobalContextType {
  // Chat
  chatState: ChatState;
  setChatState: React.Dispatch<React.SetStateAction<ChatState>>;
  sendChatMessage: (message: string) => void;
  clearChatHistory: () => void;
  loadChatSession: (sessionId: string) => Promise<void>;
  newChatSession: () => void;

  // UI Settings
  uiSettings: { theme: "light" | "dark"; language: "en" | "zh" };
  refreshSettings: () => Promise<void>;
  updateTheme: (theme: "light" | "dark") => Promise<void>;
  updateLanguage: (language: "en" | "zh") => Promise<void>;

  // Sidebar
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;

  // Sidebar Customization
  sidebarDescription: string;
  setSidebarDescription: (description: string) => Promise<void>;
  sidebarNavOrder: SidebarNavOrder;
  setSidebarNavOrder: (order: SidebarNavOrder) => Promise<void>;

  // Page Settings
  pageSettings: Record<string, { requireSSO: boolean }> | undefined;
  updatePageSetting: (page: string, setting: { requireSSO: boolean }) => Promise<void>;

  // Persistence utilities
  clearAllPersistence: () => void;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

// --- Default State Constants ---
// These are used for both initialization and state restoration

const DEFAULT_CHAT_STATE: ChatState = {
  sessionId: null,
  messages: [],
  isLoading: false,
  selectedKb: "",
  enableRag: false,
  enableWebSearch: false,
  currentStage: null,
};

export function GlobalProvider({ children }: { children: React.ReactNode }) {
  // --- UI Settings Logic ---
  const [uiSettings, setUiSettings] = useState<{
    theme: "light" | "dark";
    language: "en" | "zh";
  }>({ theme: "light", language: "en" });

  const [isInitialized, setIsInitialized] = useState(false);

  const refreshSettings = async () => {
    // Try to load from backend API first, fallback to localStorage
    try {
      const res = await fetch(apiUrl("/api/v1/settings"));
      if (res.ok) {
        const data = await res.json();
        const serverTheme = data.ui?.theme || "light";
        const serverLanguage = data.ui?.language || "en";
        setUiSettings({
          theme: serverTheme,
          language: serverLanguage,
        });
        setTheme(serverTheme);
        // Sync to localStorage as cache
        if (typeof window !== "undefined") {
          localStorage.setItem(LANGUAGE_STORAGE_KEY, serverLanguage);
        }
        return;
      }
    } catch (e) {
      console.warn(
        "Failed to load settings from server, using localStorage:",
        e,
      );
    }

    // Fallback to localStorage
    const storedTheme = getStoredTheme();
    const storedLanguage =
      typeof window !== "undefined"
        ? (localStorage.getItem(LANGUAGE_STORAGE_KEY) as "en" | "zh") || "en"
        : "en";

    const themeToUse = storedTheme || "light";
    setUiSettings({
      theme: themeToUse,
      language: storedLanguage,
    });
    setTheme(themeToUse);
  };

  const updateTheme = async (newTheme: "light" | "dark") => {
    // Update UI immediately
    setTheme(newTheme);
    setUiSettings((prev) => ({ ...prev, theme: newTheme }));

    // Persist to backend
    try {
      await fetch(apiUrl("/api/v1/settings/theme"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: newTheme }),
      });
    } catch (e) {
      console.warn("Failed to save theme to server:", e);
    }
  };

  const updateLanguage = async (newLanguage: "en" | "zh") => {
    // Update UI immediately
    setUiSettings((prev) => ({ ...prev, language: newLanguage }));
    if (typeof window !== "undefined") {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, newLanguage);
    }

    // Persist to backend
    try {
      await fetch(apiUrl("/api/v1/settings/language"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: newLanguage }),
      });
    } catch (e) {
      console.warn("Failed to save language to server:", e);
    }
  };

  useEffect(() => {
    // Initialize settings on first render
    if (!isInitialized) {
      // First apply localStorage theme immediately to avoid flash
      const initialTheme = initializeTheme();
      const storedLanguage =
        typeof window !== "undefined"
          ? (localStorage.getItem(LANGUAGE_STORAGE_KEY) as "en" | "zh") || "en"
          : "en";

      setUiSettings({
        theme: initialTheme,
        language: storedLanguage,
      });
      setIsInitialized(true);

      // Then async load from server (which may override)
      refreshSettings();
    }
  }, [isInitialized]);

  // --- Sidebar State ---
  const SIDEBAR_MIN_WIDTH = 64;
  const SIDEBAR_MAX_WIDTH = 320;
  const SIDEBAR_DEFAULT_WIDTH = 256;
  const SIDEBAR_COLLAPSED_WIDTH = 64;

  const [sidebarWidth, setSidebarWidthState] = useState<number>(
    SIDEBAR_DEFAULT_WIDTH,
  );
  const [sidebarCollapsed, setSidebarCollapsedState] = useState<boolean>(false);

  // Initialize sidebar state from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedWidth = localStorage.getItem("sidebarWidth");
      const storedCollapsed = localStorage.getItem("sidebarCollapsed");

      if (storedWidth) {
        const width = parseInt(storedWidth, 10);
        if (
          !isNaN(width) &&
          width >= SIDEBAR_MIN_WIDTH &&
          width <= SIDEBAR_MAX_WIDTH
        ) {
          setSidebarWidthState(width);
        }
      }

      // On phones the expanded sidebar would take most of the screen, so
      // always start collapsed there (not persisted, so desktop keeps its choice).
      if (window.matchMedia("(max-width: 767px)").matches) {
        setSidebarCollapsedState(true);
      } else if (storedCollapsed) {
        setSidebarCollapsedState(storedCollapsed === "true");
      }
    }
  }, []);

  const setSidebarWidth = (width: number) => {
    const clampedWidth = Math.max(
      SIDEBAR_MIN_WIDTH,
      Math.min(SIDEBAR_MAX_WIDTH, width),
    );
    setSidebarWidthState(clampedWidth);
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebarWidth", clampedWidth.toString());
    }
  };

  const setSidebarCollapsed = (collapsed: boolean) => {
    setSidebarCollapsedState(collapsed);
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebarCollapsed", collapsed.toString());
    }
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  // --- Sidebar Customization State ---
  const DEFAULT_DESCRIPTION = "✨ NovusOrbit";
  const DEFAULT_NAV_ORDER: SidebarNavOrder = {
    essential: ["/", "/portfolio", "/jobs", "/history"],
    advanced: [
      "/interview",
      "/job-suggest",
      "/resume-writer",
    ],
  };

  const [sidebarDescription, setSidebarDescriptionState] =
    useState<string>(DEFAULT_DESCRIPTION);
  const [sidebarNavOrder, setSidebarNavOrderState] =
    useState<SidebarNavOrder>(DEFAULT_NAV_ORDER);

  const [pageSettings, setPageSettingsState] = useState<Record<string, { requireSSO: boolean }> | undefined>(undefined);

  // Migrate old route names in saved nav order (e.g., /knowledge -> /portfolio)
  const migrateNavOrder = (order: SidebarNavOrder): SidebarNavOrder => {
    const routeMigrations: Record<string, string> = {
      "/knowledge": "/portfolio",
    };
    const migrateGroup = (hrefs: string[]) =>
      hrefs.map((href) => routeMigrations[href] || href);
    const migrated = {
      essential: migrateGroup(order.essential),
      advanced: migrateGroup(order.advanced),
    };
    // Only ensure /jobs is in essential as minimum requirement
    if (!migrated.essential.includes("/jobs")) {
      const portfolioIdx = migrated.essential.indexOf("/portfolio");
      migrated.essential.splice(portfolioIdx >= 0 ? portfolioIdx + 1 : 1, 0, "/jobs");
    }
    return migrated;
  };

  // Initialize sidebar and page settings from backend API
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Load sidebar settings
        const sidebarResponse = await fetch(apiUrl("/api/v1/settings/sidebar"));
        if (sidebarResponse.ok) {
          const data = await sidebarResponse.json();
          if (data.description) {
            setSidebarDescriptionState(data.description);
          }
          if (data.nav_order) {
            const migrated = migrateNavOrder(data.nav_order);
            setSidebarNavOrderState(migrated);
            // If migration changed anything, persist the updated order
            if (JSON.stringify(migrated) !== JSON.stringify(data.nav_order)) {
              fetch(apiUrl("/api/v1/settings/sidebar/nav-order"), {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nav_order: migrated }),
              }).catch(() => { });
            }
          }
        }

        // Load global page settings
        const pageResponse = await fetch(apiUrl("/api/v1/settings/page"));
        if (pageResponse.ok) {
          const pageSettingsData = await pageResponse.json();
          setPageSettingsState(pageSettingsData);
        }
      } catch (e) {
        console.error("Failed to load settings from backend:", e);
      }
    };
    loadSettings();
  }, []);

  const setSidebarDescription = async (description: string) => {
    setSidebarDescriptionState(description);
    // Save to backend
    try {
      await fetch(apiUrl("/api/v1/settings/sidebar/description"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
    } catch (e) {
      console.error("Failed to save sidebar description:", e);
    }
  };

  const setSidebarNavOrder = async (order: SidebarNavOrder) => {
    setSidebarNavOrderState(order);
    // Save to backend
    try {
      await fetch(apiUrl("/api/v1/settings/sidebar/nav-order"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nav_order: order }),
      });
    } catch (e) {
      console.error("Failed to save sidebar nav order:", e);
    }
  };

  const updatePageSetting = async (page: string, setting: { requireSSO: boolean }) => {
    const updated = { ...pageSettings, [page]: setting };
    setPageSettingsState(updated);
    // Save to backend
    try {
      await fetch(apiUrl("/api/v1/settings/page"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageSettings: updated }),
      });
    } catch (e) {
      console.error("Failed to save page settings:", e);
    }
  };

  // --- Hydration tracking for persistence ---
  // We need to restore state from localStorage AFTER hydration to avoid SSR mismatch
  const isHydrated = useRef(false);


  // --- Chat Logic ---
  const [chatState, setChatState] = useState<ChatState>(DEFAULT_CHAT_STATE);
  const chatWs = useRef<WebSocket | null>(null);
  // Use ref to always have the latest sessionId in WebSocket callbacks (avoid closure issues)
  const sessionIdRef = useRef<string | null>(null);

  // Debounced save for chat state
  const saveChatState = useCallback(
    debounce((state: ChatState) => {
      if (!isHydrated.current) return;
      const toSave = persistState(
        state,
        EXCLUDE_FIELDS.CHAT as unknown as (keyof ChatState)[],
      );
      saveToStorage(STORAGE_KEYS.CHAT_STATE, toSave);
    }, 500),
    [],
  );

  // Auto-save chat state on change (only after hydration)
  useEffect(() => {
    if (isHydrated.current) {
      saveChatState(chatState);
    }
  }, [chatState, saveChatState]);

  // --- Restore persisted state after hydration ---
  useEffect(() => {
    // This runs only on client after hydration
    if (typeof window === "undefined") return;

    // Load persisted states
    const persistedChat = loadFromStorage<Partial<ChatState>>(
      STORAGE_KEYS.CHAT_STATE,
      {},
    );

    // Restore chat state
    if (Object.keys(persistedChat).length > 0) {
      setChatState((prev) => {
        const merged = mergeWithDefaults(
          persistedChat,
          prev,
          EXCLUDE_FIELDS.CHAT as unknown as (keyof ChatState)[],
        );
        // Also update sessionIdRef
        if (merged.sessionId) {
          sessionIdRef.current = merged.sessionId;
        }
        return merged;
      });
    }

    // Mark as hydrated after restoring state
    isHydrated.current = true;
  }, []);

  const sendChatMessage = (message: string) => {
    if (!message.trim() || chatState.isLoading) return;

    // Add user message
    setChatState((prev) => ({
      ...prev,
      isLoading: true,
      currentStage: "connecting",
      messages: [...prev.messages, { role: "user", content: message }],
    }));

    // Close existing connection if any
    if (chatWs.current) {
      chatWs.current.close();
    }

    const ws = new WebSocket(wsUrl("/api/v1/chat"));
    chatWs.current = ws;

    let assistantMessage = "";

    ws.onopen = () => {
      // Build history from current messages (excluding the one just added)
      const history = chatState.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      ws.send(
        JSON.stringify({
          message,
          // Use ref to get the latest sessionId (avoids closure capturing stale state)
          session_id: sessionIdRef.current,
          history,
          kb_name: chatState.selectedKb,
          enable_rag: chatState.enableRag,
          enable_web_search: chatState.enableWebSearch,
        }),
      );
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "session") {
        // Store session ID from backend - update both ref and state
        sessionIdRef.current = data.session_id;
        setChatState((prev) => ({
          ...prev,
          sessionId: data.session_id,
        }));
      } else if (data.type === "status") {
        setChatState((prev) => ({
          ...prev,
          currentStage: data.stage || data.message,
        }));
      } else if (data.type === "stream") {
        assistantMessage += data.content;
        setChatState((prev) => {
          const messages = [...prev.messages];
          const lastMessage = messages[messages.length - 1];
          if (lastMessage?.role === "assistant" && lastMessage?.isStreaming) {
            // Update existing streaming message
            messages[messages.length - 1] = {
              ...lastMessage,
              content: assistantMessage,
            };
          } else {
            // Add new streaming message
            messages.push({
              role: "assistant",
              content: assistantMessage,
              isStreaming: true,
            });
          }
          return { ...prev, messages, currentStage: "generating" };
        });
      } else if (data.type === "sources") {
        setChatState((prev) => {
          const messages = [...prev.messages];
          const lastMessage = messages[messages.length - 1];
          if (lastMessage?.role === "assistant") {
            messages[messages.length - 1] = {
              ...lastMessage,
              sources: { rag: data.rag, web: data.web },
            };
          }
          return { ...prev, messages };
        });
      } else if (data.type === "result") {
        setChatState((prev) => {
          const messages = [...prev.messages];
          const lastMessage = messages[messages.length - 1];
          if (lastMessage?.role === "assistant") {
            messages[messages.length - 1] = {
              ...lastMessage,
              content: data.content,
              isStreaming: false,
            };
          }
          return {
            ...prev,
            messages,
            isLoading: false,
            currentStage: null,
          };
        });
        ws.close();
      } else if (data.type === "error") {
        setChatState((prev) => ({
          ...prev,
          isLoading: false,
          currentStage: null,
          messages: [
            ...prev.messages,
            { role: "assistant", content: `Error: ${data.message}` },
          ],
        }));
        ws.close();
      }
    };

    ws.onerror = () => {
      setChatState((prev) => ({
        ...prev,
        isLoading: false,
        currentStage: null,
        messages: [
          ...prev.messages,
          { role: "assistant", content: "Connection error. Please try again." },
        ],
      }));
    };

    ws.onclose = () => {
      if (chatWs.current === ws) {
        chatWs.current = null;
      }
      setChatState((prev) => ({
        ...prev,
        isLoading: false,
        currentStage: null,
      }));
    };
  };

  const clearChatHistory = () => {
    // Clear both ref and state
    sessionIdRef.current = null;
    setChatState((prev) => ({
      ...prev,
      sessionId: null,
      messages: [],
      currentStage: null,
    }));
  };

  const newChatSession = () => {
    // Close any existing WebSocket
    if (chatWs.current) {
      chatWs.current.close();
      chatWs.current = null;
    }
    // Reset to new session - clear both ref and state
    sessionIdRef.current = null;
    setChatState((prev) => ({
      ...prev,
      sessionId: null,
      messages: [],
      isLoading: false,
      currentStage: null,
    }));
  };

  const loadChatSession = async (sessionId: string) => {
    try {
      const response = await fetch(
        apiUrl(`/api/v1/chat/sessions/${sessionId}`),
      );
      if (!response.ok) {
        throw new Error("Session not found");
      }
      const session = await response.json();

      // Convert session messages to HomeChatMessage format
      const messages: HomeChatMessage[] = session.messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
        sources: msg.sources,
        isStreaming: false,
      }));

      // Restore session settings
      const settings = session.settings || {};

      // Update ref with loaded session ID for continued conversation
      sessionIdRef.current = session.session_id;

      setChatState((prev) => ({
        ...prev,
        sessionId: session.session_id,
        messages,
        selectedKb: settings.kb_name || prev.selectedKb,
        enableRag: settings.enable_rag ?? prev.enableRag,
        enableWebSearch: settings.enable_web_search ?? prev.enableWebSearch,
        isLoading: false,
        currentStage: null,
      }));
    } catch (error) {
      console.error("Failed to load session:", error);
      throw error;
    }
  };

  // --- Clear All Persistence ---
  const clearAllPersistence = useCallback(() => {
    // Import clearAllStorage dynamically to avoid circular dependencies
    import("@/lib/persistence").then(({ clearAllStorage }) => {
      clearAllStorage();
    });

    // Reset all states to defaults
    setChatState(DEFAULT_CHAT_STATE);
    sessionIdRef.current = null;
  }, []);

  return (
    <GlobalContext.Provider
      value={{
        chatState,
        setChatState,
        sendChatMessage,
        clearChatHistory,
        loadChatSession,
        newChatSession,
        uiSettings,
        refreshSettings,
        updateTheme,
        updateLanguage,
        sidebarWidth,
        setSidebarWidth,
        sidebarCollapsed,
        setSidebarCollapsed,
        toggleSidebar,
        sidebarDescription,
        setSidebarDescription,
        sidebarNavOrder,
        setSidebarNavOrder,
        pageSettings,
        updatePageSetting,
        clearAllPersistence,
      }}
    >
      {children}
    </GlobalContext.Provider>
  );
}

export const useGlobal = () => {
  const context = useContext(GlobalContext);
  if (!context) throw new Error("useGlobal must be used within GlobalProvider");
  return context;
};
