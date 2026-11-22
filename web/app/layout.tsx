import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { GlobalProvider } from "@/context/GlobalContext";
import ThemeScript from "@/components/ThemeScript";
import LayoutWrapper from "@/components/LayoutWrapper";
import { I18nClientBridge } from "@/i18n/I18nClientBridge";
import { Providers } from "@/app/providers";
import {
  OrganizationStructuredData,
  WebApplicationStructuredData,
  WebSiteStructuredData,
} from "@/components/StructuredData";
import { SITE_URL, SITE_NAME, DEFAULT_DESCRIPTION } from "@/lib/site";

// Use Inter font with swap display for better loading
const font = Inter({
  subsets: ["latin"],
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "NovusOrbit: Free AI Career Assistant for Interviews, Resumes and Job Search",
    template: "%s | NovusOrbit",
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: "NovusOrbit" }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  // og:image / twitter:image come from app/opengraph-image.tsx and
  // app/twitter-image.tsx, which Next.js wires up automatically.
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    title: "NovusOrbit: Free AI Career Assistant",
    description: DEFAULT_DESCRIPTION,
    siteName: SITE_NAME,
  },
  twitter: {
    card: "summary_large_image",
    title: "NovusOrbit: Free AI Career Assistant",
    description: DEFAULT_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  // Every route sets its own canonical via pageMetadata(); this is the home page's.
  alternates: {
    canonical: "/",
  },
  category: "career",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className={font.className} suppressHydrationWarning>
        <OrganizationStructuredData />
        <WebSiteStructuredData />
        <WebApplicationStructuredData />
        <Providers>
          <GlobalProvider>
            <I18nClientBridge>
              <LayoutWrapper>
                <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden transition-colors duration-200">
                  <Sidebar />
                  <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
                    {children}
                  </main>
                </div>
              </LayoutWrapper>
            </I18nClientBridge>
          </GlobalProvider>
        </Providers>
      </body>
    </html>
  );
}
