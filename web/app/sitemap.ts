import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_EXTERNAL || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3782'

    // Define your main pages
    const routes = [
        '',
        '/history',
        '/portfolio',
        '/notebook',
        '/jobs',
        '/interview',
        '/job-suggest',
        '/question',
        '/guide',
        '/ideagen',
        '/research',
        '/resume-writer',
    ].map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: route === '' ? 1 : 0.8,
    }))

    return routes
}
