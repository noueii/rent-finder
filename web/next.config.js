/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable gzip compression
  compress: true,
  
  // Experimental features for performance
  experimental: {
    // Enable React Server Components optimizations
    serverComponentsExternalPackages: ['prisma'],
    
    // Enable memory optimizations
    memoryBasedWorkersCount: true,
  },

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
    domains: [
      // Add apartment listing image domains here
      'example.com',
      'images.example.com',
    ],
  },

  // Headers for performance
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
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
      {
        source: '/api/trpc/performance.:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },

  // Rewrites for API optimization
  async rewrites() {
    return [
      {
        source: '/health',
        destination: '/api/trpc/performance.healthCheck',
      },
      {
        source: '/metrics',
        destination: '/api/trpc/performance.getMetrics',
      },
    ];
  },

  // Webpack optimizations
  webpack: (config, { dev, isServer }) => {
    // Production optimizations
    if (!dev) {
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
            common: {
              minChunks: 2,
              chunks: 'all',
              enforce: true,
            },
          },
        },
      };
    }

    // Bundle analyzer (optional)
    if (process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: false,
        })
      );
    }

    return config;
  },

  // Performance budgets
  ...(process.env.NODE_ENV === 'production' && {
    // Enable source maps for debugging in production
    productionBrowserSourceMaps: false,
    
    // Remove console.log in production
    compiler: {
      removeConsole: {
        exclude: ['error', 'warn'],
      },
    },
  }),

  // Environment variables
  env: {
    REDIS_URL: process.env.REDIS_URL,
    DATABASE_URL: process.env.DATABASE_URL,
  },

  // Output settings
  output: 'standalone',
  
  // Trailing slash handling
  trailingSlash: false,
  
  // PoweredByHeader
  poweredByHeader: false,
  
  // React strict mode
  reactStrictMode: true,
  
  // SWC minification
  swcMinify: true,
};

module.exports = nextConfig;