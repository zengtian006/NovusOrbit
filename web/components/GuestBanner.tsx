"use client";

import { usePathname } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";

/** Pages a signed-out visitor can try as a guest (see config/page_settings.yaml). */
const GUEST_PAGES = new Set(["/portfolio", "/ask"]);

/**
 * Tells a guest what they can do without an account (one CV, a few questions
 * a day) and offers sign-in, which keeps their CV and unlocks every tool.
 */
export default function GuestBanner() {
  const pathname = usePathname();
  const { status } = useSession();
  const { t } = useTranslation();

  if (status !== "unauthenticated" || !pathname || !GUEST_PAGES.has(pathname)) return null;

  const handleSignIn = () => signIn("google", { callbackUrl: window.location.pathname + window.location.search });

  return (
    <div className="shrink-0 border-b border-indigo-100 dark:border-indigo-500/20 bg-indigo-50/80 dark:bg-indigo-500/10 px-4 sm:px-6 py-2">
      <div className="flex items-center gap-3">
        <Sparkles className="hidden sm:block w-4 h-4 flex-shrink-0 text-indigo-500 dark:text-indigo-300" aria-hidden />
        <p className="flex-1 min-w-0 text-xs sm:text-sm text-indigo-900 dark:text-indigo-100">
          <span className="font-semibold">{t("You're trying NovusOrbit as a guest:")}</span>{" "}
          {t("1 CV and 10 questions a day. Sign in to keep your CV and unlock job matching, resume tailoring and interview prep.")}
        </p>
        <button
          onClick={handleSignIn}
          className="shrink-0 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
        >
          {t("Sign in free")}
        </button>
      </div>
    </div>
  );
}
