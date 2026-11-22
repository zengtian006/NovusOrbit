"use client";

import PageHeader from "@/components/PageHeader";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import ResumeWriterEditor from "@/components/ResumeWriterEditor";
import { FileText, X, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useGlobal } from "@/context/GlobalContext";

const ATS_OPTIMIZATION_TIPS = [
  "Use standard section headers (Experience, Education, Skills)",
  "Include relevant keywords from job description",
  "Use standard fonts and simple formatting",
  "Avoid graphics, images, and complex layouts",
  "Use standard bullet points, not special symbols",
  "Include your location and phone number",
];

export default function ResumeWriterPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation();
  const { pageSettings } = useGlobal();
  const [showAtsPanel, setShowAtsPanel] = useState(true);

  useEffect(() => {
    // Only check SSO after pageSettings have been loaded from backend
    // If pageSettings is undefined, we're still loading, so don't redirect yet
    if (pageSettings !== undefined) {
      const requireSSO = pageSettings["/resume-writer"]?.requireSSO ?? false;
      if (requireSSO && status === "unauthenticated") {
        router.push("/auth/signin");
      }
    }
  }, [status, router, pageSettings]);

  return (
    <div className="h-screen animate-fade-in flex flex-col p-6">
      {/* Header */}
      <div className="mb-4 shrink-0">
        <PageHeader icon={FileText} title={t("Resume Writer")} description={t("AI-powered resume editor to enhance your professional documents and optimize for ATS systems.")} />
      </div>

      {/* ATS Tips Panel */}
      {showAtsPanel && (
        <div className="mb-4 shrink-0 bg-gradient-to-br from-indigo-50 to-cyan-50 dark:from-indigo-900/20 dark:to-cyan-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h3 className="font-semibold text-indigo-900 dark:text-indigo-200">
                {t("ATS Optimization Tips")}
              </h3>
            </div>
            <button
              onClick={() => setShowAtsPanel(false)}
              className="text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {ATS_OPTIMIZATION_TIPS.map((tip, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-xs text-indigo-800 dark:text-indigo-200"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Editor Container */}
      <div className="flex-1 min-h-0">
        <ResumeWriterEditor />
      </div>
    </div>
  );
}
