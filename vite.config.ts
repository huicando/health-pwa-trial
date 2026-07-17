import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      // A previous service worker kept serving stale GitHub Pages bundles on iOS.
      // Ship one cleanup release so the app can always load the current deployment.
      selfDestroying: true,
      registerType: 'autoUpdate',
      includeAssets: ['pwa-192.png', 'pwa-512.png'],
      manifest: {
        name: '健康随记',
        short_name: '健康随记',
        description: '离线优先的轻量健康记录 PWA',
        lang: 'zh-CN',
        theme_color: '#177c63',
        background_color: '#f4f2ec',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        navigateFallback: 'index.html',
        runtimeCaching: [{
          urlPattern: /^https:\/\/.*\.supabase\.co\//,
          handler: 'NetworkOnly',
          options: { backgroundSync: { name: 'supabase-sync-queue', options: { maxRetentionTime: 24 * 60 } } },
        }],
      },
    }),
  ],
})
