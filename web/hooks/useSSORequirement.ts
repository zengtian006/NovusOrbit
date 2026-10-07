import { useGlobal } from "@/context/GlobalContext";

/**
 * Hook to check if SSO is required for a given page route
 * @param pathname - The page route path (e.g., "/interview", "/job-suggest")
 * @returns boolean - Whether SSO is required for this page
 */
export function useSSORequirement(pathname: string): boolean {
    const { pageSettings } = useGlobal();

    if (!pageSettings || !pageSettings[pathname]) {
        // Default to false if setting not found
        return false;
    }

    return pageSettings[pathname]?.requireSSO ?? false;
}

/**
 * Helper function to check if a route requires SSO (can be used outside of React components)
 * @param pathname - The page route path
 * @param pageSettings - The page settings object
 * @returns boolean - Whether SSO is required
 */
export function checkSSORequirement(
    pathname: string,
    pageSettings: Record<string, { requireSSO: boolean }> | undefined
): boolean {
    if (!pageSettings || !pageSettings[pathname]) {
        return false;
    }
    return pageSettings[pathname]?.requireSSO ?? false;
}
