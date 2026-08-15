/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable ESLint and TypeScript errors from blocking builds
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Allow image optimization from any source
  images: {
    unoptimized: true,
  },
  // ponytail: delegate redirect logic to next.config instead of redundant page components
  async redirects() {
    return [
      { source: "/analysis", destination: "/", permanent: false },
      { source: "/chat", destination: "/", permanent: false },
      { source: "/knowledge", destination: "/", permanent: false },
      { source: "/reports", destination: "/", permanent: false },
      { source: "/settings", destination: "/", permanent: false },
      { source: "/upload", destination: "/", permanent: false },
    ];
  },
};

module.exports = nextConfig;
