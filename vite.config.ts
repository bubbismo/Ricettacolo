import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serve l'app sotto /<nome-repo>/
const base = process.env.BASE_PATH ?? '/Ricettacolo/'

export default defineConfig({
  base,
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Ricettacolo',
        short_name: 'Ricettacolo',
        description: 'Il ricettario di famiglia',
        lang: 'it',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#FBF1DF',
        theme_color: '#C8322A',
        // Android: Ricettacolo compare tra le app del tasto "Condividi" (link, testo, immagini)
        share_target: {
          action: `${base}share-target`,
          method: 'POST',
          enctype: 'multipart/form-data',
          params: { title: 'title', text: 'text', url: 'url', files: [{ name: 'media', accept: ['image/*'] }] },
        },
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json}'],
        // l'OCR (qualche MB) non si scarica all'installazione: viene tenuto in cache la prima volta che si usa
        globIgnores: ['ocr/**'],
        // gestisce la ricezione dal tasto Condividi
        importScripts: ['share-target.js'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        runtimeCaching: [
          { urlPattern: ({ url }) => url.pathname.includes('/ocr/') || url.pathname.endsWith('.mjs'), handler: 'CacheFirst',
            options: { cacheName: 'pesanti', expiration: { maxEntries: 20 } } },
        ],
      },
    }),
  ],
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
})
