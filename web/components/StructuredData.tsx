"use client";

import Script from "next/script";

interface StructuredDataProps {
    data: Record<string, any>;
}

/**
 * Component to inject JSON-LD structured data for SEO
 * https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data
 */
export default function StructuredData({ data }: StructuredDataProps) {
    return (
        <Script
            id={`structured-data-${data["@type"]}`}
            type="application/ld+json"
            dangerouslySetInnerHTML={{
                __html: JSON.stringify(data),
            }}
        />
    );
}

/**
 * Organization structured data for NovusOrbit
 */
export function OrganizationStructuredData() {
    const organizationData = {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "NovusOrbit",
        description: "AI-Powered Career Consulting Platform",
        url: process.env.NEXT_PUBLIC_API_BASE_EXTERNAL || "https://novusorbit.com",
        logo: `${process.env.NEXT_PUBLIC_API_BASE_EXTERNAL || ""}/logo.png`,
        sameAs: [
            // Add your social media URLs here
            // "https://twitter.com/novusorbit",
            // "https://linkedin.com/company/novusorbit",
            // "https://github.com/novusorbit",
        ],
        contactPoint: {
            "@type": "ContactPoint",
            contactType: "Customer Service",
            email: "zengtian006@gmail.com",
        },
    };

    return <StructuredData data={organizationData} />;
}

/**
 * WebApplication structured data
 */
export function WebApplicationStructuredData() {
    const webAppData = {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: "NovusOrbit",
        description:
            "AI-powered career consulting platform offering personalized resume reviews, interview preparation, and career guidance.",
        url: process.env.NEXT_PUBLIC_API_BASE_EXTERNAL || "https://novusorbit.com",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web Browser",
        offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
        },
        featureList: [
            "AI Career Consulting",
            "Resume Review & Optimization",
            "Interview Preparation",
            "Job Search Assistance",
            "Career Path Planning",
            "Portfolio Management",
        ],
    };

    return <StructuredData data={webAppData} />;
}

/**
 * Breadcrumb structured data
 */
export function BreadcrumbStructuredData({
    items,
}: {
    items: Array<{ name: string; url: string }>;
}) {
    const breadcrumbData = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.name,
            item: item.url,
        })),
    };

    return <StructuredData data={breadcrumbData} />;
}
