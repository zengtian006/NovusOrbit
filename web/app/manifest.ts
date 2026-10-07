import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'NovusOrbit - AI-Powered Career Consulting',
        short_name: 'NovusOrbit',
        description: 'Transform your career with personalized AI-powered consulting, resume reviews, and interview preparation.',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#667eea',
        orientation: 'portrait-primary',
        icons: [
            {
                src: '/icon-192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'maskable',
            },
            {
                src: '/icon-512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any',
            },
        ],
        categories: ['productivity', 'business', 'education'],
        lang: 'en-US',
    }
}
