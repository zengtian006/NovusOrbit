// Sidebar-specific types

/**
 * Sidebar navigation order configuration
 */
export interface SidebarNavOrder {
  essential: string[]; // Array of href paths for ESSENTIAL TOOLS group
  advanced: string[]; // Array of href paths for ADVANCED TOOLS group
}

/**
 * Sidebar constants
 */
export const SIDEBAR_MIN_WIDTH = 64;
export const SIDEBAR_MAX_WIDTH = 320;
export const SIDEBAR_DEFAULT_WIDTH = 256;
export const SIDEBAR_COLLAPSED_WIDTH = 64;

/**
 * Default sidebar description
 */
export const DEFAULT_SIDEBAR_DESCRIPTION = "✨ NovusOrbit";

/**
 * Default navigation order
 */
export const DEFAULT_NAV_ORDER: SidebarNavOrder = {
  essential: ["/", "/portfolio", "/jobs", "/history", "/notebook"],
  advanced: [
    "/interview",
    "/job-suggest",
    "/resume-writer",
    // "/question",
    // "/guide",
    // "/ideagen",
    // "/research",
  ],
};
