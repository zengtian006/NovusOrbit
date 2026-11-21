/** @type {import('next').NextConfig} */

const nextConfig = {
  // Emit a self-contained server (.next/standalone) with only the traced
  // runtime dependencies, so the Docker image doesn't ship all of node_modules
  output: "standalone",

  // Move dev indicator to bottom-right corner
  devIndicators: {
    position: "bottom-right",
  },

  // Enable compression for better performance (SEO factor)
  compress: true,

  // Generate ETags for better caching
  generateEtags: true,

  // Power DNS prefetching for better performance
  poweredByHeader: false,

  // Image optimization configuration
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Redirects for removed/renamed pages
  async redirects() {
    return [
      // The old Knowledge Base page was renamed to My Portfolio
      { source: "/knowledge", destination: "/portfolio", permanent: true },
      // /chat was a duplicate of the Home chat
      { source: "/chat", destination: "/", permanent: true },
    ];
  },

  // Headers for security and SEO
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
