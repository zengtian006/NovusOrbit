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
} from "@/components/StructuredData";

// Use Inter font with swap display for better loading
const font = Inter({
  subsets: ["latin"],
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_API_BASE_EXTERNAL || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3782'),
  title: {
    default: "NovusOrbit - AI-Powered Career Consulting Platform",
    template: "%s | NovusOrbit"
  },
  description: "Transform your career with NovusOrbit's AI-powered career consulting. Get personalized resume reviews, interview preparation, career guidance, and job search strategies powered by advanced AI technology.",
  keywords: ["career consulting", "AI career advisor", "resume review", "interview preparation", "job search", "career coach", "professional development", "career planning", "AI assistant", "career guidance"],
  authors: [{ name: "NovusOrbit Team" }],
  creator: "NovusOrbit",
  publisher: "NovusOrbit",
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
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    title: "NovusOrbit - AI-Powered Career Consulting Platform",
    description: "Transform your career with personalized AI-powered consulting, resume reviews, and interview preparation.",
    siteName: "NovusOrbit",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "NovusOrbit - AI Career Consulting",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NovusOrbit - AI-Powered Career Consulting",
    description: "Transform your career with personalized AI-powered consulting and guidance.",
    images: ["/og-image.png"],
    creator: "@NovusOrbit",
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
  verification: {
    // Add your verification codes here when you have them
    // google: 'your-google-verification-code',
    // yandex: 'your-yandex-verification-code',
    // bing: 'your-bing-verification-code',
  },
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
