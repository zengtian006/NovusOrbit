"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useSession, signIn, signOut } from "next-auth/react";
import { useAnalytics } from "@/hooks/useAnalytics";
import {
  MessageCircle,
  History,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  LucideIcon,
  LogOut,
  LogIn,
  Crown,
  Sun,
  Moon,
  BarChart3,
  CircleHelp,
  Check,
  Lock,
} from "lucide-react";
import { useGlobal } from "@/context/GlobalContext";
import FeedbackModal from "@/components/FeedbackModal";
import { Logo, LogoMark } from "@/components/Logo";
import { OPEN_GUIDE_EVENT } from "@/components/WelcomeGuide";
import { useJourney } from "@/components/JourneyProvider";
import { JOURNEY_STEPS } from "@/lib/journey";

const SIDEBAR_EXPANDED_WIDTH = 256;
const SIDEBAR_COLLAPSED_WIDTH = 64;

/** One sidebar entry; journey steps get a numbered badge that turns into a check when done. */
function NavLink({
  href,
  label,
  icon: Icon,
  badge,
  done,
  isLast,
  locked,
  pathname,
  sidebarCollapsed,
  showTooltip,
  setShowTooltip,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  done?: boolean;
  isLast?: boolean;
  locked?: boolean;
  pathname: string | null;
  sidebarCollapsed: boolean;
  showTooltip: string | null;
  setShowTooltip: (v: string | null) => void;
  onNavigate: (href: string) => void;
}) {
  const isActive = pathname === href;
  return (
    <div className="group relative">
      {/* Connector line between journey steps */}
      {badge !== undefined && !isLast && !sidebarCollapsed && (
        <span
          className={`absolute left-[19px] top-8 h-[calc(100%-20px)] w-px ${done ? "bg-emerald-300 dark:bg-emerald-800" : "bg-slate-200 dark:bg-slate-700"}`}
          aria-hidden
        />
      )}
      <Link
        href={href}
        aria-current={isActive ? "page" : undefined}
        className={`relative flex items-center rounded-md transition-all duration-200 ${sidebarCollapsed ? "justify-center p-2" : "gap-2.5 pl-2 pr-2 py-2"} ${
          isActive
            ? "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300"
            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
        }`}
        onClick={() => onNavigate(href)}
        onMouseEnter={() => sidebarCollapsed && setShowTooltip(href)}
        onMouseLeave={() => setShowTooltip(null)}
      >
        {badge !== undefined ? (
          <span
            className={`relative z-10 w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center text-[11px] font-semibold ring-2 ring-white dark:ring-slate-900 ${
              isActive
                ? "bg-indigo-600 text-white"
                : done
                  ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
            }`}
          >
            {done && !isActive ? <Check className="w-3.5 h-3.5" /> : badge}
          </span>
        ) : (
          <Icon
            className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"}`}
          />
        )}
        <span
          className={`font-medium text-sm whitespace-nowrap flex-1 transition-all duration-300 ${sidebarCollapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"}`}
        >
          {label}
        </span>
        {locked && !sidebarCollapsed && (
          <span title="Sign in to use" className="flex-shrink-0">
            <Lock className="w-3 h-3 text-slate-300 dark:text-slate-600" />
          </span>
        )}
        {badge !== undefined && !sidebarCollapsed && (
          <Icon
            className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-indigo-500 dark:text-indigo-400" : "text-slate-300 dark:text-slate-600 group-hover:text-slate-400"}`}
          />
        )}
      </Link>
      {sidebarCollapsed && showTooltip === href && (
        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 px-2.5 py-1.5 bg-slate-900 dark:bg-slate-700 text-white text-xs rounded-lg shadow-lg whitespace-nowrap pointer-events-none">
          {badge !== undefined ? `${badge}. ${label}` : label}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900 dark:border-r-slate-700" />
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { sidebarCollapsed, toggleSidebar, uiSettings, updateTheme, pageSettings } = useGlobal();
  const { progress } = useJourney();
  const { t } = useTranslation();

  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  // Track analytics
  const trackAnalytics = async (feature: string, action: string = "navigate") => {
    if (status !== "authenticated") return;

    try {
      await fetch("/api/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          feature,
          metadata: {
            timestamp: new Date().toISOString(),
            collapsed: sidebarCollapsed,
          },
        }),
      });
    } catch (error) {
      // Silently fail - don't disrupt user experience
      console.error("Analytics tracking error:", error);
    }
  };

  const doneCount = JOURNEY_STEPS.filter((st) => progress[st.id]).length;

  const navProps = {
    pathname,
    sidebarCollapsed,
    showTooltip,
    setShowTooltip,
    onNavigate: (href: string) => trackAnalytics(href, "navigate"),
  };

  const currentWidth = sidebarCollapsed
    ? SIDEBAR_COLLAPSED_WIDTH
    : SIDEBAR_EXPANDED_WIDTH;

  return (
    <div
      className="relative flex-shrink-0 bg-white dark:bg-slate-900 h-full border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300 ease-in-out overflow-hidden"
      style={{ width: currentWidth }}
    >
      {/* Header */}
      <div className={`flex items-center h-14 border-b border-slate-200/70 dark:border-slate-700/70 ${sidebarCollapsed ? "justify-center px-2" : "px-4"}`}>
        <Link href="/" className="flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" aria-label="NovusOrbit">
          {sidebarCollapsed ? <LogoMark size={30} /> : <Logo size={28} />}
        </Link>
      </div>
      {/* Navigation: the job-search journey, in order */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-5">
        <div>
          <div
            className={`flex items-center justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-1 transition-all duration-300 ${sidebarCollapsed ? "opacity-0 h-0 overflow-hidden" : "opacity-100"}`}
          >
            <span className="truncate">{t("Your job search")}</span>
            <span className="normal-case font-semibold text-slate-400 dark:text-slate-500">
              {doneCount}/{JOURNEY_STEPS.length}
            </span>
          </div>
          <ol className="relative space-y-0.5">
            {JOURNEY_STEPS.map((step, i) => (
              <li key={step.href}>
                <NavLink
                  href={step.href}
                  label={t(step.label)}
                  icon={step.icon}
                  badge={i + 1}
                  done={progress[step.id]}
                  isLast={i === JOURNEY_STEPS.length - 1}
                  locked={status !== "authenticated" && !!pageSettings?.[step.href]?.requireSSO}
                  {...navProps}
                />
              </li>
            ))}
          </ol>
        </div>

        <div>
          {sidebarCollapsed ? (
            <div className="h-px bg-slate-200 dark:bg-slate-700 my-2 mx-1" />
          ) : (
            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-1 truncate">
              {t("More")}
            </div>
          )}
          <NavLink href="/history" label={t("History")} icon={History} {...navProps} />
        </div>
      </nav>

      {/* Footer */}
      <div
        className="border-t border-slate-200/70 dark:border-slate-800 p-2"
      >
        {/* Admin Button - Only visible to admins */}
        {status === "authenticated" && (session?.user as any)?.role === "ADMIN" && (
          <>
            <div className="relative mb-2">
              <Link
                href="/admin/users"
                className={`flex items-center rounded-md text-sm transition-all duration-200 ${sidebarCollapsed
                  ? "justify-center p-2"
                  : "gap-2.5 pl-2 pr-1.5 py-2"
                  } ${pathname === "/admin/users"
                    ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 shadow-sm border border-amber-200 dark:border-amber-700"
                    : "text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-amber-600 dark:hover:text-amber-400"
                  }`}
                onClick={() => trackAnalytics("/admin/users", "navigate")}
                onMouseEnter={() => sidebarCollapsed && setShowTooltip("/admin")}
                onMouseLeave={() => setShowTooltip(null)}
              >
                <Crown
                  className={`w-5 h-5 flex-shrink-0 transition-colors ${pathname === "/admin/users"
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-slate-400 dark:text-slate-500"
                    }`}
                />
                <span
                  className={`whitespace-nowrap flex-1 transition-all duration-300 ${sidebarCollapsed
                    ? "opacity-0 w-0 overflow-hidden"
                    : "opacity-100"
                    }`}
                >
                  Admin
                </span>
              </Link>
              {/* Tooltip for collapsed state */}
              {sidebarCollapsed && showTooltip === "/admin" && (
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 px-2.5 py-1.5 bg-slate-900 dark:bg-slate-700 text-white text-xs rounded-lg shadow-lg whitespace-nowrap pointer-events-none">
                  Admin Panel
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900 dark:border-r-slate-700" />
                </div>
              )}
            </div>

            {/* Analytics Button */}
            <div className="relative mb-2">
              <Link
                href="/admin/analytics"
                className={`flex items-center rounded-md text-sm transition-all duration-200 ${sidebarCollapsed
                  ? "justify-center p-2"
                  : "gap-2.5 pl-2 pr-1.5 py-2"
                  } ${pathname === "/admin/analytics"
                    ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-200 dark:border-indigo-700"
                    : "text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400"
                  }`}
                onClick={() => trackAnalytics("/admin/analytics", "navigate")}
                onMouseEnter={() => sidebarCollapsed && setShowTooltip("/analytics")}
                onMouseLeave={() => setShowTooltip(null)}
              >
                <BarChart3
                  className={`w-5 h-5 flex-shrink-0 transition-colors ${pathname === "/admin/analytics"
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-slate-400 dark:text-slate-500"
                    }`}
                />
                <span
                  className={`whitespace-nowrap flex-1 transition-all duration-300 ${sidebarCollapsed
                    ? "opacity-0 w-0 overflow-hidden"
                    : "opacity-100"
                    }`}
                >
                  Analytics
                </span>
              </Link>
              {/* Tooltip for collapsed state */}
              {sidebarCollapsed && showTooltip === "/analytics" && (
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 px-2.5 py-1.5 bg-slate-900 dark:bg-slate-700 text-white text-xs rounded-lg shadow-lg whitespace-nowrap pointer-events-none">
                  Analytics
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900 dark:border-r-slate-700" />
                </div>
              )}
            </div>
          </>
        )}



        {/* Settings Button - Only visible to admins */}
        {status === "authenticated" && (session?.user as any)?.role === "ADMIN" && (
          <div className="relative">
            <Link
              href="/settings"
              className={`flex items-center rounded-md text-sm transition-all duration-200 ${sidebarCollapsed
                ? "justify-center p-2"
                : "gap-2.5 pl-2 pr-1.5 py-2"
                } ${pathname === "/settings"
                  ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-100 dark:border-slate-600"
                  : "text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
              onClick={() => trackAnalytics("/settings", "navigate")}
              onMouseEnter={() => sidebarCollapsed && setShowTooltip("/settings")}
              onMouseLeave={() => setShowTooltip(null)}
            >
              <Settings
                className={`w-5 h-5 flex-shrink-0 transition-colors ${pathname === "/settings"
                  ? "text-indigo-500 dark:text-indigo-400"
                  : "text-slate-400 dark:text-slate-500"
                  }`}
              />
              <span
                className={`whitespace-nowrap flex-1 transition-all duration-300 ${sidebarCollapsed
                  ? "opacity-0 w-0 overflow-hidden"
                  : "opacity-100"
                  }`}
              >
                {t("Settings")}
              </span>
            </Link>
            {/* Tooltip for collapsed state */}
            {sidebarCollapsed && showTooltip === "/settings" && (
              <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 px-2.5 py-1.5 bg-slate-900 dark:bg-slate-700 text-white text-xs rounded-lg shadow-lg whitespace-nowrap pointer-events-none">
                {t("Settings")}
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900 dark:border-r-slate-700" />
              </div>
            )}
          </div>
        )}

        {/* Account */}
        <div className="relative">
          {status === "authenticated" && session?.user ? (
            <div
              className={`flex items-center rounded-lg ${sidebarCollapsed ? "justify-center p-1.5" : "gap-2.5 px-2 py-1.5"}`}
              onMouseEnter={() => sidebarCollapsed && setShowTooltip("account")}
              onMouseLeave={() => setShowTooltip(null)}
            >
              <div className="w-7 h-7 flex items-center justify-center flex-shrink-0 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
                {session.user.name?.charAt(0).toUpperCase() || "U"}
              </div>
              {!sidebarCollapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{session.user.name || t("Account")}</p>
                    {session.user.email && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{session.user.email}</p>
                    )}
                  </div>
                  <button
                    onClick={() => signOut()}
                    className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 dark:hover:text-slate-200 dark:hover:bg-slate-700"
                    title={t("Sign out")}
                    aria-label={t("Sign out")}
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={() => signIn("google")}
              className={`w-full flex items-center justify-center rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium shadow-sm transition-colors ${sidebarCollapsed ? "p-2" : "gap-2 px-3 py-2"}`}
              onMouseEnter={() => sidebarCollapsed && setShowTooltip("account")}
              onMouseLeave={() => setShowTooltip(null)}
              aria-label={t("Sign In")}
            >
              <LogIn className="w-4 h-4 flex-shrink-0" />
              {!sidebarCollapsed && <span>{t("Sign In")}</span>}
            </button>
          )}
          {sidebarCollapsed && showTooltip === "account" && (
            <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 px-2.5 py-1.5 bg-slate-900 dark:bg-slate-700 text-white text-xs rounded-lg shadow-lg whitespace-nowrap pointer-events-none">
              {status === "authenticated" && session?.user ? session.user.name || t("Account") : t("Sign In")}
            </div>
          )}
        </div>

        {/* Utility row: feedback, theme, collapse */}
        <div className={`mt-2 flex items-center ${sidebarCollapsed ? "flex-col gap-1" : "gap-1"}`}>
          <button
            onClick={() => setShowFeedbackModal(true)}
            className="p-2 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-700 transition-colors"
            title={t("Send Feedback")}
            aria-label={t("Send Feedback")}
          >
            <MessageCircle className="w-4 h-4" />
          </button>
          <button
            onClick={() => window.dispatchEvent(new Event(OPEN_GUIDE_EVENT))}
            className="p-2 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-700 transition-colors"
            title={t("Show the welcome guide")}
            aria-label={t("Show the welcome guide")}
          >
            <CircleHelp className="w-4 h-4" />
          </button>
          <button
            onClick={() => updateTheme(uiSettings.theme === "dark" ? "light" : "dark")}
            className="p-2 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-700 transition-colors"
            title={uiSettings.theme === "dark" ? t("Light") : t("Dark")}
            aria-label={uiSettings.theme === "dark" ? t("Light") : t("Dark")}
          >
            {uiSettings.theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          {!sidebarCollapsed && (
            <div className="flex-1 flex items-center justify-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              {/* Public info pages (also gives crawlers a path to them from every screen) */}
              <Link href="/features" className="hover:text-indigo-600 dark:hover:text-indigo-400">
                {t("Features")}
              </Link>
              <Link href="/guides" className="hover:text-indigo-600 dark:hover:text-indigo-400">
                {t("Guides")}
              </Link>
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-700 transition-colors"
            title={sidebarCollapsed ? t("Expand sidebar") : t("Collapse sidebar")}
            aria-label={sidebarCollapsed ? t("Expand sidebar") : t("Collapse sidebar")}
          >
            {sidebarCollapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
      />
    </div>
  );
}
