import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Buck Euchre',
        short_name: 'BuckEuchre',
        description: 'Play Buck Euchre online with friends',
        theme_color: '#10b981',
        background_color: '#1f2937',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Cache strategy for the app shell
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          }
        ],
        // Don't cache API calls - they need to be real-time
        navigateFallback: null,
        cleanupOutdatedCaches: true
      },
      devOptions: {
        enabled: false // Disable PWA in development to prevent service worker caching
      }
    })
  ],
  resolve: {
    alias: [
      {
        find: '@',
        replacement: path.resolve(__dirname, './src')
      },
      {
        find: '@buck-euchre/shared',
        replacement: path.resolve(__dirname, '../shared/src')
      },
      {
        find: '@buck-euchre/shared/',
        replacement: `${path.resolve(__dirname, '../shared/src')}/`
      }
    ]
  },
  server: {
    port: 5173,
    host: '0.0.0.0', // Bind to all interfaces (IPv4 and IPv6)
    hmr: {
      overlay: false, // Disable error overlay by default
    },
    proxy: {
      '/api': {
        // Use backend service name when running in Docker
        // For local dev outside Docker, this will need to be localhost:3000
        target: process.env.VITE_PROXY_TARGET || 'http://backend:3000',
        changeOrigin: true
      }
    }
  }
})
