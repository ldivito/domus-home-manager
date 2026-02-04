import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const isProduction = process.env.NODE_ENV === 'production';
const isVercelBuild = process.env.VERCEL === '1' || process.env.BUILD_MODE === 'production';

const nextConfig: NextConfig = {
  // Configuración de directorio como en Vercel
  distDir: isVercelBuild ? '.next-prod' : '.next',
  
  // Configuraciones de optimización como Vercel
  experimental: {
    optimizeCss: isProduction,
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },

  // Configuraciones de compilación
  compiler: {
    removeConsole: isProduction ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // Configuraciones de bundle
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      // Optimizaciones de bundle para producción (como Vercel)
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
            },
          },
        },
      };
    }
    return config;
  },

  // Configuraciones de imágenes
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Headers de seguridad como Vercel
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block',
        },
      ],
    },
  ],

  // Configuraciones de output
  output: 'standalone',
  
  // Configuraciones de power
  poweredByHeader: false,
};

export default withNextIntl(nextConfig);