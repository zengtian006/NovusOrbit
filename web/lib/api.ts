// API configuration and utility functions

// Get API base URL from environment variable
// This is automatically set by start_web.py based on config/main.yaml
// The .env.local file is auto-generated on startup with the correct backend port
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE ||
  (() => {
    if (typeof window !== "undefined") {
      console.error("NEXT_PUBLIC_API_BASE is not set.");
      console.error(
        "Please configure server ports in config/main.yaml and restart the application using: python scripts/start_web.py",
      );
      console.error(
        "The .env.local file will be automatically generated with the correct backend port.",
      );
    }
    // No fallback - port must be configured in config/main.yaml
    throw new Error(
      "NEXT_PUBLIC_API_BASE is not configured. Please set server ports in config/main.yaml and restart.",
    );
  })();

/**
 * Construct a full API URL from a path
 * @param path - API path (e.g., '/api/v1/portfolio/list')
 * @returns Full URL (e.g., 'http://localhost:8000/api/v1/portfolio/list')
 */
export function apiUrl(path: string): string {
  // Remove leading slash if present to avoid double slashes
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  // Remove trailing slash from base URL if present
  const base = API_BASE_URL.endsWith("/")
    ? API_BASE_URL.slice(0, -1)
    : API_BASE_URL;

  return `${base}${normalizedPath}`;
}

/**
 * Construct a WebSocket URL from a path
 * @param path - WebSocket path (e.g., '/api/v1/solve')
 * @returns WebSocket URL (e.g., 'ws://localhost:{backend_port}/api/v1/solve')
 * Note: backend_port is configured in config/main.yaml
 */
export function wsUrl(path: string): string {
  // Security Hardening: Convert http to ws and https to wss.
  // In production environments (where API_BASE_URL starts with https), this ensures secure websockets.
  const base = API_BASE_URL.replace(/^http:/, "ws:").replace(/^https:/, "wss:");

  // Remove leading slash if present to avoid double slashes
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  // Remove trailing slash from base URL if present
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;

  return `${normalizedBase}${normalizedPath}`;
}

/**
 * Make browser requests to the backend send the NextAuth session cookie.
 *
 * The backend identifies the signed-in user from that cookie to keep each
 * user's data separate. In production the API is same-origin, so fetch sends
 * cookies already; in local development the API runs on a different port
 * (cross-origin), where fetch omits cookies unless `credentials: "include"`.
 * This applies "include" to requests aimed at API_BASE_URL that don't set
 * credentials explicitly. WebSockets send cookies on their own.
 */
let credentialsInstalled = false;
export function installApiCredentials(): void {
  if (credentialsInstalled || typeof window === "undefined") return;
  credentialsInstalled = true;
  const base = API_BASE_URL.replace(/\/$/, "");
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (url.startsWith(base) && !(init && init.credentials)) {
      init = { ...init, credentials: "include" };
    }
    return originalFetch(input, init);
  };
}
