import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const themeColor = '#0f172a'; // dark-mode primary color

export default defineConfig({
  plugins: [
    sveltekit(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'FIRE Simulator',
        short_name: 'FIRE Sim',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: themeColor,
        theme_color: themeColor,
        description: 'Progressive Web App for FIRE simulations with Supabase + Vercel',
        icons: [
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      devOptions: {
        enabled: true
      }
    })
  ]
});
