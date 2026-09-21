import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  base: '/testSchedule_1/',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
  },
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',
          dest: 'ocr',
          rename: { stripBase: true },
        },
      ],
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'icon.svg',
        'apple-touch-icon.png',
        'icon-192.png',
        'icon-512.png',
      ],
      manifest: {
        name: 'WaktuKu — My Timetable',
        short_name: 'WaktuKu',
        description: 'A private timetable and free-time finder for campus schedules.',
        start_url: '/testSchedule_1/',
        scope: '/testSchedule_1/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#f7f5ef',
        theme_color: '#17231d',
        categories: ['education', 'productivity'],
        icons: [
          {
            src: '/testSchedule_1/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/testSchedule_1/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/testSchedule_1/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,wasm,gz}'],
        additionalManifestEntries: [
          { url: 'ocr/eng.traineddata.gz', revision: 'eng-best-int-v1' },
        ],
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
        navigateFallback: '/testSchedule_1/index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
})
