import { Metadata } from "next";

interface SEOProps {
    title: string;
    description: string;
    keywords?: string[];
    image?: string;
    url?: string;
    type?: "website" | "article";
    publishedTime?: string;
    modifiedTime?: string;
    author?: string;
}

/**
 * Generate comprehensive metadata for a page
 * Use this in page.tsx files with Next.js App Router
 * 
 * @example
 * ```tsx
 * export const metadata = generateMetadata({
 *   title: "Interview Preparation",
 *   description: "Prepare for your next interview with AI-powered practice sessions",
 *   keywords: ["interview", "job interview", "interview preparation"],
 * });
 * ```
 */
export function generateMetadata({
    title,
    description,
    keywords = [],
    image = "/og-image.png",
    url = "",
    type = "website",
    publishedTime,
    modifiedTime,
    author,
}: SEOProps): Metadata {
    const baseUrl =
        process.env.NEXT_PUBLIC_API_BASE_EXTERNAL ||
        process.env.NEXT_PUBLIC_API_BASE ||
        "http://localhost:3782";
    const fullUrl = `${baseUrl}${url}`;
    const fullImageUrl = image.startsWith("http") ? image : `${baseUrl}${image}`;

    return {
        title,
        description,
        keywords: keywords.length > 0 ? keywords : undefined,
        authors: author ? [{ name: author }] : undefined,
        openGraph: {
            title,
            description,
            url: fullUrl,
            siteName: "NovusOrbit",
            images: [
                {
                    url: fullImageUrl,
                    width: 1200,
                    height: 630,
                    alt: title,
                },
            ],
            locale: "en_US",
            type,
            publishedTime,
            modifiedTime,
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images: [fullImageUrl],
            creator: "@NovusOrbit",
        },
        alternates: {
            canonical: fullUrl,
        },
    };
}

/**
 * Common keywords for career-related pages
 */
export const careerKeywords = [
    "career",
    "job search",
    "career development",
    "professional development",
    "career consulting",
    "AI career advisor",
];

/**
 * Common keywords for interview-related pages
 */
export const interviewKeywords = [
    "interview",
    "job interview",
    "interview preparation",
    "interview practice",
    "interview questions",
    "mock interview",
];

/**
 * Common keywords for resume-related pages
 */
export const resumeKeywords = [
    "resume",
    "CV",
    "resume writing",
    "resume review",
    "resume optimization",
    "career documents",
];
