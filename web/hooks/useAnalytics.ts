import { useSession } from "next-auth/react";
import { useCallback } from "react";

interface AnalyticsEvent {
    action: string;
    feature: string;
    metadata?: Record<string, any>;
}

export function useAnalytics() {
    const { status } = useSession();

    const trackEvent = useCallback(
        async ({ action, feature, metadata = {} }: AnalyticsEvent) => {
            // Only track if user is authenticated
            if (status !== "authenticated") return;

            try {
                await fetch("/api/analytics/track", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action,
                        feature,
                        metadata: {
                            ...metadata,
                            timestamp: new Date().toISOString(),
                        },
                    }),
                });
            } catch (error) {
                // Silently fail - don't disrupt user experience
                console.error("Analytics tracking error:", error);
            }
        },
        [status]
    );

    return { trackEvent };
}
