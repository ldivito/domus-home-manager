import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  distDir: process.env.BUILD_MODE === 'production' ? '.next-prod' : '.next',
};

export default withNextIntl(nextConfig);
