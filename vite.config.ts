/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/kastos/',
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/favicon-32.png', 'icons/apple-touch-180.png'],
      manifest: {
        name: 'Kastos — Ahorro personal',
        short_name: 'Kastos',
        description:
          'Descubre cuánto puedes ahorrar, sigue tu progreso y planifica tus objetivos. Todo local, sin registro, sin nube.',
        lang: 'es',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/kastos/',
        scope: '/kastos/',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        categories: ['finance', 'utilities', 'productivity'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallback: '/kastos/index.html',
        // Iconos de Flaticon (CSS + fuentes): cache-first para funcionar offline.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn-uicons\.flaticon\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'flaticon-uicons',
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
