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
