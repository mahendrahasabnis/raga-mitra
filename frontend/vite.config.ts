import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { writeFileSync } from 'fs'
import { resolve } from 'path'
import { execSync } from 'child_process'

let appVersionTag = 'dev';
try { appVersionTag = execSync('git describe --tags --abbrev=0 2>/dev/null || git tag -l | tail -1').toString().trim() || 'dev'; } catch {}

function versionJsonPlugin() {
  return {
    name: 'generate-version-json',
    closeBundle() {
      let gitSha = 'unknown';
      try { gitSha = execSync('git rev-parse --short HEAD').toString().trim(); } catch {}
      const version = {
        buildId: `${Date.now()}`,
        timestamp: new Date().toISOString(),
        gitSha,
        tag: appVersionTag,
      };
      writeFileSync(resolve(__dirname, 'dist', 'version.json'), JSON.stringify(version));
      console.log('[version.json]', JSON.stringify(version));
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['vite.svg', 'icon-192x192.png', 'icon-512x512.png'],
      manifest: {
        name: 'Aarogya Mitra',
        short_name: 'Aarogya Mitra',
        description: 'Healthcare Management App',
        theme_color: '#0d0406',
        background_color: '#0d0406',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Never precache mutable files — they must always hit network
        globIgnores: ['**/sw.js', '**/registerSW.js', '**/version.json'],
        // SW lifecycle: activate immediately
        skipWaiting: true,
        clientsClaim: true,
        // SPA navigation: serve index.html from precache, but with network-first fallback
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/health/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
    versionJsonPlugin(),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(appVersionTag),
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
      },
    },
  },
})
