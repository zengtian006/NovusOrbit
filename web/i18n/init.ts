import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enApp from "@/locales/en/app.json";

let _initialized = false;

/**
 * The UI is English-only. i18next stays as the single place UI strings are
 * looked up (`t("...")` returns the English text, or the key itself).
 */
export function initI18n() {
  if (_initialized) return i18n;

  i18n.use(initReactI18next).init({
    resources: { en: { app: enApp } },
    lng: "en",
    fallbackLng: "en",
    // Single namespace, and keySeparator disabled so keys like "Generating..." stay valid.
    defaultNS: "app",
    ns: ["app"],
    keySeparator: false,
    interpolation: {
      escapeValue: false,
    },
    returnEmptyString: false,
    returnNull: false,
  });

  _initialized = true;
  return i18n;
}
