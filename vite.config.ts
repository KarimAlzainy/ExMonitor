import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const relayProxy = {
  '/relay': {
    target: 'ws://127.0.0.1:8080',
    changeOrigin: true,
    ws: true
  }
};

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        id: '/',
        name: 'Ex-Monitor - Crew Health Console',
        short_name: 'Ex-Monitor',
        description: 'Offline-first crew health console with a separate pretend sensor page and on-device assistant',
        theme_color: '#08090c',
        background_color: '#08090c',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        categories: ['medical', 'health', 'utilities'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,webmanifest}'],
        globIgnores: ['**/model-config.json', '**/webllm.worker-*.js'],
        maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/\/sensors\.html$/, /\/relay$/]
      }
    })
  ],
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        sensors: resolve(__dirname, 'sensors.html')
      }
    }
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext'
    }
  },
  worker: {
    format: 'es'
  },
  server: {
    port: 5173,
    host: true,
    proxy: relayProxy
  },
  preview: {
    port: 4173,
    host: true,
    proxy: relayProxy
  }
});
