import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// When deploying to GitHub Pages set GITHUB_PAGES=true.
// For local / LAN use (including phone) leave it unset — base stays '/'.
const isGhPages = process.env.GITHUB_PAGES === 'true';
const base = isGhPages ? '/ai-study-planner/' : '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },   // service worker active in `vite dev` too
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'AI Study Planner',
        short_name: 'StudyPlan',
        description: 'AI-powered study planner that creates personalised schedules',
        theme_color: '#6C47FF',
        background_color: '#F4F4F8',
        display: 'standalone',
        orientation: 'portrait',
        scope: base,
        start_url: base,
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
})
