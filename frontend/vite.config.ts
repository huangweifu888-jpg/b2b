import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { atoms } from '@metagptx/web-sdk/plugins';
import { vitePrerenderPlugin } from 'vite-prerender-plugin';
import Sitemap from 'vite-plugin-sitemap';
import { getBlogRoutes } from './prerender/blog-routes.js';
import { getSitemapLastmod } from './prerender/blog-sitemap.js';

function escapeHtmlAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

process.env.VITE_APP_TITLE ??= process.env.OVERVIEW_TITLE ?? 'TradeHQ Console';
process.env.VITE_APP_DESCRIPTION ??= process.env.OVERVIEW_DESCRIPTION ?? '外贸 B2B 多端运营平台';
process.env.VITE_APP_TITLE = escapeHtmlAttr(process.env.VITE_APP_TITLE);
process.env.VITE_APP_DESCRIPTION = escapeHtmlAttr(process.env.VITE_APP_DESCRIPTION);
process.env.VITE_APP_LOGO_URL ??= process.env.OVERVIEW_LOGO_URL ?? 'https://public-frontend-cos.metadl.com/mgx/img/favicon_atoms.ico';

// https://vitejs.dev/config/
export default defineConfig(async ({ command }) => {
  const blogPrerenderRoutes = command === 'build' ? getBlogRoutes() : [];
  const isDevServer = command === 'serve';
  const shouldAnalyze = command === 'build' && process.env.ANALYZE === '1';
  const bundleAnalysisPlugins = shouldAnalyze
    ? [
        (await import('rollup-plugin-visualizer')).visualizer({
          filename: 'dist/stats.html',
          template: 'treemap',
          gzipSize: true,
          brotliSize: true,
        }),
        (await import('rollup-plugin-visualizer')).visualizer({
          filename: 'dist/stats.json',
          template: 'raw-data',
          gzipSize: true,
          brotliSize: true,
        }),
      ]
    : [];

  return {
    plugins: [
      react(),
      !isDevServer &&
        atoms({
          error: { enable: false },
          routes: { enable: false },
        }),
      Sitemap({
        hostname: 'https://atoms.template.com',
        lastmod: getSitemapLastmod(),
        readable: true,
        generateRobotsTxt: true,
      }),
      ...bundleAnalysisPlugins,
      ...(blogPrerenderRoutes.length > 0
        ? [
            vitePrerenderPlugin({
              renderTarget: '#root',
              prerenderScript: path.resolve(__dirname, 'prerender/blog.js'),
              additionalPrerenderRoutes: blogPrerenderRoutes,
            }),
          ]
        : []),
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@website-style': path.resolve(__dirname, '..', 'shared', 'contracts'),
        react: path.resolve(__dirname, './node_modules/react'),
        'react/jsx-runtime': path.resolve(__dirname, './node_modules/react/jsx-runtime.js'),
        'react/jsx-dev-runtime': path.resolve(__dirname, './node_modules/react/jsx-dev-runtime.js'),
        'react-router-dom': path.resolve(__dirname, './node_modules/react-router-dom'),
        'lucide-react': path.resolve(__dirname, './node_modules/lucide-react'),
      },
    },
    server: {
      host: '0.0.0.0', // Listen on all network interfaces.
      port: parseInt(process.env.VITE_PORT || '3000'),
      fs: {
        allow: [
          path.resolve(__dirname, '..'),
        ],
      },
      proxy: {
        '/api': {
          // Keep the proxy on the same IPv4 loopback address used by the
          // local-environment probe.  On Windows, `localhost` can resolve to
          // IPv6 first while the backend is bound only to 127.0.0.1, causing a
          // transient false "environment unavailable" alert.
          // Default stays on the primary local API.  A dedicated temporary
          // acceptance server may override this without touching the user's
          // active development port or runtime configuration.
          target: process.env.VITE_API_PROXY_TARGET || `http://127.0.0.1:8000`,
          changeOrigin: true,
        },
      },
      watch: {
        usePolling: process.env.VITE_USE_POLLING === 'true',
        interval: 600,
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/dist/**',
          '**/playwright-report/**',
          '**/test-results/**',
        ],
      },
    },
    build: {
      manifest: 'manifest.json',
      rollupOptions: {
        output: {
          manualChunks: {
            // Vendor chunks
            'react-vendor': ['react', 'react-dom'],
            'router-vendor': ['react-router-dom'],
            'ui-vendor': [
              '@radix-ui/react-accordion',
              '@radix-ui/react-alert-dialog',
              '@radix-ui/react-aspect-ratio',
              '@radix-ui/react-avatar',
              '@radix-ui/react-checkbox',
              '@radix-ui/react-collapsible',
              '@radix-ui/react-context-menu',
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-hover-card',
              '@radix-ui/react-label',
              '@radix-ui/react-menubar',
              '@radix-ui/react-navigation-menu',
              '@radix-ui/react-popover',
              '@radix-ui/react-progress',
              '@radix-ui/react-radio-group',
              '@radix-ui/react-scroll-area',
              '@radix-ui/react-select',
              '@radix-ui/react-separator',
              '@radix-ui/react-slider',
              '@radix-ui/react-slot',
              '@radix-ui/react-switch',
              '@radix-ui/react-tabs',
              '@radix-ui/react-toast',
              '@radix-ui/react-toggle',
              '@radix-ui/react-toggle-group',
              '@radix-ui/react-tooltip',
            ],
            'dnd-vendor': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
            'charts-vendor': ['recharts'],
            'content-vendor': ['markdown-to-jsx', 'yaml'],
            'motion-vendor': ['embla-carousel-react', 'react-resizable-panels', 'vaul'],
            'form-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
            'utils-vendor': [
              'axios',
              'clsx',
              'tailwind-merge',
              'class-variance-authority',
              'date-fns',
              'lucide-react',
            ],
            'query-vendor': ['@tanstack/react-query'],
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
  };
});
