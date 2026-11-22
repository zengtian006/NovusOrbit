import nextConfig from "eslint-config-next";
import i18nPlugin from "./eslint/i18n-plugin.mjs";

const config = [
  ...nextConfig,
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    plugins: {
      i18n: i18nPlugin,
    },
    rules: {
      // During migration keep as warning; change to "error" once phase2/3 complete.
      "i18n/no-literal-ui-text": "warn",
    },
  },
  {
    // Public SEO pages are server-rendered in English on purpose
    // (react-i18next only runs on the client).
    files: [
      "app/features/**/*.tsx",
      "app/guides/**/*.tsx",
      "app/opengraph-image.tsx",
      "app/twitter-image.tsx",
      "components/marketing/**/*.tsx",
    ],
    rules: {
      "i18n/no-literal-ui-text": "off",
    },
  },
  {
    ignores: ["node_modules/**", ".next/**", "out/**"],
  },
];

export default config;
