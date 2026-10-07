"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
    BarChart3,
    Users,
    Activity,
    TrendingUp,
    Loader2,
    Calendar,
    MousePointerClick,
    Eye,
    Download,
    Filter,
    ArrowUpRight,
    ArrowDownRight,
    Minus,
} from "lucide-react";
import { useTranslation } from "react-i18next";

interface DashboardData {
    summary: {
        totalEvents: number;
        uniqueUsers: number;
        avgEventsPerUser: string;
    };
    featureStats: Array<{ feature: string; count: number }>;
    actionStats: Array<{ action: string; count: number }>;
    dailyData: Array<{ date: string; count: number }>;
    topUsers: Array<{ userId: string; userEmail: string | null; eventCount: number }>;
    recentEvents: Array<{
        id: string;
        userId: string;
        userEmail: string | null;
        action: string;
        feature: string;
        createdAt: string;
    }>;
}

export default function AdminAnalyticsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { t } = useTranslation();

    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState(7);

    // Check if user is admin
    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/signin");
        } else if (status === "authenticated") {
            const userRole = (session?.user as any)?.role;
            if (userRole !== "ADMIN") {
                router.push("/");
            }
        }
    }, [status, session, router]);

    // Fetch analytics data
    useEffect(() => {
        if ((session?.user as any)?.role !== "ADMIN") return;

        const fetchAnalytics = async () => {
            try {
                setLoading(true);
                const response = await fetch(`/api/analytics/dashboard?days=${timeRange}`);
                if (!response.ok) throw new Error("Failed to fetch analytics");
                const analyticsData = await response.json();
                setData(analyticsData);
            } catch (error) {
                console.error("Failed to load analytics:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();
    }, [session, timeRange]);

    if (status === "loading" || loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if ((session?.user as any)?.role !== "ADMIN" || !data) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4 md:p-6 lg:p-8">
            <div className="max-w-[1600px] mx-auto space-y-6">
                {/* Header Section */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                    <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                </div>
                                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                                    Analytics Overview
                                </h1>
                            </div>
                            <p className="text-slate-600 dark:text-slate-400 text-sm">
                                Monitor user engagement and feature adoption across your platform
                            </p>
                        </div>

                        {/* Time Range Selector */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">Period:</span>
                            <div className="inline-flex bg-slate-100 dark:bg-slate-900 rounded-lg p-1">
                                {[
                                    { days: 7, label: "7D" },
                                    { days: 14, label: "14D" },
                                    { days: 30, label: "30D" }
                                ].map(({ days, label }) => (
                                    <button
                                        key={days}
                                        onClick={() => setTimeRange(days)}
                                        className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${timeRange === days
                                            ? "bg-blue-600 text-white shadow-sm"
                                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                                            }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Key Metrics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Total Events Card */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                                EVENTS
                            </span>
                        </div>
                        <div className="space-y-1">
                            <p className="text-3xl font-bold text-slate-900 dark:text-white">
                                {data.summary.totalEvents.toLocaleString()}
                            </p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                Total interactions
                            </p>
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Last {timeRange} days
                            </p>
                        </div>
                    </div>

                    {/* Active Users Card */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                                <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                                USERS
                            </span>
                        </div>
                        <div className="space-y-1">
                            <p className="text-3xl font-bold text-slate-900 dark:text-white">
                                {data.summary.uniqueUsers.toLocaleString()}
                            </p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                Active users
                            </p>
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Unique visitors
                            </p>
                        </div>
                    </div>

                    {/* Engagement Rate Card */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                                <TrendingUp className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                                AVG
                            </span>
                        </div>
                        <div className="space-y-1">
                            <p className="text-3xl font-bold text-slate-900 dark:text-white">
                                {data.summary.avgEventsPerUser}
                            </p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                Events per user
                            </p>
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Engagement metric
                            </p>
                        </div>
                    </div>
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Daily Activity Chart - Takes 2 columns */}
                    <div className="xl:col-span-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                    Activity Timeline
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                    Daily event distribution
                                </p>
                            </div>
                        </div>
                        <div className="space-y-2.5">
                            {data.dailyData.map((day) => {
                                const maxCount = Math.max(...data.dailyData.map((d) => d.count));
                                const percentage = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
                                const date = new Date(day.date);
                                const formattedDate = date.toLocaleDateString("en-US", {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                });

                                return (
                                    <div key={day.date} className="group">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 w-24 flex-shrink-0">
                                                {formattedDate}
                                            </span>
                                            <div className="flex-1 bg-slate-100 dark:bg-slate-700/50 rounded-full h-8 overflow-hidden relative">
                                                <div
                                                    className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 h-full flex items-center justify-end px-3 transition-all duration-500 group-hover:from-blue-600 group-hover:to-blue-700"
                                                    style={{ width: `${Math.max(percentage, 3)}%` }}
                                                >
                                                    {day.count > 0 && (
                                                        <span className="text-xs font-bold text-white">
                                                            {day.count}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 w-16 text-right">
                                                {percentage > 0 ? `${percentage.toFixed(0)}%` : '0%'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Action Types Breakdown */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <MousePointerClick className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                Action Types
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                Event categories
                            </p>
                        </div>
                        <div className="space-y-3">
                            {data.actionStats.slice(0, 8).map((action, index) => {
                                const total = data.actionStats.reduce((sum, a) => sum + a.count, 0);
                                const percentage = total > 0 ? ((action.count / total) * 100).toFixed(1) : '0';
                                const colors = [
                                    'from-blue-500 to-blue-600',
                                    'from-emerald-500 to-emerald-600',
                                    'from-amber-500 to-amber-600',
                                    'from-purple-500 to-purple-600',
                                    'from-pink-500 to-pink-600',
                                    'from-cyan-500 to-cyan-600',
                                    'from-orange-500 to-orange-600',
                                    'from-indigo-500 to-indigo-600',
                                ];
                                const colorClass = colors[index % colors.length];

                                return (
                                    <div key={action.action} className="space-y-1.5">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-medium text-slate-700 dark:text-slate-300 capitalize">
                                                {action.action.replace(/_/g, ' ')}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-900 dark:text-white">
                                                    {action.count}
                                                </span>
                                                <span className="text-slate-500 dark:text-slate-400">
                                                    ({percentage}%)
                                                </span>
                                            </div>
                                        </div>
                                        <div className="h-2 bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full bg-gradient-to-r ${colorClass} transition-all duration-500`}
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Feature Usage & Top Users Section */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {/* Top Features */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <BarChart3 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                    Popular Features
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                    Most visited pages
                                </p>
                            </div>
                        </div>
                        <div className="space-y-3">
                            {data.featureStats.slice(0, 10).map((feature, index) => {
                                const maxCount = Math.max(...data.featureStats.map((f) => f.count));
                                const percentage = maxCount > 0 ? (feature.count / maxCount) * 100 : 0;
                                const isTopThree = index < 3;

                                return (
                                    <div key={feature.feature} className="group hover:bg-slate-50 dark:hover:bg-slate-700/30 p-2 rounded-lg transition-colors">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isTopThree
                                                ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-sm'
                                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                                                }`}>
                                                {index + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                                        {feature.feature}
                                                    </span>
                                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-2">
                                                        {feature.count}
                                                    </span>
                                                </div>
                                                <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-500"
                                                        style={{ width: `${percentage}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Top Active Users */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                    Top Contributors
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                    Most active users
                                </p>
                            </div>
                        </div>
                        <div className="space-y-3">
                            {data.topUsers.slice(0, 10).map((user, index) => {
                                const maxEvents = Math.max(...data.topUsers.map(u => u.eventCount));
                                const percentage = maxEvents > 0 ? (user.eventCount / maxEvents) * 100 : 0;
                                const isTopThree = index < 3;

                                return (
                                    <div
                                        key={user.userId}
                                        className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                                    >
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${isTopThree
                                            ? 'bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-md'
                                            : 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300'
                                            }`}>
                                            {index + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                                {user.userEmail || "Anonymous User"}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-amber-500 to-amber-600 transition-all duration-500"
                                                        style={{ width: `${percentage}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs font-bold text-slate-600 dark:text-slate-400 flex-shrink-0">
                                                    {user.eventCount} events
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Recent Activity Stream */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Eye className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                Live Activity Stream
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                Real-time user interactions
                            </p>
                        </div>
                    </div>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {data.recentEvents.slice(0, 20).map((event) => {
                            const date = new Date(event.createdAt);
                            const timeAgo = getTimeAgo(date);
                            const fullTime = date.toLocaleString();

                            return (
                                <div
                                    key={event.id}
                                    className="group p-3 bg-slate-50 dark:bg-slate-700/30 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-all duration-200 border border-transparent hover:border-slate-200 dark:hover:border-slate-600"
                                    title={fullTime}
                                >
                                    <div className="flex items-start justify-between gap-3 mb-2">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 group-hover:animate-pulse" />
                                            <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                                                {event.userEmail || "Anonymous"}
                                            </span>
                                        </div>
                                        <span className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0 font-medium">
                                            {timeAgo}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs ml-4">
                                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded font-semibold">
                                            {event.action.replace(/_/g, ' ')}
                                        </span>
                                        <span className="text-slate-400 dark:text-slate-500">→</span>
                                        <span className="font-mono text-slate-700 dark:text-slate-300 font-medium">
                                            {event.feature}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgb(148 163 184 / 0.4);
                    border-radius: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgb(148 163 184 / 0.6);
                }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgb(71 85 105 / 0.4);
                }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgb(71 85 105 / 0.6);
                }
            `}</style>
        </div>
    );
}

// Helper function to get relative time
function getTimeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}
