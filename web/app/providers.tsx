"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { installApiCredentials } from "@/lib/api";

// Send the session cookie with backend requests (per-user data)
installApiCredentials();

export function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
