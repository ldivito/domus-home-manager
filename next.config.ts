import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  distDir: process.env.BUILD_MODE === 'production' ? '.next-prod' : '.next',
  eslint: {
    // Allow production builds to complete with ESLint warnings (not errors)
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Warning: This allows production builds to successfully complete even if
    // your project has TypeScript errors.
    ignoreBuildErrors: false,
  },
};

export default withNextIntl(nextConfig);
