"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Shows the backend's message when an API call is rate-limited (429) or needs
 * sign-in (401). Several pages ignore failed responses, so without this a
 * limited request would just look like nothing happened.
 */
export default function ApiLimitNotice() {
  const { t } = useTranslation();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const original = window.fetch;
    const patched: typeof window.fetch = async (...args) => {
      const res = await original(...args);
      if (res.status === 429 || res.status === 401) {
        const url = typeof args[0] === "string" ? args[0] : args[0] instanceof URL ? args[0].href : args[0].url;
        if (url.includes("/api/v1/")) {
          try {
            const data = await res.clone().json();
            if (typeof data?.detail === "string") setMessage(data.detail);
          } catch {
            // Not JSON; leave it to the page.
          }
        }
      }
      return res;
    };
    window.fetch = patched;
    return () => {
      if (window.fetch === patched) window.fetch = original;
    };
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 10000);
    return () => clearTimeout(timer);
  }, [message]);

  if (!message) return null;
  return (
    <div
      role="alert"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-md flex items-start gap-3 rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 px-4 py-3 text-sm text-amber-900 dark:text-amber-100 shadow-lg"
    >
      <p className="flex-1">{message}</p>
      <button onClick={() => setMessage(null)} aria-label={t("Dismiss")} className="opacity-70 hover:opacity-100">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
