"use client";

import { initI18n } from "./init";

export function I18nClientBridge({ children }: { children: React.ReactNode }) {
  initI18n();
  return children;
}
