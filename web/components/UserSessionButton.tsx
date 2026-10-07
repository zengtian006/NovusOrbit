"use client";

import { signOut, useSession } from "next-auth/react";
import Image from "next/image";
import { useState } from "react";

export default function UserSessionButton() {
  const { data: session, status } = useSession();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  if (status === "loading") {
    return <div className="w-10 h-10 rounded-full bg-slate-200 animate-pulse" />;
  }

  if (!session?.user) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut({ redirect: true, callbackUrl: "/auth/signin" });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        aria-label="User menu"
      >
        {session.user.image && (
          <Image
            src={session.user.image}
            alt={session.user.name || "User"}
            width={32}
            height={32}
            className="w-8 h-8 rounded-full"
          />
        )}
        <span className="hidden sm:inline text-sm font-medium text-slate-700 dark:text-slate-300">
          {session.user.name || session.user.email}
        </span>
      </button>

      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-50">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              {session.user.name}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {session.user.email}
            </p>
          </div>

          <a
            href="/settings"
            className="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Settings
          </a>

          <button
            onClick={handleSignOut}
            className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700 border-t border-slate-200 dark:border-slate-700"
          >
            Sign Out
          </button>
        </div>
      )}

      {isDropdownOpen && (
        <button
          className="fixed inset-0 z-40"
          onClick={() => setIsDropdownOpen(false)}
          aria-label="Close menu"
        />
      )}
    </div>
  );
}
