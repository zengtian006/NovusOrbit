import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";

// Routes that *might* require authentication (default to protected)
// Actual requirement is determined by global page_settings.yaml
const PROTECTED_ROUTES = [
  "/research",
  "/solve",
  "/interview",
  "/guide",
  "/question",
  "/settings",
  "/notebook",
  "/job-suggest",
  "/ideagen",
];

// Cache for page settings
let pageSettingsCache: Record<string, { requireSSO: boolean }> | null = null;
let lastLoadTime = 0;
const CACHE_DURATION = 30000; // 30 seconds

function loadPageSettings(): Record<string, { requireSSO: boolean }> {
  const now = Date.now();

  // Return cached settings if still fresh
  if (pageSettingsCache && now - lastLoadTime < CACHE_DURATION) {
    return pageSettingsCache;
  }

  try {
    // Load from config/page_settings.yaml
    const configPath = path.join(process.cwd(), "..", "config", "page_settings.yaml");
    const fileContent = fs.readFileSync(configPath, "utf-8");
    const data = yaml.load(fileContent) as any;
    const settings = data?.pages || {};
    pageSettingsCache = settings;
    lastLoadTime = now;
    return settings;
  } catch (error) {
    console.warn("Failed to load page settings:", error);
    // Default: all routes require SSO if config not found
    return PROTECTED_ROUTES.reduce((acc, route) => {
      const pathWithSlash = route.startsWith("/") ? route : `/${route}`;
      acc[pathWithSlash] = { requireSSO: true };
      return acc;
    }, {} as Record<string, { requireSSO: boolean }>);
  }
}

function routeRequiresSSO(pathname: string): boolean {
  const pageSettings = loadPageSettings();

  // Check if this route has a setting
  if (pageSettings[pathname]) {
    return pageSettings[pathname].requireSSO;
  }

  // Check if route is in protected list (default to true if no setting found)
  return PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
}

// Build matcher from protected routes
export const config = {
  runtime: "nodejs",
  matcher: [
    "/research",
    "/solve",
    "/interview",
    "/guide",
    "/question",
    "/settings",
    "/notebook",
    "/job-suggest",
    "/ideagen",
  ],
};

// Wrap middleware with auth() from NextAuth
export default auth((req) => {
  const pathname = req.nextUrl.pathname;

  // Check if this specific route requires SSO
  const requiresSSO = routeRequiresSSO(pathname);

  // If SSO is required and user is not authenticated, redirect to sign-in
  if (requiresSSO && !req.auth) {
    const signInUrl = new URL("/auth/signin", req.nextUrl.origin);
    signInUrl.searchParams.append("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Check admin-only routes
  if (pathname.startsWith("/admin") || pathname === "/settings") {
    const userRole = (req.auth?.user as any)?.role;
    if (userRole !== "ADMIN") {
      return NextResponse.redirect(new URL("/", req.nextUrl.origin));
    }
  }

  return NextResponse.next();
});
