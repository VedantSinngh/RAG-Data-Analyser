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
};

module.exports = nextConfig;
