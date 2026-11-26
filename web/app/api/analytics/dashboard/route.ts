import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * GET /api/analytics/dashboard - Get analytics dashboard data (admin only)
 */
export async function GET(request: Request) {
    try {
        const session = await auth();

        // Check if user is authenticated and is admin
        if (!session?.user || (session.user as any).role !== "ADMIN") {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const days = parseInt(searchParams.get("days") || "7");

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Get total events
        const totalEvents = await prisma.userAnalytics.count({
            where: {
                createdAt: { gte: startDate },
            },
        });

        // Get unique users count
        const uniqueUsers = await prisma.userAnalytics.findMany({
            where: {
                createdAt: { gte: startDate },
            },
            select: { userId: true },
            distinct: ["userId"],
        });

        // Get feature usage stats
        const featureStats = await prisma.userAnalytics.groupBy({
            by: ["feature"],
            where: {
                createdAt: { gte: startDate },
                action: { notIn: ["acquisition", "funnel"] },
            },
            _count: {
                feature: true,
            },
            orderBy: {
                _count: {
                    feature: "desc",
                },
            },
        });

        // Sign-up sources: first-visit channel, recorded once per user on sign-in
        // (see components/AcquisitionTracker.tsx)
        const sourceStats = await prisma.userAnalytics.groupBy({
            by: ["feature"],
            where: {
                action: "acquisition",
                createdAt: { gte: startDate },
            },
            _count: {
                feature: true,
            },
            orderBy: {
                _count: {
                    feature: "desc",
                },
            },
        });

        // Funnel by channel: users who signed up in this period, grouped by
        // source / campaign, and how many of them reached each journey step
        // (at any time since). This is what to compare paid channels on.
        const signups = await prisma.userAnalytics.findMany({
            where: { action: "acquisition", createdAt: { gte: startDate } },
            select: { userId: true, feature: true, metadata: true },
        });
        const channelOf = new Map<string, string>();
        for (const s of signups) {
            const campaign = (s.metadata as { campaign?: string } | null)?.campaign;
            channelOf.set(s.userId, campaign ? `${s.feature} / ${campaign}` : s.feature);
        }
        const milestones = channelOf.size
            ? await prisma.userAnalytics.findMany({
                  where: { action: "funnel", userId: { in: [...channelOf.keys()] } },
                  select: { userId: true, feature: true },
              })
            : [];
        const funnelMap = new Map<string, { channel: string; signups: number; steps: Record<string, number> }>();
        for (const channel of channelOf.values()) {
            const row = funnelMap.get(channel) ?? { channel, signups: 0, steps: {} };
            row.signups += 1;
            funnelMap.set(channel, row);
        }
        const seen = new Set<string>();
        for (const m of milestones) {
            const key = `${m.userId}:${m.feature}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const row = funnelMap.get(channelOf.get(m.userId)!);
            if (row) row.steps[m.feature] = (row.steps[m.feature] ?? 0) + 1;
        }
        const funnelBySource = [...funnelMap.values()].sort((a, b) => b.signups - a.signups);

        // Get action type distribution
        const actionStats = await prisma.userAnalytics.groupBy({
            by: ["action"],
            where: {
                createdAt: { gte: startDate },
            },
            _count: {
                action: true,
            },
        });

        // Get daily activity (last 7 days)
        const dailyActivity = await prisma.userAnalytics.findMany({
            where: {
                createdAt: { gte: startDate },
            },
            select: {
                createdAt: true,
                feature: true,
            },
        });

        // Process daily activity into chart data
        const dailyMap = new Map<string, number>();
        for (let i = 0; i < days; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split("T")[0];
            dailyMap.set(dateStr, 0);
        }

        dailyActivity.forEach((event: { createdAt: Date; feature: string }) => {
            const dateStr = new Date(event.createdAt).toISOString().split("T")[0];
            dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + 1);
        });

        const dailyData = Array.from(dailyMap.entries())
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // Get top users
        const topUsers = await prisma.userAnalytics.groupBy({
            by: ["userId", "userEmail"],
            where: {
                createdAt: { gte: startDate },
            },
            _count: {
                userId: true,
            },
            orderBy: {
                _count: {
                    userId: "desc",
                },
            },
            take: 10,
        });

        // Get recent events
        const recentEvents = await prisma.userAnalytics.findMany({
            where: {
                createdAt: { gte: startDate },
            },
            orderBy: {
                createdAt: "desc",
            },
            take: 50,
            select: {
                id: true,
                userId: true,
                userEmail: true,
                action: true,
                feature: true,
                createdAt: true,
                metadata: true,
            },
        });

        return NextResponse.json({
            summary: {
                totalEvents,
                uniqueUsers: uniqueUsers.length,
                avgEventsPerUser:
                    uniqueUsers.length > 0
                        ? (totalEvents / uniqueUsers.length).toFixed(2)
                        : 0,
            },
            featureStats: featureStats.map((stat: any) => ({
                feature: stat.feature,
                count: stat._count.feature,
            })),
            sourceStats: sourceStats.map((stat: any) => ({
                source: stat.feature,
                count: stat._count.feature,
            })),
            funnelBySource,
            actionStats: actionStats.map((stat: any) => ({
                action: stat.action,
                count: stat._count.action,
            })),
            dailyData,
            topUsers: topUsers.map((user: any) => ({
                userId: user.userId,
                userEmail: user.userEmail,
                eventCount: user._count.userId,
            })),
            recentEvents,
        });
    } catch (error) {
        console.error("Error fetching analytics dashboard:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
