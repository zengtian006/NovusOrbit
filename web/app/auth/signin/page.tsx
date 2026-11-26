"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { JOURNEY_STEPS } from "@/lib/journey";

const BENEFITS = [
  "Free, no credit card",
  "Your CV, saved jobs and history stay private to your account",
  "Pick up where you left off on any device",
];

function SignInContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const error = searchParams.get("error");
  // The tool the visitor was opening, if any (e.g. /portfolio -> "Upload CV").
  const target = JOURNEY_STEPS.find((s) => s.href === callbackUrl.split("?")[0]);
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslation();

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn("google", { callbackUrl });
    } catch (error) {
      console.error("Sign in error:", error);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <LogoMark size={44} className="mx-auto mb-4" />
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white mb-1.5">
              {target ? `${t("Sign in to use")} ${t(target.label)}` : t("Sign in to NovusOrbit")}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {target ? t(target.hint) : t("Save your portfolio, jobs and interview prep to your account.")}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400 text-sm">
              {error === "Callback" && "Invalid callback URL"}
              {error === "AccessDenied" && "Access was denied"}
              {error === "OAuthCallback" && "OAuth callback failed"}
              {!["Callback", "AccessDenied", "OAuthCallback"].includes(error) &&
                "An error occurred during sign in"}
            </div>
          )}

          {/* Google Sign-in Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 px-6 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {isLoading ? t("Signing in...") : t("Sign in with Google")}
          </button>

          <ul className="mt-6 space-y-2">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-500" aria-hidden />
                {t(b)}
              </li>
            ))}
          </ul>

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
            {t("Free to use. See how we handle your data in our")}{" "}
            <Link href="/privacy" className="text-indigo-600 dark:text-indigo-400 hover:underline">
              {t("Privacy page")}
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="text-slate-600 dark:text-slate-400">Loading...</div>
      </div>
    }>
      <SignInContent />
    </Suspense>
  );
}
