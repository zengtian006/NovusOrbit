"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

const FIRST_TOUCH_KEY = "novusorbit-first-touch";
const SENT_KEY = "novusorbit-first-touch-sent";

interface FirstTouch {
  source: string;
  medium?: string;
  campaign?: string;
  referrer?: string;
  landing: string;
  at: string;
}

/** Where this visitor came from: a utm_source tag, else the referring site, else "direct". */
function detectFirstTouch(): FirstTouch {
  const params = new URLSearchParams(window.location.search);
  let referrerHost: string | undefined;
  try {
    const ref = document.referrer ? new URL(document.referrer) : null;
    if (ref && ref.host !== window.location.host) referrerHost = ref.host.replace(/^www\./, "");
  } catch {
    // Malformed referrer
  }
  return {
    source: params.get("utm_source") || referrerHost || "direct",
    medium: params.get("utm_medium") || undefined,
    campaign: params.get("utm_campaign") || undefined,
    referrer: referrerHost,
    landing: window.location.pathname,
    at: new Date().toISOString(),
  };
}

/**
 * Remembers how a visitor first found the site, and records it once as an
 * "acquisition" analytics event after they sign in, so Admin → Analytics can
 * compare launch channels. Analytics only accepts signed-in events, so
 * anonymous visits are kept in this browser until then.
 */
export default function AcquisitionTracker() {
  const { status } = useSession();

  useEffect(() => {
    try {
      if (!localStorage.getItem(FIRST_TOUCH_KEY)) {
        localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(detectFirstTouch()));
      }
    } catch {
      // Storage unavailable (private mode); skip attribution.
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    let touch: FirstTouch | null = null;
    try {
      if (localStorage.getItem(SENT_KEY)) return;
      const raw = localStorage.getItem(FIRST_TOUCH_KEY);
      touch = raw ? (JSON.parse(raw) as FirstTouch) : null;
    } catch {
      return;
    }
    if (!touch) return;
    fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "acquisition", feature: touch.source, metadata: touch }),
    })
      .then((res) => {
        if (res.ok) {
          try {
            localStorage.setItem(SENT_KEY, "1");
          } catch {
            // ignore
          }
        }
      })
      .catch(() => {
        // Retry on a later visit.
      });
  }, [status]);

  return null;
}
